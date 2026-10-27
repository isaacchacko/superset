import { describe, expect, it } from "bun:test";
import { filterChats } from "./chatSearch";

const chat = (title: string, extra: Partial<Parameters<typeof filterChats>[0][number]> = {}) => ({
	title,
	branch: null,
	cwd: "/w",
	firstPrompt: null,
	lastPrompt: null,
	...extra,
});

describe("filterChats", () => {
	const chats = [
		chat("Sidebar fix", { branch: "isaac/sidebar" }),
		chat("Bundle drafting", { lastPrompt: "make it faster" }),
		chat("Queue page"),
	];
	const names = (id: string | null) => () => id;

	it("keeps every chat, in order, for an empty query", () => {
		expect(filterChats(chats, "  ", names(null))).toEqual(chats);
	});

	it("needs every word, anywhere in the chat", () => {
		expect(
			filterChats(chats, "bundle FASTER", names(null)).map((c) => c.title),
		).toEqual(["Bundle drafting"]);
		expect(filterChats(chats, "isaac/sidebar", names(null))).toHaveLength(1);
		expect(
			filterChats(chats, "vector", (c) =>
				c.title === "Queue page" ? "Vector" : null,
			).map((c) => c.title),
		).toEqual(["Queue page"]);
	});
});
