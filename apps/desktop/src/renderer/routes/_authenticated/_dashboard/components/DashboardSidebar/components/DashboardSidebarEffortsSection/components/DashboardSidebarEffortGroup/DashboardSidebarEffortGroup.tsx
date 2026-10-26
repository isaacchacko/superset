import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { LuChevronRight, LuWorkflow } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useExpandedEffortsStore } from "renderer/stores/expanded-efforts";
import {
	collectEffortPullRequestNumbers,
	summarizeEffortChildren,
} from "shared/efforts";
import { useSidebarWorkspaceStatuses } from "../../../../providers/DashboardSidebarWorkspaceStatusProvider";
import type { SidebarEffort } from "../../../../utils/partitionEffortWorkspaces";
import { DashboardSidebarWorkspaceItem } from "../../../DashboardSidebarWorkspaceItem";
import { DashboardSidebarEffortRoleCaption } from "../DashboardSidebarEffortRoleCaption";
import { DashboardSidebarEffortTasks } from "../DashboardSidebarEffortTasks";

const EFFORT_DETAILS_REFRESH_MS = 5_000;

interface DashboardSidebarEffortGroupProps {
	effort: SidebarEffort;
	onWorkspaceHover: (workspaceId: string) => void | Promise<void>;
}

export function DashboardSidebarEffortGroup({
	effort,
	onWorkspaceHover,
}: DashboardSidebarEffortGroupProps) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const { data: details } = electronTrpc.efforts.get.useQuery(
		{ slug: effort.slug },
		{ refetchInterval: EFFORT_DETAILS_REFRESH_MS },
	);
	const statuses = useSidebarWorkspaceStatuses();
	const isExpanded = useExpandedEffortsStore(
		(state) => !!state.expanded[effort.slug],
	);
	const toggleExpanded = useExpandedEffortsStore((state) => state.toggle);
	const summary = summarizeEffortChildren(
		effort.children.map(
			(child) => statuses.get(child.workspace.id)?.status ?? null,
		),
	);
	const pullRequestNumbers = collectEffortPullRequestNumbers([
		...effort.children.map((child) => child.workspace.pullRequest?.number),
		...(details?.pullRequestNumbers ?? []),
	]);
	const name = details?.name ?? effort.slug;
	const sentinel = effort.sentinel;
	const isSentinelActive =
		sentinel !== null &&
		!!matchRoute({
			to: "/v2-workspace/$workspaceId",
			params: { workspaceId: sentinel.id },
		});
	const openSentinel = () => {
		if (!sentinel) return;
		navigate({
			to: "/v2-workspace/$workspaceId",
			params: { workspaceId: sentinel.id },
		});
	};

	return (
		<div className="mb-1" data-effort={effort.tag}>
			<div className="group/effort relative">
				<button
					type="button"
					aria-label={
						isExpanded
							? t({ message: `Collapse ${name}` })
							: t({ message: `Expand ${name}` })
					}
					aria-expanded={isExpanded}
					onClick={() => toggleExpanded(effort.slug)}
					className="absolute top-1.5 left-2 z-10 flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-fill-hover hover:text-foreground"
				>
					<LuChevronRight
						className={cn(
							"size-3 transition-transform",
							isExpanded && "rotate-90",
						)}
					/>
				</button>
				<button
					type="button"
					onClick={openSentinel}
					disabled={!sentinel}
					title={
						sentinel
							? t({ message: `Open the sentinel of ${name}` })
							: t({ message: "This effort has no sentinel session" })
					}
					className={cn(
						"ml-2 flex w-[calc(100%-1rem)] flex-col gap-0.5 rounded-md py-1.5 pr-2 pl-5 text-left transition-colors",
						sentinel && "hover:bg-fill-hover",
						isSentinelActive && "bg-fill-selected",
					)}
				>
					<span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
						<LuWorkflow className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="min-w-0 truncate">{name}</span>
					</span>
					<span className="flex min-w-0 flex-wrap items-center gap-x-2 pl-5 text-[11px] text-muted-foreground">
						<span className={cn(summary.working > 0 && "text-amber-500")}>
							{t({ message: `${summary.working} working` })}
						</span>
						<span className={cn(summary.needsAttention > 0 && "text-red-500")}>
							{t({ message: `${summary.needsAttention} need you` })}
						</span>
						{summary.done > 0 && (
							<span className="text-green-500">
								{t({ message: `${summary.done} done` })}
							</span>
						)}
						{pullRequestNumbers.length > 0 && (
							<span className="truncate">
								{pullRequestNumbers.map((number) => `#${number}`).join(" ")}
							</span>
						)}
					</span>
				</button>
			</div>
			{isExpanded && sentinel && (
				<>
					<DashboardSidebarEffortRoleCaption
						label={t({ message: "Sentinel" })}
					/>
					<DashboardSidebarWorkspaceItem
						workspace={sentinel}
						indentation="workspace"
						onHoverCardOpen={onWorkspaceHover}
					/>
				</>
			)}
			{isExpanded && effort.children.length > 0 && (
				<DashboardSidebarEffortRoleCaption
					label={t({ message: `Children (${effort.children.length})` })}
				/>
			)}
			{isExpanded &&
				effort.children.map((child) => (
					<DashboardSidebarWorkspaceItem
						key={child.workspace.id}
						workspace={child.workspace}
						isInSection
						indentation="grouped"
						onHoverCardOpen={onWorkspaceHover}
						pinnedContext={{
							projectName: child.projectName,
							projectIconUrl: child.projectIconUrl,
						}}
					/>
				))}
			{isExpanded && (
				<DashboardSidebarEffortTasks tasks={details?.tasks ?? []} />
			)}
		</div>
	);
}
