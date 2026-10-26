import { describe, expect, it } from "bun:test";
import type { PaneStatus } from "shared/tabs-types";
import { nextFinishedAgent, vimActionFor } from "./vimBindings";

describe("vimActionFor", () => {
	it("maps i and the Space leader", () => {
		expect(vimActionFor("i", false)).toBe("focus-agent");
		expect(vimActionFor(" ", false)).toBe("leader");
		expect(vimActionFor("q", true)).toBe("open-queue");
		expect(vimActionFor("a", true)).toBe("open-agent");
		expect(vimActionFor(" ", true)).toBe("next-finished-agent");
		expect(vimActionFor("q", false)).toBeNull();
		expect(vimActionFor("x", true)).toBeNull();
	});
});

describe("nextFinishedAgent", () => {
	const statuses: Record<string, [string, PaneStatus][]> = {
		a: [["t-a", "review"]],
		b: [["t-b", "working"]],
		c: [
			["t-c1", "idle"],
			["t-c2", "review"],
		],
	};
	const lookup = (workspaceId: string) => new Map(statuses[workspaceId] ?? []);

	it("finds the next finished agent after the active workspace, wrapping", () => {
		expect(nextFinishedAgent(["a", "b", "c"], lookup, "a")).toEqual({
			workspaceId: "c",
			terminalId: "t-c2",
		});
		expect(nextFinishedAgent(["a", "b", "c"], lookup, "c")).toEqual({
			workspaceId: "a",
			terminalId: "t-a",
		});
		expect(nextFinishedAgent(["a", "b", "c"], lookup, null)?.workspaceId).toBe(
			"a",
		);
	});

	it("comes back to the active workspace's own finished agent last, and is null when none", () => {
		expect(nextFinishedAgent(["a", "b"], lookup, "a")).toEqual({
			workspaceId: "a",
			terminalId: "t-a",
		});
		expect(nextFinishedAgent(["b"], lookup, null)).toBeNull();
	});
});
