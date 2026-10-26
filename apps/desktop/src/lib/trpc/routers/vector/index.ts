import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
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
	});
};
