import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { TRPCError } from "@trpc/server";

const execFileAsync = promisify(execFile);

export const EFFORT_BIN =
	process.env.EFFORT_BIN || join(homedir(), ".local/bin/effort");
export const SUPERSET_BIN = join(homedir(), ".superset/bin/superset");

/**
 * Runs one of Isaac's command-line tools (`effort`, `gh`, the `superset` CLI)
 * and returns its stdout; a failure becomes a tRPC error carrying its stderr.
 */
export async function runTool(
	bin: string,
	args: string[],
	timeout = 60_000,
): Promise<string> {
	try {
		const { stdout } = await execFileAsync(bin, args, {
			timeout,
			maxBuffer: 16 * 1024 * 1024,
			// An app opened from the Dock has a bare PATH; the tools need python3, gh and ssh.
			env: {
				...process.env,
				PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? "/usr/bin:/bin"}`,
			},
		});
		return stdout;
	} catch (error) {
		const stderr = (error as { stderr?: string }).stderr?.trim();
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: stderr || (error as Error).message,
		});
	}
}
