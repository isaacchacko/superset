import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { publicProcedure, router } from "../..";
import { runTool, SUPERSET_BIN } from "./run-tool";

/** Host-service opens terminals in ~ for a session whose folder holds this marker. */
const HOME_WORKSPACE_MARKER = ".vector-home";
const HOME_WORKSPACE_NAME = "Terminal";

interface CliWorkspace {
	id: string;
	name: string;
	type: string;
	worktreePath: string | null;
	archivedAt: string | null;
}

async function superset<T>(args: string[]): Promise<T> {
	return JSON.parse(await runTool(SUPERSET_BIN, [...args, "--json"])) as T;
}

/** The "Terminal" session workspace, made on first use, whose terminals start in ~. */
async function findHomeWorkspace(): Promise<CliWorkspace | undefined> {
	const workspaces = await superset<CliWorkspace[]>([
		"workspaces",
		"list",
		"--local",
	]);
	return workspaces.find(
		(workspace) =>
			workspace.type === "session" &&
			workspace.name === HOME_WORKSPACE_NAME &&
			!workspace.archivedAt,
	);
}

async function homeWorkspace(): Promise<CliWorkspace> {
	let workspace = await findHomeWorkspace();
	if (!workspace) {
		// `create` answers without the session folder; the listing has it.
		await superset([
			"workspaces",
			"create",
			"--local",
			"--session",
			"--name",
			HOME_WORKSPACE_NAME,
		]);
		workspace = await findHomeWorkspace();
	}
	if (!workspace) throw new Error("The Terminal workspace was not created");
	if (workspace.worktreePath) {
		await writeFile(join(workspace.worktreePath, HOME_WORKSPACE_MARKER), "");
	}
	return workspace;
}

/** Quoted for the user's shell, which the terminal types the command into. */
function shellQuote(text: string): string {
	return `'${text.replaceAll("'", "'\\''")}'`;
}

export const createVectorRouter = () => {
	return router({
		/** Space n: a new shell in ~, in its own tab of the Terminal workspace. */
		openHomeTerminal: publicProcedure.mutation(async () => {
			const workspace = await homeWorkspace();
			const { terminalId } = await superset<{ terminalId: string }>([
				"terminals",
				"create",
				"--workspace",
				workspace.id,
				"--local",
				"--cwd",
				homedir(),
			]);
			return { workspaceId: workspace.id, terminalId };
		}),
		/**
		 * Cmd+K on a chat no agent is running: `claude --resume` it in its own
		 * folder, in the workspace that holds that folder, else in a new session
		 * workspace named for the chat.
		 */
		resumeChat: publicProcedure
			.input(
				z.object({
					sessionId: z.string().regex(/^[\w-]+$/),
					configDir: z.string().nullable(),
					cwd: z.string().min(1),
					title: z.string(),
					workspaceId: z.string().nullable(),
				}),
			)
			.mutation(async ({ input }) => {
				const workspaceId =
					input.workspaceId ??
					(
						await superset<{ workspace: { id: string } }>([
							"workspaces",
							"create",
							"--local",
							"--session",
							"--name",
							input.title.slice(0, 80) || "Resumed chat",
						])
					).workspace.id;
				// Claude finds a session by its folder; one whose worktree is gone gets the path back, empty.
				await mkdir(input.cwd, { recursive: true });
				const account = input.configDir
					? `CLAUDE_CONFIG_DIR=${shellQuote(input.configDir)} `
					: "";
				const { terminalId } = await superset<{ terminalId: string }>([
					"terminals",
					"create",
					"--workspace",
					workspaceId,
					"--local",
					"--cwd",
					input.cwd,
					"--command",
					`${account}claude --resume ${input.sessionId}`,
				]);
				return { workspaceId, terminalId };
			}),
	});
};
