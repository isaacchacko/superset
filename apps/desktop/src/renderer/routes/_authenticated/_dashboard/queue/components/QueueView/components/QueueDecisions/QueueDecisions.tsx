import { Trans } from "@lingui/react/macro";
import { useRef, useState } from "react";
import { LuChevronRight } from "react-icons/lu";
import { partitionQueue, type QueueItem } from "shared/queue";
import { QueueItemCard } from "../QueueItemCard";

const SETTLED_SHOWN = 20;

/** Decisions agents raised with `effort ask`: the ones waiting on Isaac first, oldest first. */
export function QueueDecisions({ items }: { items: QueueItem[] }) {
	const [showAnswered, setShowAnswered] = useState(false);
	// Every item shown as waiting on Isaac keeps its place until he leaves the
	// page, even once he or its agent settles it: nothing moves while he reads.
	const pinned = useRef(new Set<string>());
	for (const item of items) {
		if (item.status === "open") pinned.current.add(item.id);
	}
	const { waitingOnIsaac, waitingOnAgent, settled } = partitionQueue(
		items,
		pinned.current,
	);
	const openPositions = new Map(
		waitingOnIsaac
			.filter((item) => item.status === "open")
			.map((item, index) => [item.id, index + 1]),
	);

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
					{waitingOnIsaac.map((item) => (
						<QueueItemCard
							key={item.id}
							item={item}
							position={openPositions.get(item.id)}
						/>
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

				{settled.length > 0 && (
					<section className="mt-8">
						<button
							type="button"
							onClick={() => setShowAnswered((shown) => !shown)}
							className="mb-2 flex items-center gap-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.075em] hover:text-foreground"
						>
							<LuChevronRight
								className={`size-3.5 transition-transform ${showAnswered ? "rotate-90" : ""}`}
							/>
							<Trans>Settled ({settled.length})</Trans>
						</button>
						{showAnswered && (
							<div className="flex flex-col gap-2">
								{settled.slice(0, SETTLED_SHOWN).map((item) => (
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
