import { createFileRoute } from "@tanstack/react-router";
import { QueueView } from "./components/QueueView";

export type QueueTab = "decisions" | "prs";

export const Route = createFileRoute("/_authenticated/_dashboard/queue/")({
	component: QueuePage,
	validateSearch: (search: Record<string, unknown>): { tab?: QueueTab } => ({
		tab: search.tab === "prs" ? "prs" : undefined,
	}),
});

function QueuePage() {
	const { tab } = Route.useSearch();
	const navigate = Route.useNavigate();
	return (
		<QueueView
			tab={tab ?? "decisions"}
			onTabChange={(next) =>
				navigate({
					search: { tab: next === "prs" ? "prs" : undefined },
					replace: true,
				})
			}
		/>
	);
}
