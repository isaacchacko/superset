import { describe, expect, it } from "bun:test";
import type { PaneStatus } from "shared/tabs-types";
import {
	matchLeaderSequence,
	nextFinishedAgent,
	normalModeAction,
} from "./vimBindings";

describe("vim keys", () => {
	it("maps normal-mode keys", () => {
		expect(normalModeAction("i")).toBe("focus-agent");
		expect(normalModeAction("j")).toBe("next-item");
		expect(normalModeAction("H")).toBe("prev-tab");
		expect(normalModeAction("L")).toBe("next-tab");
		expect(normalModeAction("h")).toBeNull();
		expect(normalModeAction("q")).toBeNull();
	});

	it("matches leader sequences, waiting on their prefixes", () => {
		expect(matchLeaderSequence(" ")).toBe("next-finished-agent");
		expect(matchLeaderSequence("q")).toBe("open-queue");
		expect(matchLeaderSequence("n")).toBe("new-terminal");
		expect(matchLeaderSequence("c")).toBe("pending");
		expect(matchLeaderSequence("cu")).toBe("copy-pr-url");
		expect(matchLeaderSequence("cn")).toBe("copy-pr-number");
		expect(matchLeaderSequence("p")).toBe("pending");
		expect(matchLeaderSequence("pm")).toBe("prmerge-pr");
		expect(matchLeaderSequence("cx")).toBeNull();
		expect(matchLeaderSequence("x")).toBeNull();
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
