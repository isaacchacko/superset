import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { PageHeader } from "renderer/routes/_authenticated/_dashboard/components/PageHeader";
import { partitionQueue } from "shared/queue";
import { QueueItemCard } from "./components/QueueItemCard";

export const QUEUE_REFRESH_MS = 3_000;
const ANSWERED_SHOWN = 20;

/** Decisions agents raised with `effort ask`, oldest first. */
export function QueueView() {
	const { data: items = [], isLoading } = electronTrpc.queue.list.useQuery(
		undefined,
		{ refetchInterval: QUEUE_REFRESH_MS },
	);
	const [showAnswered, setShowAnswered] = useState(false);
	const { waitingOnIsaac, waitingOnAgent, answered } = partitionQueue(items);

	return (
		<div className="flex h-full w-full flex-1 flex-col overflow-hidden">
			<PageHeader />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex w-full max-w-3xl flex-col px-8 pt-4 pb-12">
					<h1 className="font-semibold text-xl tracking-tight">
						<Trans>Queue</Trans>
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						<Trans>
							Decisions your agents are waiting on, oldest first. Decide, or ask
							a follow-up; the answer goes straight to the agent's terminal.
						</Trans>
					</p>

					<div className="mt-6 flex flex-col gap-3">
						{waitingOnIsaac.map((item, index) => (
							<QueueItemCard key={item.id} item={item} position={index + 1} />
						))}
						{!isLoading && waitingOnIsaac.length === 0 && (
							<div className="rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
								<Trans>Nothing is waiting on you.</Trans>
							</div>
						)}
					</div>

					{waitingOnAgent.length > 0 && (
						<section className="mt-8">
							<h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[0.075em]">
								<Trans>Waiting on the agent ({waitingOnAgent.length})</Trans>
							</h2>
							<div className="flex flex-col gap-2">
								{waitingOnAgent.map((item) => (
									<QueueItemCard key={item.id} item={item} />
								))}
							</div>
						</section>
					)}

					{answered.length > 0 && (
						<section className="mt-8">
							<button
								type="button"
								onClick={() => setShowAnswered((shown) => !shown)}
								className="mb-2 flex items-center gap-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.075em] hover:text-foreground"
							>
								<LuChevronRight
									className={`size-3.5 transition-transform ${showAnswered ? "rotate-90" : ""}`}
								/>
								<Trans>Answered ({answered.length})</Trans>
							</button>
							{showAnswered && (
								<div className="flex flex-col gap-2">
									{answered.slice(0, ANSWERED_SHOWN).map((item) => (
										<QueueItemCard key={item.id} item={item} />
									))}
								</div>
							)}
						</section>
					)}
				</div>
			</div>
		</div>
	);
}
