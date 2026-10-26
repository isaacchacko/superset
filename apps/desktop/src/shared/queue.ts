import { z } from "zod";

/**
 * Isaac's Queue: decisions agents raise with `effort ask`, one JSON file per item in
 * ~/.efforts/queue. An item is `open` while it waits on Isaac, `followup` while it waits
 * on the agent, and `answered` once Isaac decided. Contract: ~/Programs/effort/CONTRACT.md.
 */
export const QUEUE_ITEM_ID_PATTERN = /^q-[0-9a-f]+-[0-9a-f]+$/;

const queueEntrySchema = z.object({
	from: z.enum(["agent", "isaac"]),
	kind: z.enum(["reply", "decision", "followup"]),
	text: z.string(),
	at: z.string(),
});

const queueItemSchema = z.object({
	id: z.string().regex(QUEUE_ITEM_ID_PATTERN),
	raisedAt: z.string(),
	status: z.enum(["open", "followup", "answered"]),
	asker: z.object({
		device: z.string(),
		workspace: z.string(),
		terminal: z.string(),
		label: z.string(),
		effort: z.string().nullable().optional(),
		member: z.string().nullable().optional(),
	}),
	question: z.string(),
	details: z.string().default(""),
	thread: z.array(queueEntrySchema).default([]),
});

export type QueueItem = z.infer<typeof queueItemSchema>;
export type QueueAnswerKind = "decision" | "followup";

export function parseQueueItem(json: unknown): QueueItem | null {
	const result = queueItemSchema.safeParse(json);
	return result.success ? result.data : null;
}

/** The id starts with the raise time in milliseconds; raisedAt has only seconds. */
function raisedAtMs(item: QueueItem): number {
	return Number.parseInt(item.id.split("-")[1] ?? "0", 16);
}

/** First in, first out: the question that has waited longest comes first. */
export function sortQueueItems(items: QueueItem[]): QueueItem[] {
	return [...items].sort(
		(a, b) => raisedAtMs(a) - raisedAtMs(b) || a.id.localeCompare(b.id),
	);
}

export interface QueueSections {
	waitingOnIsaac: QueueItem[];
	waitingOnAgent: QueueItem[];
	answered: QueueItem[];
}

export function partitionQueue(items: QueueItem[]): QueueSections {
	const sorted = sortQueueItems(items);
	return {
		waitingOnIsaac: sorted.filter((item) => item.status === "open"),
		waitingOnAgent: sorted.filter((item) => item.status === "followup"),
		// Most recently raised first: the oldest answers matter least.
		answered: sorted.filter((item) => item.status === "answered").reverse(),
	};
}
