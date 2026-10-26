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

/** The Pull requests page's description and diff views, for one Queue PR. */
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
					pullRequest.repo.toLowerCase(),
			)?.projectKey ?? null,
		[projects, pullRequest.repo],
	);
	const { hostId } = useProjectHost(projectId);
	const hostUrl = useHostUrl(hostId);
	const [activeTab, setActiveTab] = useState<PullRequestDetailTab>("summary");
	const detail = usePullRequestDetail({
		projectId,
		hostUrl,
		prNumber: pullRequest.number,
		repoFullName: pullRequest.repo,
	});
	const data = detail.data ?? null;
	const diffStat =
		data?.additions !== undefined && data.deletions !== undefined
			? { additions: data.additions, deletions: data.deletions }
			: null;

	return (
		<div className="flex min-h-0 min-w-0 flex-1 select-text flex-col">
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
				prNumber={pullRequest.number}
				hostUrl={hostUrl}
				hostId={hostId}
				commentTarget={null}
			/>
		</div>
	);
}
