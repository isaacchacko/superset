import { Trans } from "@lingui/react/macro";
import { cn } from "@superset/ui/utils";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { NOTIFICATION_EVENTS } from "shared/constants";
import type { QueueTab } from "../../page";
import { QueueDecisions } from "./components/QueueDecisions";
import { QueuePullRequests } from "./components/QueuePullRequests";

export const QUEUE_REFRESH_MS = 3_000;
export const QUEUE_PULL_REQUESTS_REFRESH_MS = 30_000;

const TABS: QueueTab[] = ["decisions", "prs"];

interface QueueViewProps {
	tab: QueueTab;
	onTabChange: (tab: QueueTab) => void;
}

/** What waits on Isaac, oldest first: decisions agents raised, and the PRs they opened. */
export function QueueView({ tab, onTabChange }: QueueViewProps) {
	const { data: items = [] } = electronTrpc.queue.list.useQuery(undefined, {
		refetchInterval: QUEUE_REFRESH_MS,
	});
	const { data: pullRequests } = electronTrpc.queue.pullRequests.useQuery(
		undefined,
		{ refetchInterval: QUEUE_PULL_REQUESTS_REFRESH_MS },
	);
	const decisionCount = items.filter(
		(item) => item.status === "open" && !item.pr,
	).length;

	// Cmd+H / Cmd+L, caught in the main process before the menu's Hide.
	electronTrpc.notifications.subscribe.useSubscription(undefined, {
		onData: (event) => {
			if (event.type !== NOTIFICATION_EVENTS.QUEUE_TAB || !event.data) return;
			const index = TABS.indexOf(tab);
			const next = event.data.direction === "left" ? index - 1 : index + 1;
			const target = TABS[Math.min(Math.max(next, 0), TABS.length - 1)];
			if (target && target !== tab) onTabChange(target);
		},
	});

	const tabButton = (
		value: QueueTab,
		label: React.ReactNode,
		count?: number,
	) => (
		<button
			type="button"
			onClick={() => onTabChange(value)}
			aria-current={tab === value ? "page" : undefined}
			className={cn(
				"flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors",
				tab === value
					? "bg-accent text-foreground"
					: "text-muted-foreground hover:text-foreground",
			)}
		>
			{label}
			{count !== undefined && (
				<span className="text-muted-foreground text-xs tabular-nums">
					{count}
				</span>
			)}
		</button>
	);

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<PageHeader />
			<div className="flex shrink-0 items-center gap-1 px-8 pb-3">
				<h1 className="mr-4 font-semibold text-xl tracking-tight">
					<Trans>Queue</Trans>
				</h1>
				{tabButton("decisions", <Trans>Decisions</Trans>, decisionCount)}
				{tabButton("prs", <Trans>PRs</Trans>, pullRequests?.length)}
				<span className="ml-auto text-muted-foreground text-xs">
					<Trans>⌘H / ⌘L switch tabs</Trans>
				</span>
			</div>
			{tab === "decisions" ? (
				<QueueDecisions items={items} />
			) : (
				<QueuePullRequests pullRequests={pullRequests} />
			)}
		</div>
	);
}
