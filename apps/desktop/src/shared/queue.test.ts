import { describe, expect, it } from "bun:test";
import { parseQueueItem, partitionQueue, type QueueItem } from "./queue";

function item(id: string, status: QueueItem["status"]): QueueItem {
	const parsed = parseQueueItem({
		id,
		raisedAt: "2026-10-26T13:00:00-0500",
		status,
		asker: {
			device: "macbook",
			workspace: "ws-1",
			terminal: "t-1",
			label: "Demo",
		},
		question: `question ${id}`,
	});
	if (!parsed) throw new Error(`bad fixture ${id}`);
	return parsed;
}

describe("parseQueueItem", () => {
	it("fills the optional fields and rejects a malformed item", () => {
		const parsed = item("q-1a0-aa", "open");
		expect(parsed.details).toBe("");
		expect(parsed.thread).toEqual([]);
		expect(parseQueueItem({ id: "../etc", status: "open" })).toBeNull();
	});
});

describe("partitionQueue", () => {
	it("puts the longest-waiting question first, even within one second", () => {
		const sections = partitionQueue([
			item("q-1a2-cc", "open"),
			item("q-1a0-aa", "open"),
			item("q-1a1-bb", "followup"),
			item("q-1a3-dd", "answered"),
			item("q-19f-ee", "answered"),
		]);
		expect(sections.waitingOnIsaac.map((i) => i.id)).toEqual([
			"q-1a0-aa",
			"q-1a2-cc",
		]);
		expect(sections.waitingOnAgent.map((i) => i.id)).toEqual(["q-1a1-bb"]);
		expect(sections.settled.map((i) => i.id)).toEqual(["q-1a3-dd", "q-19f-ee"]);
	});

	it("keeps an item it showed as waiting in place after it's settled", () => {
		const sections = partitionQueue(
			[item("q-1a0-aa", "withdrawn"), item("q-1a2-cc", "open")],
			new Set(["q-1a0-aa"]),
		);
		expect(sections.waitingOnIsaac.map((i) => i.id)).toEqual([
			"q-1a0-aa",
			"q-1a2-cc",
		]);
		expect(sections.settled).toEqual([]);
	});
});
