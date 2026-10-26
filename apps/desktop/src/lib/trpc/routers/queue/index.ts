import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	parseQueueItem,
	QUEUE_ITEM_ID_PATTERN,
	type QueueItem,
	type QueuePullRequestStatus,
	sortQueueItems,
	surfacedPullRequestItems,
} from "shared/queue";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { getEffortsHome } from "../efforts";
import { EFFORT_BIN, runTool } from "../vector/run-tool";

export async function readQueue(
	queueDir: string = join(getEffortsHome(), "queue"),
): Promise<QueueItem[]> {
	let names: string[];
	try {
		names = await readdir(queueDir);
	} catch {
		return [];
	}
	const items = await Promise.all(
		names
			.filter((name) => name.endsWith(".json"))
			.map(async (name) => {
				try {
					return parseQueueItem(
						JSON.parse(await readFile(join(queueDir, name), "utf8")),
					);
				} catch {
					return null;
				}
			}),
	);
	return sortQueueItems(items.filter((item) => item !== null));
}

interface GraphqlPullRequest {
	title: string;
	isDraft: boolean;
	state: "OPEN" | "MERGED" | "CLOSED";
	reviewDecision: string | null;
	autoMergeRequest: { enabledAt: string } | null;
}

async function readNudges(): Promise<Record<string, string>> {
	try {
		return JSON.parse(
			await readFile(join(getEffortsHome(), "prmerge-nudges.json"), "utf8"),
		);
	} catch {
		return {};
	}
}

/** What GitHub says about each PR, in one query: aliased `p<i>` per PR. */
async function readGithubPullRequests(
	prs: { repo: string; number: number }[],
): Promise<(GraphqlPullRequest | null)[]> {
	if (prs.length === 0) return [];
	const fields =
		"title isDraft state reviewDecision autoMergeRequest { enabledAt }";
	const query = `query { ${prs
		.map(({ repo, number }, index) => {
			const [owner, name] = repo.split("/");
			return `p${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { pullRequest(number: ${number}) { ${fields} } }`;
		})
		.join(" ")} }`;
	const stdout = await runTool("gh", [
		"api",
		"graphql",
		"-f",
		`query=${query}`,
	]);
	const data = JSON.parse(stdout).data ?? {};
	return prs.map((_, index) => data[`p${index}`]?.pullRequest ?? null);
}

/** A merged or closed PR leaves the Queue: its item is settled, by GitHub. */
async function settle(item: QueueItem, state: "MERGED" | "CLOSED") {
	const kind = state === "MERGED" ? "merged" : "closed";
	const settled: QueueItem = {
		...item,
		status: "answered",
		thread: [
			...item.thread,
			{
				from: "github",
				kind,
				text: `The PR was ${kind}.`,
				at: new Date().toISOString(),
			},
		],
	};
	await writeFile(
		join(getEffortsHome(), "queue", `${item.id}.json`),
		JSON.stringify(settled, null, 2),
	);
}

/**
 * What GitHub says about the given surfaced PRs, by item id. The list itself
 * comes from the Queue, so a newly surfaced PR shows before GitHub answers.
 */
async function readPullRequestStatuses(
	ids: string[],
): Promise<Record<string, QueuePullRequestStatus>> {
	const wanted = new Set(ids);
	const items = surfacedPullRequestItems(await readQueue()).filter((item) =>
		wanted.has(item.id),
	);
	const [github, nudges] = await Promise.all([
		readGithubPullRequests(items.map((item) => item.pr)),
		readNudges(),
	]);
	const statuses: Record<string, QueuePullRequestStatus> = {};
	for (const [index, item] of items.entries()) {
		const pr = github[index];
		if (!pr) continue;
		if (pr.state !== "OPEN") await settle(item, pr.state);
		statuses[item.id] = {
			title: pr.title,
			isDraft: pr.isDraft,
			state: pr.state,
			reviewDecision: pr.reviewDecision,
			autoMergeAt: pr.autoMergeRequest?.enabledAt ?? null,
			nudgedAt: nudges[item.pr.url] ?? null,
		};
	}
	return statuses;
}

export const createQueueRouter = () => {
	return router({
		list: publicProcedure.query(() => readQueue()),
		/**
		 * Answers through the `effort` CLI, which types the answer into the asking
		 * agent's terminal (on whichever host it runs) before recording it.
		 */
		answer: publicProcedure
			.input(
				z.object({
					id: z.string().regex(QUEUE_ITEM_ID_PATTERN),
					kind: z.enum(["decision", "followup"]),
					text: z.string().trim().min(1),
				}),
			)
			.mutation(async ({ input }) => {
				await runTool(EFFORT_BIN, [
					"answer",
					input.id,
					...(input.kind === "followup" ? ["--follow-up"] : []),
					"--",
					input.text,
				]);
			}),
		pullRequestStatuses: publicProcedure
			.input(
				z.object({ ids: z.array(z.string().regex(QUEUE_ITEM_ID_PATTERN)) }),
			)
			.query(({ input }) => readPullRequestStatuses(input.ids)),
		/** Space p m: the agent on the PR's branch is told to /prmerge it. */
		prmerge: publicProcedure
			.input(z.object({ url: z.string().url(), branch: z.string().min(1) }))
			.mutation(async ({ input }) => {
				const out = await runTool(EFFORT_BIN, [
					"prmerge",
					input.url,
					"--branch",
					input.branch,
				]);
				return { message: out.trim() };
			}),
	});
};
