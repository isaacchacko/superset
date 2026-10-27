import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	type EffortDetails,
	isEffortSlug,
	parseEffortDetails,
} from "shared/efforts";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { EFFORT_BIN, runTool } from "../vector/run-tool";

/** Same override the `effort` CLI honours, so both read one home. */
export function getEffortsHome(env: NodeJS.ProcessEnv = process.env): string {
	return env.EFFORT_HOME || join(homedir(), ".efforts");
}

async function readJsonOrNull(path: string): Promise<unknown> {
	try {
		return JSON.parse(await readFile(path, "utf8"));
	} catch {
		return null;
	}
}

export async function readEffortDetails(
	slug: string,
	effortsHome: string = getEffortsHome(),
): Promise<EffortDetails> {
	const dir = join(effortsHome, slug);
	const [effortJson, tasksJson] = await Promise.all([
		readJsonOrNull(join(dir, "effort.json")),
		readJsonOrNull(join(dir, "tasks.json")),
	]);
	return parseEffortDetails({ slug, effortJson, tasksJson });
}

export const createEffortsRouter = () => {
	return router({
		get: publicProcedure
			.input(z.object({ slug: z.string().refine(isEffortSlug) }))
			.query(({ input }) => readEffortDetails(input.slug)),
		/** Marks the effort closed, which stops its sentinel's `effort watch`. */
		close: publicProcedure
			.input(z.object({ slug: z.string().refine(isEffortSlug) }))
			.mutation(async ({ input }) => {
				await runTool(EFFORT_BIN, ["--effort", input.slug, "close"]);
			}),
	});
};
