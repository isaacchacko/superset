import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	parseQueueItem,
	QUEUE_ITEM_ID_PATTERN,
	type QueueItem,
	type QueuePullRequest,
	sortQueueItems,
	sortQueuePullRequests,
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

const OPEN_PULL_REQUESTS_QUERY = `query {
  search(query: "is:pr is:open author:@me archived:false", type: ISSUE, first: 100) {
    nodes {
      ... on PullRequest {
        number title url createdAt isDraft headRefName reviewDecision
        repository { nameWithOwner }
        autoMergeRequest { enabledAt }
      }
    }
  }
}`;

interface GraphqlPullRequest {
	number: number;
	title: string;
	url: string;
	createdAt: string;
	isDraft: boolean;
	headRefName: string;
	reviewDecision: string | null;
	repository: { nameWithOwner: string };
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

/** Isaac's open PRs (his agents open them as him), oldest first. */
async function readPullRequests(): Promise<QueuePullRequest[]> {
	const [stdout, nudges] = await Promise.all([
		runTool("gh", [
			"api",
			"graphql",
			"-f",
			`query=${OPEN_PULL_REQUESTS_QUERY}`,
		]),
		readNudges(),
	]);
	const nodes: GraphqlPullRequest[] =
		JSON.parse(stdout).data?.search?.nodes ?? [];
	return sortQueuePullRequests(
		nodes
			.filter((node) => node.number !== undefined)
			.map((node) => ({
				number: node.number,
				title: node.title,
				url: node.url,
				createdAt: node.createdAt,
				isDraft: node.isDraft,
				branch: node.headRefName,
				repo: node.repository.nameWithOwner,
				reviewDecision: node.reviewDecision,
				autoMergeAt: node.autoMergeRequest?.enabledAt ?? null,
				nudgedAt: nudges[node.url] ?? null,
			})),
	);
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
		pullRequests: publicProcedure.query(() => readPullRequests()),
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
