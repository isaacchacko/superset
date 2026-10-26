import { z } from "zod";

/**
 * Isaac's Queue: decisions agents raise with `effort ask`, one JSON file per item in
 * ~/.efforts/queue. An item is `open` while it waits on Isaac, `followup` while it waits
 * on the agent, `answered` once Isaac decided, and `withdrawn` when the agent decided itself. Contract: ~/Programs/effort/CONTRACT.md.
 */
export const QUEUE_ITEM_ID_PATTERN = /^q-[0-9a-f]+-[0-9a-f]+$/;

const queueEntrySchema = z.object({
	from: z.enum(["agent", "isaac"]),
	kind: z.enum(["reply", "decision", "followup", "withdrawn"]),
	text: z.string(),
	at: z.string(),
});

const queueItemSchema = z.object({
	id: z.string().regex(QUEUE_ITEM_ID_PATTERN),
	raisedAt: z.string(),
	status: z.enum(["open", "followup", "answered", "withdrawn"]),
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
	/** Answered or withdrawn. */
	settled: QueueItem[];
}

/**
 * `pinned` are ids this view showed as waiting on Isaac: they keep their place
 * there after someone else settles them, so nothing moves while he reads.
 */
export function partitionQueue(
	items: QueueItem[],
	pinned: ReadonlySet<string> = new Set(),
): QueueSections {
	const sorted = sortQueueItems(items);
	const isWaiting = (item: QueueItem) =>
		item.status === "open" || pinned.has(item.id);
	return {
		waitingOnIsaac: sorted.filter(isWaiting),
		waitingOnAgent: sorted.filter(
			(item) => item.status === "followup" && !isWaiting(item),
		),
		// Most recently raised first: the oldest answers matter least.
		settled: sorted
			.filter(
				(item) =>
					(item.status === "answered" || item.status === "withdrawn") &&
					!isWaiting(item),
			)
			.reverse(),
	};
}

/** An open PR Isaac's agents made, for the Queue's PRs tab. */
export interface QueuePullRequest {
	number: number;
	title: string;
	url: string;
	createdAt: string;
	isDraft: boolean;
	branch: string;
	/** owner/name */
	repo: string;
	reviewDecision: string | null;
	/** GitHub auto-merge is armed: /prmerge has it. */
	autoMergeAt: string | null;
	/** When Space p m last told its agent to /prmerge it. */
	nudgedAt: string | null;
}

/** First in, first out, like decisions: the PR that has waited longest comes first. */
export function sortQueuePullRequests(
	pullRequests: QueuePullRequest[],
): QueuePullRequest[] {
	return [...pullRequests].sort(
		(a, b) =>
			a.createdAt.localeCompare(b.createdAt) || a.url.localeCompare(b.url),
	);
}
