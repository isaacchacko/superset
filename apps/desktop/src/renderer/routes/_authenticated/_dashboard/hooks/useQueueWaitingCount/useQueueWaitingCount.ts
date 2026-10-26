import { electronTrpc } from "renderer/lib/electron-trpc";
import { QUEUE_REFRESH_MS } from "renderer/routes/_authenticated/_dashboard/queue/components/QueueView";

/** How many Queue items wait on Isaac, for the sidebar badge. */
export function useQueueWaitingCount(): number {
	const { data: items = [] } = electronTrpc.queue.list.useQuery(undefined, {
		refetchInterval: QUEUE_REFRESH_MS,
	});
	return items.filter((item) => item.status === "open").length;
}
