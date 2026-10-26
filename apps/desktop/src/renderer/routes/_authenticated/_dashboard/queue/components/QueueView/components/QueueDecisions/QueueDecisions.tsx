import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import { partitionQueue, type QueueItem } from "shared/queue";
import { QueueItemCard } from "../QueueItemCard";

const ANSWERED_SHOWN = 20;

/** Decisions agents raised with `effort ask`: the ones waiting on Isaac first, oldest first. */
export function QueueDecisions({ items }: { items: QueueItem[] }) {
	const [showAnswered, setShowAnswered] = useState(false);
	const { waitingOnIsaac, waitingOnAgent, answered } = partitionQueue(items);

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="mx-auto flex w-full max-w-3xl flex-col px-8 pt-1 pb-12">
				<p className="text-muted-foreground text-sm">
					<Trans>
						Decide, or ask a follow-up; the answer goes straight to the agent's
						terminal.
					</Trans>
				</p>

				<div className="mt-4 flex flex-col gap-3">
					{waitingOnIsaac.map((item, index) => (
						<QueueItemCard key={item.id} item={item} position={index + 1} />
					))}
					{waitingOnIsaac.length === 0 && (
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
	);
}
