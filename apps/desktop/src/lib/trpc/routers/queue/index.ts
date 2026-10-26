import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { TRPCError } from "@trpc/server";
import {
	parseQueueItem,
	QUEUE_ITEM_ID_PATTERN,
	type QueueItem,
	sortQueueItems,
} from "shared/queue";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { getEffortsHome } from "../efforts";

const execFileAsync = promisify(execFile);

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

/**
 * Answers through the `effort` CLI, which types the answer into the asking agent's
 * terminal (on whichever host it runs) before recording it.
 */
async function answerQueueItem(
	id: string,
	kind: "decision" | "followup",
	text: string,
): Promise<void> {
	const bin = process.env.EFFORT_BIN || join(homedir(), ".local/bin/effort");
	const args = ["answer", id, ...(kind === "followup" ? ["--follow-up"] : [])];
	try {
		await execFileAsync(bin, [...args, "--", text], {
			timeout: 60_000,
			// An app opened from the Dock has a bare PATH; the CLI needs python3 and ssh.
			env: {
				...process.env,
				PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? "/usr/bin:/bin"}`,
			},
		});
	} catch (error) {
		const stderr = (error as { stderr?: string }).stderr?.trim();
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: stderr || (error as Error).message,
		});
	}
}

export const createQueueRouter = () => {
	return router({
		list: publicProcedure.query(() => readQueue()),
		answer: publicProcedure
			.input(
				z.object({
					id: z.string().regex(QUEUE_ITEM_ID_PATTERN),
					kind: z.enum(["decision", "followup"]),
					text: z.string().trim().min(1),
				}),
			)
			.mutation(({ input }) =>
				answerQueueItem(input.id, input.kind, input.text),
			),
	});
};
