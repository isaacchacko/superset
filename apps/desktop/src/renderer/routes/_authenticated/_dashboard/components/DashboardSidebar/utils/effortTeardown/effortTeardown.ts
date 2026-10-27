import type { BulkDeleteEffort } from "../../stores/bulkDeleteWorkspacesIntent";
import type { DashboardSidebarWorkspace } from "../../types";
import type { SidebarEffort } from "../partitionEffortWorkspaces";

export interface EffortTeardown {
	targets: DashboardSidebarWorkspace[];
	effort: BulkDeleteEffort;
}

/**
 * Deleting an effort's sentinel deletes the whole effort: its children
 * first, the sentinel last, as `effort close --archive` does.
 */
export function effortTeardown(
	efforts: SidebarEffort[],
	workspaceId: string,
): EffortTeardown | null {
	const effort = efforts.find((e) => e.sentinel?.id === workspaceId);
	if (!effort?.sentinel) return null;
	return {
		targets: [
			...effort.children.map((child) => child.workspace),
			effort.sentinel,
		],
		effort: { slug: effort.slug, name: effort.sentinel.name },
	};
}
