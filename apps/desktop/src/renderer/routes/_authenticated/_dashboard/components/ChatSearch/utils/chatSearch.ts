import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";

const HOUR_MS = 60 * 60 * 1_000;

/** How far back Cmd+K looks; Tab widens it, Shift+Tab narrows it. */
export const CHAT_RANGES: { label: MessageDescriptor; ms: number | null }[] = [
	{ label: msg({ message: "24h" }), ms: 24 * HOUR_MS },
	{ label: msg({ message: "7 days" }), ms: 7 * 24 * HOUR_MS },
	{ label: msg({ message: "30 days" }), ms: 30 * 24 * HOUR_MS },
	{ label: msg({ message: "All" }), ms: null },
];

export interface SearchableChat {
	title: string;
	branch: string | null;
	cwd: string;
	firstPrompt: string | null;
	lastPrompt: string | null;
}

/** Chats holding every word of the query, in the order given (newest first). */
export function filterChats<T extends SearchableChat>(
	chats: readonly T[],
	query: string,
	workspaceName: (chat: T) => string | null,
): T[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [...chats];
	return chats.filter((chat) => {
		const text = [
			chat.title,
			workspaceName(chat),
			chat.branch,
			chat.cwd,
			chat.firstPrompt,
			chat.lastPrompt,
		]
			.join(" ")
			.toLowerCase();
		return words.every((word) => text.includes(word));
	});
}
