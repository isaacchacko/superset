import { useLingui } from "@lingui/react/macro";
import type { SidebarEffort } from "../../utils/partitionEffortWorkspaces";
import { DashboardSidebarWorkspaceItem } from "../DashboardSidebarWorkspaceItem";
import { DashboardSidebarEffortGroup } from "./components/DashboardSidebarEffortGroup";

interface DashboardSidebarEffortsSectionProps {
	efforts: SidebarEffort[];
	isCollapsed?: boolean;
	onWorkspaceHover: (workspaceId: string) => void | Promise<void>;
}

/** Top-level "Efforts" section: one group per `effort-*` tag, above Sessions. */
export function DashboardSidebarEffortsSection({
	efforts,
	isCollapsed = false,
	onWorkspaceHover,
}: DashboardSidebarEffortsSectionProps) {
	const { t } = useLingui();
	if (efforts.length === 0) return null;

	if (isCollapsed) {
		return (
			<div className="flex flex-col gap-0.5 py-1">
				{efforts.flatMap((effort) =>
					[
						effort.sentinel,
						...effort.children.map((child) => child.workspace),
					].flatMap((workspace) =>
						workspace
							? [
									<DashboardSidebarWorkspaceItem
										key={workspace.id}
										workspace={workspace}
										isCollapsed
										isInSection={workspace !== effort.sentinel}
										onHoverCardOpen={onWorkspaceHover}
									/>,
								]
							: [],
					),
				)}
				<div className="mx-3 mt-1 border-b border-border" />
			</div>
		);
	}

	return (
		<div className="mt-3 pb-1 first:mt-0">
			<div className="flex h-7 w-full items-center pl-4 pr-2 text-[10px] font-semibold uppercase tracking-[0.075em] text-muted-foreground">
				{t({ message: "Efforts" })}
			</div>
			{efforts.map((effort) => (
				<DashboardSidebarEffortGroup
					key={effort.tag}
					effort={effort}
					onWorkspaceHover={onWorkspaceHover}
				/>
			))}
		</div>
	);
}
