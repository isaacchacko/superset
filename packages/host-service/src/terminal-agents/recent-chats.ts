import type { Dirent } from "node:fs";
import { open, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { isNull } from "drizzle-orm";
import type { HostDb } from "../db";
import { terminalAgentBindings, workspaces } from "../db/schema";

/** Enough of a session's start for its working directory and first prompt. */
const HEAD_BYTES = 256 * 1024;
/** Enough of its end for the newest title and prompt. */
const TAIL_BYTES = 256 * 1024;
const PROMPT_CHARS = 300;
/** Files read at once. */
const READ_CONCURRENCY = 32;

/** A Claude Code chat, as its transcript tells it. */
export interface RecentChat {
	sessionId: string;
	/**
	 * The CLAUDE_CONFIG_DIR a resume must use, or null when several accounts
	 * share the sessions folder that holds it and any of them can.
	 */
	configDir: string | null;
	cwd: string;
	branch: string | null;
	title: string;
	firstPrompt: string | null;
	lastPrompt: string | null;
	updatedAt: number;
}

interface TranscriptRecord {
	type?: string;
	cwd?: string;
	gitBranch?: string;
	entrypoint?: string;
	isSidechain?: boolean;
	message?: { content?: unknown };
	aiTitle?: string;
	customTitle?: string;
	lastPrompt?: string;
}

/**
 * The sessions folders under ~/.claude and every ~/.claude-<account>, once
 * each: accounts often share one through a symlink. `configDir` is null for a
 * shared one.
 */
async function sessionFolders(
	home: string,
): Promise<{ projects: string; configDir: string | null }[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(home, { withFileTypes: true });
	} catch {
		return [];
	}
	const owners = new Map<string, string[]>();
	for (const entry of entries) {
		if (!entry.isDirectory() || !/^\.claude(-[\w.-]+)?$/.test(entry.name)) {
			continue;
		}
		const configDir = join(home, entry.name);
		try {
			const projects = await realpath(join(configDir, "projects"));
			owners.set(projects, [...(owners.get(projects) ?? []), configDir]);
		} catch {}
	}
	return [...owners].map(([projects, configDirs]) => ({
		projects,
		configDir: configDirs.length === 1 ? (configDirs[0] ?? null) : null,
	}));
}

/** Top-level session files only: a session's subagents live in folders beside it. */
async function sessionFiles(
	projects: string,
): Promise<{ path: string; sessionId: string }[]> {
	let dirs: string[];
	try {
		dirs = await readdir(projects);
	} catch {
		return [];
	}
	const files = await Promise.all(
		dirs.map(async (dir) => {
			try {
				return (await readdir(join(projects, dir)))
					.filter((name) => name.endsWith(".jsonl"))
					.map((name) => ({
						path: join(projects, dir, name),
						sessionId: name.slice(0, -".jsonl".length),
					}));
			} catch {
				return [];
			}
		}),
	);
	return files.flat();
}

async function readSlice(
	path: string,
	from: "head" | "tail",
	bytes: number,
): Promise<TranscriptRecord[]> {
	const file = await open(path, "r");
	try {
		const { size } = await file.stat();
		const start = from === "head" ? 0 : Math.max(0, size - bytes);
		const length = Math.min(bytes, size - start);
		const buffer = Buffer.alloc(length);
		await file.read(buffer, 0, length, start);
		const lines = buffer.toString("utf8").split("\n");
		// A line the slice cut through doesn't parse; drop it rather than try.
		if (start > 0) lines.shift();
		if (start + length < size) lines.pop();
		const records: TranscriptRecord[] = [];
		for (const line of lines) {
			if (!line) continue;
			try {
				records.push(JSON.parse(line));
			} catch {}
		}
		return records;
	} finally {
		await file.close();
	}
}

function promptText(content: unknown): string | null {
	const text =
		typeof content === "string"
			? content
			: Array.isArray(content)
				? content
						.filter((part) => part?.type === "text")
						.map((part) => part.text)
						.join("\n")
				: "";
	const trimmed = text.trim();
	// Command wrappers, hook output and reminders aren't what anyone typed.
	if (!trimmed || trimmed.startsWith("<")) return null;
	return trimmed.slice(0, PROMPT_CHARS);
}

export function chatFromRecords(
	head: TranscriptRecord[],
	tail: TranscriptRecord[],
): Omit<RecentChat, "sessionId" | "configDir" | "updatedAt"> | null {
	const start = head.find((record) => record.cwd);
	// `claude -p` runs from scripts aren't chats anyone opens again.
	if (!start?.cwd || start.entrypoint === "sdk-cli") return null;
	const firstPrompt =
		head
			.filter((record) => record.type === "user" && !record.isSidechain)
			.map((record) => promptText(record.message?.content))
			.find((prompt) => prompt !== null) ?? null;
	const newestFirst = [...head, ...tail].reverse();
	const newest = <K extends keyof TranscriptRecord>(key: K) =>
		newestFirst.find((record) => record[key])?.[key];
	const lastPrompt = newest("lastPrompt");
	return {
		cwd: newest("cwd") ?? start.cwd,
		branch: newest("gitBranch") ?? null,
		title:
			newest("customTitle") ??
			newest("aiTitle") ??
			firstPrompt?.split("\n")[0] ??
			"Untitled chat",
		firstPrompt,
		lastPrompt: lastPrompt ? lastPrompt.slice(0, PROMPT_CHARS) : null,
	};
}

/** Claude Code chats written since `since` (epoch ms), newest first. */
export async function readRecentClaudeChats(
	since: number,
	home: string = homedir(),
): Promise<RecentChat[]> {
	const candidates: {
		path: string;
		sessionId: string;
		configDir: string | null;
		updatedAt: number;
	}[] = [];
	for (const { projects, configDir } of await sessionFolders(home)) {
		const files = await sessionFiles(projects);
		const stats = await Promise.all(
			files.map((file) => stat(file.path).catch(() => null)),
		);
		for (const [index, file] of files.entries()) {
			const mtime = stats[index]?.mtimeMs;
			if (mtime !== undefined && mtime >= since) {
				candidates.push({ ...file, configDir, updatedAt: mtime });
			}
		}
	}
	candidates.sort((a, b) => b.updatedAt - a.updatedAt);

	const chats: RecentChat[] = [];
	for (let i = 0; i < candidates.length; i += READ_CONCURRENCY) {
		const batch = await Promise.all(
			candidates.slice(i, i + READ_CONCURRENCY).map(async (candidate) => {
				try {
					const [head, tail] = await Promise.all([
						readSlice(candidate.path, "head", HEAD_BYTES),
						readSlice(candidate.path, "tail", TAIL_BYTES),
					]);
					const chat = chatFromRecords(head, tail);
					if (!chat) return null;
					return {
						sessionId: candidate.sessionId,
						configDir: candidate.configDir,
						updatedAt: candidate.updatedAt,
						...chat,
					};
				} catch {
					return null;
				}
			}),
		);
		for (const chat of batch) if (chat) chats.push(chat);
	}
	return chats;
}

export interface RecentChatWithPlace extends RecentChat {
	/** The terminal its agent is running in now, if it is. */
	live: { workspaceId: string; terminalId: string } | null;
	/** The workspace whose folder holds its working directory, if one does. */
	workspace: { id: string; name: string } | null;
}

/** Recent chats, each with where it runs now or the workspace it belongs to. */
export async function recentChatsWithPlaces(
	db: HostDb,
	since: number,
): Promise<RecentChatWithPlace[]> {
	const chats = await readRecentClaudeChats(since);
	const live = new Map(
		db
			.select({
				sessionId: terminalAgentBindings.agentSessionId,
				workspaceId: terminalAgentBindings.workspaceId,
				terminalId: terminalAgentBindings.terminalId,
			})
			.from(terminalAgentBindings)
			.where(isNull(terminalAgentBindings.endedAt))
			.all()
			.map(({ sessionId, ...place }) => [sessionId, place]),
	);
	const rows = db
		.select({
			id: workspaces.id,
			name: workspaces.name,
			path: workspaces.worktreePath,
		})
		.from(workspaces)
		.all()
		// The deepest folder wins: a worktree can sit inside a project's checkout.
		.sort((a, b) => b.path.length - a.path.length);
	const workspaceFor = (cwd: string) =>
		rows.find((row) => cwd === row.path || cwd.startsWith(row.path + sep));
	return chats.map((chat) => {
		const place = live.get(chat.sessionId) ?? null;
		const row = place
			? rows.find((candidate) => candidate.id === place.workspaceId)
			: workspaceFor(chat.cwd);
		return {
			...chat,
			live: place,
			workspace: row ? { id: row.id, name: row.name } : null,
		};
	});
}
