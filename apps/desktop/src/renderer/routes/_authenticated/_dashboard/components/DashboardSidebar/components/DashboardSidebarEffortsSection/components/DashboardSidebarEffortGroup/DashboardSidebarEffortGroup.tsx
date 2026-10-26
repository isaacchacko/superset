import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { LuWorkflow } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
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
					"ml-2 flex w-[calc(100%-1rem)] flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors",
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
			{sentinel && (
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
			{effort.children.length > 0 && (
				<DashboardSidebarEffortRoleCaption
					label={t({ message: `Children (${effort.children.length})` })}
				/>
			)}
			{effort.children.map((child) => (
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
			<DashboardSidebarEffortTasks tasks={details?.tasks ?? []} />
		</div>
	);
}
