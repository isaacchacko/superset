import { useMemo, useState } from "react";
import { useHostProjects } from "renderer/hooks/host-projects/useHostProjects";
import { useHostUrl } from "renderer/hooks/host-service/useHostTargetUrl";
import { useProjectHost } from "renderer/routes/_authenticated/_dashboard/hooks/useProjectHost";
import { PullRequestDetailContent } from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestDetailContent";
import {
	type PullRequestDetailTab,
	PullRequestDetailTabs,
} from "renderer/routes/_authenticated/_dashboard/pull-requests/components/PullRequestDetailTabs";
import { usePullRequestDetail } from "renderer/routes/_authenticated/_dashboard/pull-requests/hooks/usePullRequestDetail";
import type { QueuePullRequest } from "shared/queue";
import { QueueItemCard } from "../../../QueueItemCard";

/** A surfaced PR: the agent's note and Isaac's answer box, above the Pull requests page's description and diff. */
export function QueuePullRequestDetail({
	pullRequest,
}: {
	pullRequest: QueuePullRequest;
}) {
	const { projects } = useHostProjects();
	// The Superset project for the PR's repository, so the host reads the diff.
	const projectId = useMemo(
		() =>
			projects.find(
				(project) =>
					`${project.repoOwner}/${project.repoName}`.toLowerCase() ===
					pullRequest.item.pr.repo.toLowerCase(),
			)?.projectKey ?? null,
		[projects, pullRequest.item.pr.repo],
	);
	const { hostId } = useProjectHost(projectId);
	const hostUrl = useHostUrl(hostId);
	const [activeTab, setActiveTab] = useState<PullRequestDetailTab>("summary");
	const detail = usePullRequestDetail({
		projectId,
		hostUrl,
		prNumber: pullRequest.item.pr.number,
		repoFullName: pullRequest.item.pr.repo,
	});
	const data = detail.data ?? null;
	const diffStat =
		data?.additions !== undefined && data.deletions !== undefined
			? { additions: data.additions, deletions: data.deletions }
			: null;

	return (
		<div className="flex min-h-0 min-w-0 flex-1 select-text flex-col">
			<div className="max-h-[45%] shrink-0 overflow-y-auto border-b p-3">
				<QueueItemCard item={pullRequest.item} />
			</div>
			<div className="flex h-10 shrink-0 items-center border-b px-3">
				<PullRequestDetailTabs
					activeTab={activeTab}
					onTabChange={setActiveTab}
					diffStat={diffStat}
				/>
			</div>
			<PullRequestDetailContent
				activeTab={activeTab}
				detail={detail}
				projectId={detail.projectId}
				repoFullName={detail.repoFullName}
				prNumber={pullRequest.item.pr.number}
				hostUrl={hostUrl}
				hostId={hostId}
				commentTarget={null}
			/>
		</div>
	);
}
