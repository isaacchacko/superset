import { boolean, CLIError, positional, string } from "@superset/cli-framework";
import { DESKTOP_NOTIFICATION_PAGES } from "@superset/shared/desktop-notification";
import { command } from "../../../lib/command";
import { resolveHostClient } from "../../../lib/resolve-host-client";

/** Inside a Superset terminal, a click on the notification opens that terminal. */
function clickTarget(options: {
	host?: string | null;
	workspace?: string | null;
	terminal?: string | null;
}) {
	const fromEnv = !options.host;
	const workspaceId =
		options.workspace ??
		(fromEnv ? process.env.SUPERSET_WORKSPACE_ID : undefined);
	const terminalId =
		options.terminal ??
		(fromEnv ? process.env.SUPERSET_TERMINAL_ID : undefined);
	return workspaceId && terminalId ? { workspaceId, terminalId } : undefined;
}

function isNotificationPage(
	page: string,
): page is (typeof DESKTOP_NOTIFICATION_PAGES)[number] {
	return (DESKTOP_NOTIFICATION_PAGES as readonly string[]).includes(page);
}

export default command({
	description:
		"Show a desktop notification; clicking it opens the terminal that sent it",
	args: [positional("title").required().desc("Notification title")],
	options: {
		body: string().desc("Text under the title"),
		sound: boolean().desc("Play the notification sound set in the app"),
		workspace: string().desc(
			"Workspace to open on click (default: the calling terminal's)",
		),
		terminal: string().desc(
			"Terminal to open on click (default: the calling terminal)",
		),
		host: string().desc(
			"Host whose desktop app shows it (default: this machine)",
		),
		page: string().desc(
			`Page to open on click instead of a terminal: ${DESKTOP_NOTIFICATION_PAGES.join(", ")}`,
		),
	},
	run: async ({ ctx, args, options }) => {
		const page = options.page ?? undefined;
		if (page !== undefined && !isNotificationPage(page)) {
			throw new CLIError(
				`Unknown page "${page}"`,
				`Use one of: ${DESKTOP_NOTIFICATION_PAGES.join(", ")}`,
			);
		}
		const client = await resolveHostClient(ctx, options);
		const target = page ? undefined : clickTarget(options);
		const result = await client.notifications.show
			.mutate({
				title: args.title as string,
				body: options.body ?? undefined,
				sound: options.sound ?? false,
				target,
				page,
			})
			.catch((error: unknown) => {
				if (
					error instanceof Error &&
					/No procedure found on path "?notifications\.show/.test(error.message)
				) {
					throw new CLIError(
						"This host is too old for `superset notifications show`",
						"Update the Paradev desktop app on that host",
					);
				}
				throw error;
			});
		if (!result.shown) {
			throw new CLIError(
				"The desktop app could not show a notification",
				"Notifications are not supported or are turned off for Paradev in system settings",
			);
		}
		return {
			data: { ...result, target: target ?? null },
			message: "Notification shown",
		};
	},
});
