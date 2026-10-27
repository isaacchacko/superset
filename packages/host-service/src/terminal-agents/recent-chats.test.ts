import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chatFromRecords, readRecentClaudeChats } from "./recent-chats";

describe("chatFromRecords", () => {
	it("titles a chat by its newest title, else what was first typed", () => {
		const head = [
			{ type: "user", cwd: "/w", entrypoint: "cli", gitBranch: "a" },
			{ type: "user", message: { content: "<command-name>/clear" } },
			{ type: "user", message: { content: "fix the sidebar\nplease" } },
			{ type: "ai-title", aiTitle: "Old title" },
		];
		const tail = [
			{ type: "ai-title", aiTitle: "Sidebar fix" },
			{ type: "last-prompt", lastPrompt: "ship it" },
			{ type: "user", cwd: "/w/sub", gitBranch: "b" },
		];
		expect(chatFromRecords(head, tail)).toEqual({
			cwd: "/w/sub",
			branch: "b",
			title: "Sidebar fix",
			firstPrompt: "fix the sidebar\nplease",
			lastPrompt: "ship it",
		});
		expect(chatFromRecords(head.slice(0, 3), [])?.title).toBe(
			"fix the sidebar",
		);
		expect(
			chatFromRecords(
				[...head, { type: "custom-title", customTitle: "Mine" }],
				tail,
			)?.title,
		).toBe("Mine");
	});

	it("skips scripted `claude -p` runs", () => {
		expect(
			chatFromRecords([{ type: "user", cwd: "/w", entrypoint: "sdk-cli" }], []),
		).toBeNull();
	});

	it("skips an effort's children, keeping its sentinel", () => {
		const opening = (content: string) => [
			{ type: "user", cwd: "/w", entrypoint: "cli", message: { content } },
		];
		expect(
			chatFromRecords(
				opening(
					'You are "alpha", a child agent in the effort "Demo" (slug demo).',
				),
				[],
			),
		).toBeNull();
		expect(
			chatFromRecords(
				opening('You are the sentinel of the effort "Demo" (slug demo).'),
				[],
			),
		).not.toBeNull();
	});
});

describe("readRecentClaudeChats", () => {
	it("reads a shared sessions folder once, pinning no account", async () => {
		const home = mkdtempSync(join(tmpdir(), "recent-chats-"));
		const projects = join(home, ".claude", "projects", "-w");
		mkdirSync(projects, { recursive: true });
		mkdirSync(join(home, ".claude-work"));
		symlinkSync(
			join(home, ".claude", "projects"),
			join(home, ".claude-work", "projects"),
		);
		mkdirSync(join(home, ".claude-solo", "projects", "-v"), {
			recursive: true,
		});
		const line = (cwd: string) =>
			`${JSON.stringify({ type: "user", cwd, entrypoint: "cli", message: { content: "hi" } })}\n`;
		writeFileSync(join(projects, "s1.jsonl"), line("/w"));
		writeFileSync(
			join(home, ".claude-solo", "projects", "-v", "s2.jsonl"),
			line("/v"),
		);

		const chats = await readRecentClaudeChats(0, home);
		expect(
			chats
				.map(({ sessionId, configDir }) => ({ sessionId, configDir }))
				.sort((a, b) => a.sessionId.localeCompare(b.sessionId)),
		).toEqual([
			{ sessionId: "s1", configDir: null },
			{ sessionId: "s2", configDir: join(home, ".claude-solo") },
		]);
	});
});
