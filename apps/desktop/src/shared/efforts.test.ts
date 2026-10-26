import { describe, expect, it } from "bun:test";
import {
	effortSlugFromTag,
	findEffortTag,
	isEffortChildWorkspace,
	parseEffortDetails,
	summarizeEffortChildren,
} from "./efforts";

describe("effortSlugFromTag", () => {
	it("strips one prefix, as the effort CLI writes it", () => {
		expect(effortSlugFromTag("effort-fix-bundle-send")).toBe("fix-bundle-send");
		expect(effortSlugFromTag("effort-effort-demo")).toBe("effort-demo");
	});

	it("rejects tags that are not efforts or whose slug could escape the efforts home", () => {
		expect(effortSlugFromTag("automation")).toBeNull();
		expect(effortSlugFromTag("effort-")).toBeNull();
		expect(effortSlugFromTag("effort-../etc")).toBeNull();
		expect(effortSlugFromTag("effort-two words")).toBeNull();
	});
});

describe("findEffortTag", () => {
	it("picks the smallest normalized effort tag", () => {
		expect(findEffortTag(["Review", " effort-Zeta ", "effort-alpha"])).toBe(
			"effort-alpha",
		);
		expect(findEffortTag(["review"])).toBeNull();
		expect(findEffortTag(undefined)).toBeNull();
	});
});

describe("isEffortChildWorkspace", () => {
	it("suppresses alerts from a child worktree of an effort", () => {
		expect(
			isEffortChildWorkspace({ type: "worktree", tags: ["effort-demo"] }),
		).toBe(true);
		expect(
			isEffortChildWorkspace({ type: "local", tags: ["effort-demo"] }),
		).toBe(true);
	});

	it("lets the sentinel and workspaces outside any effort alert", () => {
		expect(
			isEffortChildWorkspace({ type: "session", tags: ["effort-demo"] }),
		).toBe(false);
		expect(isEffortChildWorkspace({ type: "worktree", tags: ["demo"] })).toBe(
			false,
		);
		expect(isEffortChildWorkspace({ type: "worktree", tags: null })).toBe(
			false,
		);
	});
});

describe("summarizeEffortChildren", () => {
	it("counts working, needs-attention and done children", () => {
		expect(
			summarizeEffortChildren([
				"working",
				"working",
				"permission",
				"failed",
				"review",
				null,
			]),
		).toEqual({ working: 2, needsAttention: 2, done: 1 });
	});
});

describe("parseEffortDetails", () => {
	it("reads the name, PRs and tasks the effort CLI writes", () => {
		const details = parseEffortDetails({
			slug: "demo",
			effortJson: {
				version: 1,
				name: "Bundle send blocked by autosave",
				prs: [{ number: 10812, state: "OPEN" }, { number: 8373 }],
			},
			tasksJson: [
				{ id: "t1", title: "Write the fix", status: "doing", owner: "api" },
				{ id: "t2", title: "Odd status", status: "paused" },
				{ title: "no id" },
			],
		});

		expect(details.name).toBe("Bundle send blocked by autosave");
		expect(details.pullRequestNumbers).toEqual([8373, 10812]);
		expect(details.tasks.map((task) => [task.id, task.status])).toEqual([
			["t1", "doing"],
			["t2", "todo"],
		]);
	});

	it("falls back to empty details when the files are missing or torn", () => {
		expect(
			parseEffortDetails({ slug: "demo", effortJson: null, tasksJson: "{" }),
		).toEqual({
			slug: "demo",
			name: null,
			closed: false,
			pullRequestNumbers: [],
			tasks: [],
		});
	});
});
