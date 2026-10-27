import { describe, expect, test } from "bun:test";
import type { DashboardSidebarWorkspace } from "../../types";
import type { SidebarEffort } from "../partitionEffortWorkspaces";
import { effortTeardown } from "./effortTeardown";

function workspace(id: string): DashboardSidebarWorkspace {
	return { id, name: `${id} name` } as DashboardSidebarWorkspace;
}

const efforts: SidebarEffort[] = [
	{
		tag: "effort-faster-drafts",
		slug: "faster-drafts",
		sentinel: workspace("sentinel"),
		children: [
			{ workspace: workspace("a"), projectName: null, projectIconUrl: null },
			{ workspace: workspace("b"), projectName: null, projectIconUrl: null },
		],
	},
	{
		tag: "effort-orphans",
		slug: "orphans",
		sentinel: null,
		children: [
			{ workspace: workspace("c"), projectName: null, projectIconUrl: null },
		],
	},
];

describe("effortTeardown", () => {
	test("a sentinel takes its children with it, itself last", () => {
		const teardown = effortTeardown(efforts, "sentinel");
		expect(teardown?.targets.map((w) => w.id)).toEqual(["a", "b", "sentinel"]);
		expect(teardown?.effort).toEqual({
			slug: "faster-drafts",
			name: "sentinel name",
		});
	});

	test("a child or a workspace outside any effort deletes alone", () => {
		expect(effortTeardown(efforts, "a")).toBeNull();
		expect(effortTeardown(efforts, "c")).toBeNull();
		expect(effortTeardown(efforts, "elsewhere")).toBeNull();
	});
});
