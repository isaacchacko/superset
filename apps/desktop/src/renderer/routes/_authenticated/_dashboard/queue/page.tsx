import { createFileRoute } from "@tanstack/react-router";
import { QueueView } from "./components/QueueView";

export const Route = createFileRoute("/_authenticated/_dashboard/queue/")({
	component: QueueView,
});
