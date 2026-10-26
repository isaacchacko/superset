import { Trans, useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { useEffect, useRef, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import {
	VIM_PAGE_ACTION_EVENT,
	type VimPageAction,
} from "renderer/routes/_authenticated/_dashboard/components/DashboardSidebar/utils/vimBindings";
import type { QueuePullRequest } from "shared/queue";
import { QueuePullRequestDetail } from "./components/QueuePullRequestDetail";

interface QueuePullRequestsProps {
	/** Undefined while the first read is in flight. */
	pullRequests: QueuePullRequest[] | undefined;
}

/**
 * PRs agents surfaced to Isaac (`effort ask --pr`), oldest first, beside the
 * selected one's note, answer box, description and diff. Space c u / c n copy
 * its URL / number, Space p m tells its agent to /prmerge it, j / k move
 * through the list.
 */
export function QueuePullRequests({ pullRequests }: QueuePullRequestsProps) {
	const { t } = useLingui();
	const utils = electronTrpc.useUtils();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const list = pullRequests ?? [];
	const selected =
		list.find((pullRequest) => pullRequest.item.id === selectedId) ??
		list[0] ??
		null;
	const prmerge = electronTrpc.queue.prmerge.useMutation({
		onSuccess: ({ message }) => {
			toast.success(message);
			utils.queue.pullRequestStatuses.invalidate();
		},
		onError: (error) =>
			toast.error(t({ message: "Couldn't nudge the PR's agent" }), {
				description: error.message,
			}),
	});

	const latest = useRef({ list, selected });
	latest.current = { list, selected };
	useEffect(() => {
		const copy = (text: string) =>
			navigator.clipboard
				.writeText(text)
				.then(() => toast(t({ message: `Copied ${text}` })));
		const onAction = (event: Event) => {
			const action = (event as CustomEvent<VimPageAction>).detail;
			const { list, selected } = latest.current;
			if (action === "next-item" || action === "prev-item") {
				const index = selected ? list.indexOf(selected) : -1;
				const next = list[index + (action === "next-item" ? 1 : -1)];
				if (next) setSelectedId(next.item.id);
				return;
			}
			if (!selected) return;
			const { pr } = selected.item;
			if (action === "copy-pr-url") void copy(pr.url);
			else if (action === "copy-pr-number") void copy(String(pr.number));
			else if (action === "prmerge-pr") {
				if (selected.status?.autoMergeAt) {
					toast(t({ message: `#${pr.number} is already set to merge` }));
					return;
				}
				prmerge.mutate({ url: pr.url, branch: pr.branch });
			}
		};
		window.addEventListener(VIM_PAGE_ACTION_EVENT, onAction);
		return () => window.removeEventListener(VIM_PAGE_ACTION_EVENT, onAction);
	}, [prmerge.mutate, t]);

	if (pullRequests === undefined) {
		return (
			<div className="px-8 text-muted-foreground text-sm">
				<Trans>Reading the PRs agents surfaced…</Trans>
			</div>
		);
	}
	if (list.length === 0) {
		return (
			<div className="mx-8 rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
				<Trans>
					No agent has surfaced a PR to you. Agents do it with effort ask --pr.
				</Trans>
			</div>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 border-t">
			<ol className="w-80 shrink-0 select-text overflow-y-auto border-r py-1">
				{list.map((pullRequest, index) => {
					const { item } = pullRequest;
					const raisedAtMs = Number.parseInt(item.id.split("-")[1] ?? "0", 16);
					return (
						<li key={item.id}>
							<button
								type="button"
								onClick={() => setSelectedId(item.id)}
								className={cn(
									"flex w-full flex-col gap-1 px-4 py-2 text-left transition-colors",
									pullRequest === selected
										? "bg-fill-selected"
										: "hover:bg-fill-hover",
								)}
							>
								<span className="flex items-center gap-1.5 text-muted-foreground text-xs">
									<span className="tabular-nums">{index + 1}</span>
									<span className="truncate">
										{item.pr.repo}#{item.pr.number}
									</span>
									<span className="ml-auto shrink-0">
										{formatRelativeTime(raisedAtMs)}
									</span>
								</span>
								<span className="line-clamp-2 text-sm leading-snug">
									{pullRequest.status?.title ?? item.question}
								</span>
								<span className="line-clamp-2 text-muted-foreground text-xs">
									{item.asker.label}: {item.question}
								</span>
								<QueuePullRequestBadges pullRequest={pullRequest} />
							</button>
						</li>
					);
				})}
			</ol>
			{selected && (
				<QueuePullRequestDetail key={selected.item.id} pullRequest={selected} />
			)}
		</div>
	);
}

function QueuePullRequestBadges({
	pullRequest,
}: {
	pullRequest: QueuePullRequest;
}) {
	const { item, status } = pullRequest;
	const badge = "rounded px-1.5 py-0.5 text-[10px] font-medium";
	return (
		<span className="flex flex-wrap gap-1">
			{item.status === "followup" && (
				<span
					className={cn(
						badge,
						"bg-blue-500/15 text-blue-600 dark:text-blue-400",
					)}
				>
					<Trans>waiting on the agent</Trans>
				</span>
			)}
			{status?.autoMergeAt ? (
				<span
					className={cn(
						badge,
						"bg-green-500/15 text-green-600 dark:text-green-400",
					)}
				>
					<Trans>/prmerge on it</Trans>
				</span>
			) : status?.nudgedAt ? (
				<span
					className={cn(
						badge,
						"bg-amber-500/15 text-amber-600 dark:text-amber-400",
					)}
				>
					<Trans>
						nudged {formatRelativeTime(Date.parse(status.nudgedAt))} ago
					</Trans>
				</span>
			) : status ? (
				<span className={cn(badge, "bg-fill-hover text-muted-foreground")}>
					<Trans>no /prmerge · Space p m</Trans>
				</span>
			) : null}
			{status?.isDraft && (
				<span className={cn(badge, "bg-fill-hover text-muted-foreground")}>
					<Trans>draft</Trans>
				</span>
			)}
			{status?.reviewDecision === "APPROVED" && (
				<span
					className={cn(
						badge,
						"bg-green-500/15 text-green-600 dark:text-green-400",
					)}
				>
					<Trans>approved</Trans>
				</span>
			)}
			{status?.reviewDecision === "CHANGES_REQUESTED" && (
				<span
					className={cn(badge, "bg-red-500/15 text-red-600 dark:text-red-400")}
				>
					<Trans>changes requested</Trans>
				</span>
			)}
		</span>
	);
}
