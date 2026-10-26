import { effortSlugFromTag, findEffortTag } from "shared/efforts";
import type {
	DashboardSidebarProject,
	DashboardSidebarProjectChild,
	DashboardSidebarWorkspace,
} from "../../types";

export interface SidebarEffortChild {
	workspace: DashboardSidebarWorkspace;
	projectName: string | null;
	projectIconUrl: string | null;
}

export interface SidebarEffort {
	tag: string;
	slug: string;
	sentinel: DashboardSidebarWorkspace | null;
	children: SidebarEffortChild[];
}

export interface EffortPartitionInput {
	groups: DashboardSidebarProject[];
	sessionChildren: DashboardSidebarProjectChild[];
	sessionWorkspaces: DashboardSidebarWorkspace[];
	tagsOf: (workspaceId: string) => readonly string[] | null | undefined;
}

export interface EffortPartition {
	efforts: SidebarEffort[];
	groups: DashboardSidebarProject[];
	sessionChildren: DashboardSidebarProjectChild[];
	sessionWorkspaces: DashboardSidebarWorkspace[];
}

interface EffortMember extends SidebarEffortChild {
	tag: string;
}

/**
 * Lifts every workspace with an `effort-*` tag out of the Sessions lane and
 * the project lanes into its effort, so each row still renders exactly once.
 * Inputs come back by identity when nothing moves.
 */
export function partitionEffortWorkspaces({
	groups,
	sessionChildren,
	sessionWorkspaces,
	tagsOf,
}: EffortPartitionInput): EffortPartition {
	const members: EffortMember[] = [];
	const takeMembers = (
		children: DashboardSidebarProjectChild[],
		project: DashboardSidebarProject | null,
	): DashboardSidebarProjectChild[] => {
		const take = (workspace: DashboardSidebarWorkspace): boolean => {
			const tag = findEffortTag(tagsOf(workspace.id));
			if (tag === null) return false;
			members.push({
				tag,
				workspace,
				projectName: project?.name ?? null,
				projectIconUrl: project?.iconUrl ?? null,
			});
			return true;
		};
		let changed = false;
		const kept = children.flatMap((child): DashboardSidebarProjectChild[] => {
			if (child.type === "workspace") {
				if (!take(child.workspace)) return [child];
				changed = true;
				return [];
			}
			const rest = child.section.workspaces.filter(
				(workspace) => !take(workspace),
			);
			if (rest.length === child.section.workspaces.length) return [child];
			changed = true;
			if (rest.length === 0) return [];
			return [
				{ type: "section", section: { ...child.section, workspaces: rest } },
			];
		});
		return changed ? kept : children;
	};

	const nextSessionChildren = takeMembers(sessionChildren, null);
	let groupsChanged = false;
	const nextGroups = groups.map((project) => {
		const children = takeMembers(project.children, project);
		if (children === project.children) return project;
		groupsChanged = true;
		return { ...project, children };
	});

	if (members.length === 0) {
		return { efforts: [], groups, sessionChildren, sessionWorkspaces };
	}

	const memberIds = new Set(members.map((member) => member.workspace.id));
	return {
		efforts: groupEffortMembers(members),
		groups: groupsChanged ? nextGroups : groups,
		sessionChildren: nextSessionChildren,
		sessionWorkspaces: sessionWorkspaces.filter(
			(workspace) => !memberIds.has(workspace.id),
		),
	};
}

function groupEffortMembers(members: EffortMember[]): SidebarEffort[] {
	const byTag = new Map<string, EffortMember[]>();
	for (const member of members) {
		const list = byTag.get(member.tag) ?? [];
		list.push(member);
		byTag.set(member.tag, list);
	}
	return [...byTag.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([tag, list]) => {
			const ordered = [...list].sort(
				(left, right) =>
					left.workspace.createdAt.getTime() -
						right.workspace.createdAt.getTime() ||
					left.workspace.id.localeCompare(right.workspace.id),
			);
			const sentinel =
				ordered.find((member) => member.workspace.type === "session") ?? null;
			return {
				tag,
				slug: effortSlugFromTag(tag) ?? tag,
				sentinel: sentinel?.workspace ?? null,
				children: ordered
					.filter((member) => member !== sentinel)
					.map(({ tag: _tag, ...child }) => child),
			};
		});
}
