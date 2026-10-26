import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "@superset/ui/button";
import { toast } from "@superset/ui/sonner";
import { Textarea } from "@superset/ui/textarea";
import { cn } from "@superset/ui/utils";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LuArrowUpRight } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import type { QueueAnswerKind, QueueItem } from "shared/queue";

interface QueueItemCardProps {
	item: QueueItem;
	/** Place in the queue, for the items waiting on Isaac. */
	position?: number;
}

export function QueueItemCard({ item, position }: QueueItemCardProps) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const utils = electronTrpc.useUtils();
	const [draft, setDraft] = useState("");
	const answer = electronTrpc.queue.answer.useMutation({
		onSuccess: () => {
			setDraft("");
			utils.queue.list.invalidate();
		},
		onError: (error) =>
			toast.error(t({ message: "The answer didn't reach the agent" }), {
				description: error.message,
			}),
	});
	const isOpen = item.status === "open";
	const raisedAtMs = Number.parseInt(item.id.split("-")[1] ?? "0", 16);
	const send = (kind: QueueAnswerKind) => {
		if (!draft.trim() || answer.isPending) return;
		answer.mutate({ id: item.id, kind, text: draft });
	};

	return (
		<article
			className={cn(
				"rounded-lg border bg-card px-4 py-3",
				!isOpen && "bg-transparent opacity-80",
			)}
		>
			<header className="flex items-center gap-2 text-muted-foreground text-xs">
				{position !== undefined && (
					<span className="flex size-5 items-center justify-center rounded-full bg-fill-hover font-medium tabular-nums text-foreground">
						{position}
					</span>
				)}
				<span className="min-w-0 truncate font-medium text-foreground">
					{item.asker.label}
				</span>
				<span title={item.raisedAt}>{formatRelativeTime(raisedAtMs)}</span>
				<button
					type="button"
					onClick={() =>
						navigate({
							to: "/v2-workspace/$workspaceId",
							params: { workspaceId: item.asker.workspace },
						})
					}
					className="ml-auto flex items-center gap-0.5 hover:text-foreground"
				>
					<Trans>Open agent</Trans>
					<LuArrowUpRight className="size-3" />
				</button>
			</header>

			<p className="mt-2 whitespace-pre-wrap font-medium text-[15px] leading-snug">
				{item.question}
			</p>
			{item.details && (
				<p className="mt-1.5 whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
					{item.details}
				</p>
			)}

			{item.thread.length > 0 && (
				<ol className="mt-3 flex flex-col gap-1.5 border-l-2 pl-3 text-sm">
					{item.thread.map((entry) => (
						<li
							key={`${entry.at}-${entry.kind}`}
							className="whitespace-pre-wrap"
						>
							<span className="font-medium text-muted-foreground">
								{entry.kind === "decision"
									? t({ message: "You decided:" })
									: entry.kind === "followup"
										? t({ message: "You asked:" })
										: entry.kind === "withdrawn"
											? t({ message: "The agent withdrew it:" })
											: entry.from === "github"
												? t({ message: "GitHub:" })
												: t({ message: "Agent:" })}
							</span>{" "}
							{entry.text}
						</li>
					))}
				</ol>
			)}

			{isOpen && (
				<div className="mt-3 flex flex-col gap-2">
					<Textarea
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								send("decision");
							}
						}}
						placeholder={t({
							message: "Your decision, or a follow-up question",
						})}
						rows={3}
						className="resize-y text-sm"
					/>
					<div className="flex items-center justify-end gap-2">
						<span className="mr-auto text-muted-foreground text-xs">
							<Trans>⌘↩ sends it as your decision</Trans>
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={!draft.trim() || answer.isPending}
							onClick={() => send("followup")}
						>
							<Trans>Ask follow-up</Trans>
						</Button>
						<Button
							size="sm"
							disabled={!draft.trim() || answer.isPending}
							onClick={() => send("decision")}
							title={t({ message: "Decide (⌘↩)" })}
						>
							<Trans>Decide</Trans>
						</Button>
					</div>
				</div>
			)}
		</article>
	);
}
