import { useMemo } from "react";
import { useTagFolderWorkspaces } from "renderer/routes/_authenticated/providers/TagFolderWorkspacesProvider";
import {
	type EffortPartition,
	partitionEffortWorkspaces,
} from "../../utils/partitionEffortWorkspaces";

type EffortPartitionSource = Omit<EffortPartition, "efforts">;

/** The sidebar data with effort members moved out of their lanes into `efforts`. */
export function useSidebarEfforts<Data extends EffortPartitionSource>(
	data: Data,
): Data & EffortPartition {
	const { workspaces } = useTagFolderWorkspaces();
	const { groups, sessionChildren, sessionWorkspaces } = data;
	const partition = useMemo(() => {
		const tagsById = new Map(
			workspaces.map((workspace) => [workspace.id, workspace.tags]),
		);
		return partitionEffortWorkspaces({
			groups,
			sessionChildren,
			sessionWorkspaces,
			tagsOf: (workspaceId) => tagsById.get(workspaceId),
		});
	}, [groups, sessionChildren, sessionWorkspaces, workspaces]);
	return { ...data, ...partition };
}
