import { useLingui } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import type { EffortTask } from "shared/efforts";
import { DashboardSidebarEffortRoleCaption } from "../DashboardSidebarEffortRoleCaption";

const MAX_OPEN_TASKS_SHOWN = 5;

const STATUS_DOT_CLASS: Record<EffortTask["status"], string> = {
	todo: "border border-muted-foreground/60",
	doing: "bg-amber-500",
	waiting: "bg-blue-500",
	blocked: "bg-red-500",
	done: "bg-green-500",
};

/** The open part of the effort's tasks.json, owned by the sentinel and its children. */
export function DashboardSidebarEffortTasks({
	tasks,
}: {
	tasks: EffortTask[];
}) {
	const { t } = useLingui();
	if (tasks.length === 0) return null;
	const doneCount = tasks.filter((task) => task.status === "done").length;
	const openTasks = tasks.filter((task) => task.status !== "done");
	const hiddenCount = Math.max(0, openTasks.length - MAX_OPEN_TASKS_SHOWN);

	return (
		<div className="pb-1">
			<DashboardSidebarEffortRoleCaption
				label={t({ message: `Tasks (${doneCount}/${tasks.length} done)` })}
			/>
			{openTasks.slice(0, MAX_OPEN_TASKS_SHOWN).map((task) => (
				<div
					key={task.id}
					title={task.owner ? `${task.title} (${task.owner})` : task.title}
					className="flex min-w-0 items-center gap-2 py-0.5 pl-9 pr-3 text-xs text-muted-foreground"
				>
					<span
						className={cn(
							"size-1.5 shrink-0 rounded-full",
							STATUS_DOT_CLASS[task.status],
						)}
					/>
					<span className="min-w-0 truncate">{task.title}</span>
					{task.owner && (
						<span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">
							{task.owner}
						</span>
					)}
				</div>
			))}
			{hiddenCount > 0 && (
				<div className="pl-9 text-[10px] text-muted-foreground/70">
					{t({ message: `${hiddenCount} more open` })}
				</div>
			)}
		</div>
	);
}
