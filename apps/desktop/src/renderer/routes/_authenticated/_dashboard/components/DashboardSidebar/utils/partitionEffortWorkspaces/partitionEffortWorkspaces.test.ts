import { describe, expect, it } from "bun:test";
import type { DashboardSidebarProjectChild } from "../../types";
import {
	makeProject,
	makeSection,
	makeWorkspace,
} from "../testProjectFixtures";
import { partitionEffortWorkspaces } from "./partitionEffortWorkspaces";

const sentinel = makeWorkspace({
	id: "sentinel",
	name: "sentinel",
	type: "session",
	projectId: null,
	createdAt: new Date("2026-10-25T10:00:00Z"),
});
const childA = makeWorkspace({
	id: "child-a",
	name: "child-a",
	createdAt: new Date("2026-10-25T10:01:00Z"),
});
const childB = makeWorkspace({
	id: "child-b",
	name: "child-b",
	projectId: "project-2",
	createdAt: new Date("2026-10-25T10:02:00Z"),
});
const plainSession = makeWorkspace({
	id: "plain-session",
	name: "plain-session",
	type: "session",
	projectId: null,
});
const plainWorktree = makeWorkspace({ id: "plain", name: "plain" });

const tags: Record<string, string[]> = {
	sentinel: ["effort-demo"],
	"child-a": ["effort-demo"],
	"child-b": ["effort-demo", "review"],
	"plain-session": ["scratch"],
};
const tagsOf = (id: string) => tags[id];

function sessionLane(): DashboardSidebarProjectChild[] {
	return [
		{
			type: "section",
			section: makeSection({
				id: "sessions:effort-demo",
				name: "effort-demo",
				projectId: "sessions",
				workspaces: [sentinel],
			}),
		},
		{ type: "workspace", workspace: plainSession },
	];
}

describe("partitionEffortWorkspaces", () => {
	it("gathers one effort across the Sessions lane and several projects, sentinel first", () => {
		const projectOne = makeProject({
			id: "project-1",
			name: "app",
			children: [
				{
					type: "section",
					section: makeSection({
						id: "project-1:effort-demo",
						name: "effort-demo",
						workspaces: [childA],
					}),
				},
				{ type: "workspace", workspace: plainWorktree },
			],
		});
		const projectTwo = makeProject({
			id: "project-2",
			name: "api",
			children: [{ type: "workspace", workspace: childB }],
		});

		const result = partitionEffortWorkspaces({
			groups: [projectOne, projectTwo],
			sessionChildren: sessionLane(),
			sessionWorkspaces: [sentinel, plainSession],
			tagsOf,
		});

		expect(result.efforts).toHaveLength(1);
		const [effort] = result.efforts;
		expect(effort?.slug).toBe("demo");
		expect(effort?.sentinel?.id).toBe("sentinel");
		expect(
			effort?.children.map((child) => [child.workspace.id, child.projectName]),
		).toEqual([
			["child-a", "app"],
			["child-b", "api"],
		]);

		expect(result.groups[0]?.children).toEqual([
			{ type: "workspace", workspace: plainWorktree },
		]);
		expect(result.groups[1]?.children).toEqual([]);
		expect(result.sessionChildren).toEqual([
			{ type: "workspace", workspace: plainSession },
		]);
		expect(result.sessionWorkspaces).toEqual([plainSession]);
	});

	it("returns every input by identity when no workspace is in an effort", () => {
		const groups = [
			makeProject({
				id: "project-1",
				name: "app",
				children: [{ type: "workspace", workspace: plainWorktree }],
			}),
		];
		const sessionChildren: DashboardSidebarProjectChild[] = [
			{ type: "workspace", workspace: plainSession },
		];
		const sessionWorkspaces = [plainSession];

		const result = partitionEffortWorkspaces({
			groups,
			sessionChildren,
			sessionWorkspaces,
			tagsOf,
		});

		expect(result.efforts).toEqual([]);
		expect(result.groups).toBe(groups);
		expect(result.sessionChildren).toBe(sessionChildren);
		expect(result.sessionWorkspaces).toBe(sessionWorkspaces);
	});

	it("keeps an effort without a visible sentinel, and keeps untouched projects by identity", () => {
		const untouched = makeProject({
			id: "project-2",
			name: "api",
			children: [{ type: "workspace", workspace: plainWorktree }],
		});
		const result = partitionEffortWorkspaces({
			groups: [
				makeProject({
					id: "project-1",
					name: "app",
					children: [{ type: "workspace", workspace: childA }],
				}),
				untouched,
			],
			sessionChildren: [],
			sessionWorkspaces: [],
			tagsOf,
		});

		expect(result.efforts[0]?.sentinel).toBeNull();
		expect(
			result.efforts[0]?.children.map((child) => child.workspace.id),
		).toEqual(["child-a"]);
		expect(result.groups[1]).toBe(untouched);
	});

	it("files a workspace with two effort tags under the smallest one only", () => {
		const both = makeWorkspace({ id: "both", name: "both" });
		const result = partitionEffortWorkspaces({
			groups: [
				makeProject({
					id: "project-1",
					name: "app",
					children: [{ type: "workspace", workspace: both }],
				}),
			],
			sessionChildren: [],
			sessionWorkspaces: [],
			tagsOf: () => ["effort-zeta", "effort-alpha"],
		});

		expect(result.efforts.map((effort) => effort.tag)).toEqual([
			"effort-alpha",
		]);
	});
});
