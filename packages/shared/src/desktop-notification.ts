import { z } from "zod";

export const DESKTOP_NOTIFICATION_PAGES = ["queue"] as const;
export type DesktopNotificationPage =
	(typeof DESKTOP_NOTIFICATION_PAGES)[number];

export const desktopNotificationSchema = z.object({
	title: z.string().trim().min(1).max(200),
	body: z.string().max(2000).optional(),
	sound: z.boolean().default(false),
	target: z
		.object({ workspaceId: z.string().min(1), terminalId: z.string().min(1) })
		.optional(),
	/** A page of the app to open on click, instead of a terminal. */
	page: z.enum(DESKTOP_NOTIFICATION_PAGES).optional(),
});

export type DesktopNotification = z.infer<typeof desktopNotificationSchema>;
