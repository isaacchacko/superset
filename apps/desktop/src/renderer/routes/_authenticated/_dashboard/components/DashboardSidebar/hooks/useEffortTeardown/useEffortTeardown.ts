import { useEffect } from "react";
import { useDeleteWorkspaceIntent } from "renderer/stores/delete-workspace-intent";
import { useBulkDeleteWorkspacesIntent } from "../../stores/bulkDeleteWorkspacesIntent";
import { effortTeardown } from "../../utils/effortTeardown";
import type { SidebarEffort } from "../../utils/partitionEffortWorkspaces";

/**
 * Every single delete (⌘⇧⌫, a row's menu, the command palette) of an effort's
 * sentinel becomes a bulk delete of the whole effort.
 */
export function useEffortTeardown(efforts: SidebarEffort[]) {
	useEffect(() => {
		useDeleteWorkspaceIntent.setState({
			divert: (target) => {
				const teardown = effortTeardown(efforts, target.workspaceId);
				if (!teardown) return false;
				useBulkDeleteWorkspacesIntent
					.getState()
					.request(teardown.targets, teardown.effort);
				return true;
			},
		});
		return () => useDeleteWorkspaceIntent.setState({ divert: null });
	}, [efforts]);
}
