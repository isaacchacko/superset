import { normalizeWorkspaceTags } from "@superset/shared/workspace-tags";
import { z } from "zod";
import type { ActivePaneStatus } from "./tabs-types";

/**
 * An effort is derived, never stored in Superset: every workspace tagged
 * `effort-<slug>` belongs to it, the one `session` workspace is its sentinel
 * and the rest are its children. Contract: ~/Programs/effort/CONTRACT.md.
 */
export const EFFORT_TAG_PREFIX = "effort-";

const EFFORT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isEffortSlug(slug: string): boolean {
	return EFFORT_SLUG_PATTERN.test(slug);
}

export function effortSlugFromTag(tag: string): string | null {
	if (!tag.startsWith(EFFORT_TAG_PREFIX)) return null;
	const slug = tag.slice(EFFORT_TAG_PREFIX.length);
	return isEffortSlug(slug) ? slug : null;
}

/** A workspace with several effort tags renders in one effort: the smallest tag. */
export function findEffortTag(
	tags: readonly string[] | null | undefined,
): string | null {
	return (
		normalizeWorkspaceTags(tags).find(
			(tag) => effortSlugFromTag(tag) !== null,
		) ?? null
	);
}

export interface EffortMembershipInput {
	type: string;
	tags?: readonly string[] | null;
}

/** Children of an effort never alert the developer; the sentinel does. */
export function isEffortChildWorkspace(
	workspace: EffortMembershipInput,
): boolean {
	return workspace.type !== "session" && findEffortTag(workspace.tags) !== null;
}

export interface EffortChildrenSummary {
	working: number;
	needsAttention: number;
	done: number;
}

export function summarizeEffortChildren(
	statuses: Iterable<ActivePaneStatus | null>,
): EffortChildrenSummary {
	const summary: EffortChildrenSummary = {
		working: 0,
		needsAttention: 0,
		done: 0,
	};
	for (const status of statuses) {
		if (status === "working") summary.working += 1;
		else if (status === "permission" || status === "failed")
			summary.needsAttention += 1;
		else if (status === "review") summary.done += 1;
	}
	return summary;
}

export function collectEffortPullRequestNumbers(
	numbers: Iterable<number | null | undefined>,
): number[] {
	const unique = new Set<number>();
	for (const number of numbers) {
		if (number != null) unique.add(number);
	}
	return [...unique].sort((left, right) => left - right);
}

export const EFFORT_TASK_STATUSES = [
	"todo",
	"doing",
	"waiting",
	"blocked",
	"done",
] as const;

export const effortTaskSchema = z.object({
	id: z.string(),
	title: z.string(),
	status: z.enum(EFFORT_TASK_STATUSES).catch("todo"),
	owner: z.string().nullish(),
	parent: z.string().nullish(),
});

export type EffortTask = z.infer<typeof effortTaskSchema>;

export const effortFileSchema = z.object({
	name: z.string().nullish(),
	closed: z.boolean().nullish(),
	prs: z.array(z.object({ number: z.number().int() }).passthrough()).nullish(),
});

export interface EffortDetails {
	slug: string;
	name: string | null;
	closed: boolean;
	pullRequestNumbers: number[];
	tasks: EffortTask[];
}

/** Lenient: a file the CLI is mid-write on, or one from a newer CLI, must not hide the effort. */
export function parseEffortDetails({
	slug,
	effortJson,
	tasksJson,
}: {
	slug: string;
	effortJson: unknown;
	tasksJson: unknown;
}): EffortDetails {
	const effort = effortFileSchema.safeParse(effortJson);
	const tasks = Array.isArray(tasksJson)
		? tasksJson.flatMap((row) => {
				const task = effortTaskSchema.safeParse(row);
				return task.success ? [task.data] : [];
			})
		: [];
	return {
		slug,
		name: effort.success ? (effort.data.name ?? null) : null,
		closed: effort.success ? (effort.data.closed ?? false) : false,
		pullRequestNumbers: effort.success
			? collectEffortPullRequestNumbers(
					(effort.data.prs ?? []).map((pr) => pr.number),
				)
			: [],
		tasks,
	};
}
