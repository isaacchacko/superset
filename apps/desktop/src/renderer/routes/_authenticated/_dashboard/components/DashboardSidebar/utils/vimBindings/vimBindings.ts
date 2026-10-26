import type { PaneStatus } from "shared/tabs-types";

/**
 * Vim-like bindings. Insert mode is any focused text field, agent terminals
 * included; normal mode is everything else, where single keys are commands and
 * Space is the leader.
 */
export const VIM_LEADER_TIMEOUT_MS = 1_500;

/** Actions a page carries out on its own selection, sent as VIM_PAGE_ACTION_EVENT. */
export type VimPageAction =
	| "copy-pr-url"
	| "copy-pr-number"
	| "prmerge-pr"
	| "next-item"
	| "prev-item";

export type VimAction =
	| "focus-agent"
	| "open-queue"
	| "open-agent"
	| "next-finished-agent"
	| "new-terminal"
	| VimPageAction;

export const VIM_PAGE_ACTION_EVENT = "vector:vim-page-action";

const PAGE_ACTIONS: ReadonlySet<VimAction> = new Set<VimPageAction>([
	"copy-pr-url",
	"copy-pr-number",
	"prmerge-pr",
	"next-item",
	"prev-item",
]);

export function isVimPageAction(action: VimAction): action is VimPageAction {
	return PAGE_ACTIONS.has(action);
}

/** Single keys in normal mode. */
const NORMAL_BINDINGS: Record<string, VimAction> = {
	i: "focus-agent",
	j: "next-item",
	k: "prev-item",
};

/** Key sequences after the Space leader. */
export const LEADER_BINDINGS: Record<string, VimAction> = {
	" ": "next-finished-agent",
	q: "open-queue",
	a: "open-agent",
	n: "new-terminal",
	cu: "copy-pr-url",
	cn: "copy-pr-number",
	pm: "prmerge-pr",
};

export function normalModeAction(key: string): VimAction | null {
	return NORMAL_BINDINGS[key] ?? null;
}

/** What the keys typed after the leader mean so far: an action, the start of one, or nothing. */
export function matchLeaderSequence(
	sequence: string,
): VimAction | "pending" | null {
	const action = LEADER_BINDINGS[sequence];
	if (action) return action;
	return Object.keys(LEADER_BINDINGS).some((keys) => keys.startsWith(sequence))
		? "pending"
		: null;
}

/** An agent terminal: xterm types through a hidden textarea inside `.xterm`. */
export function isAgentTerminal(element: Element | null): boolean {
	return !!element?.closest(".xterm");
}

/** Where keys are text, not commands: fields, editors, terminals, and open menus or dialogs. */
export function isInsertTarget(element: Element | null): boolean {
	if (!element || element === document.body) return false;
	if (element.closest('[role="dialog"], [role="menu"], [role="listbox"]')) {
		return true;
	}
	if (element instanceof HTMLElement && element.isContentEditable) return true;
	const tag = element.tagName;
	return (
		tag === "INPUT" ||
		tag === "TEXTAREA" ||
		tag === "SELECT" ||
		tag === "WEBVIEW" ||
		tag === "IFRAME"
	);
}

export interface FinishedAgentTarget {
	workspaceId: string;
	terminalId: string;
}

/**
 * The next workspace after the active one, in sidebar order and wrapping, with
 * an agent that finished its turn and hasn't been seen (`review`). The caller
 * leaves effort children out of `order`: their sentinel reports for them.
 */
export function nextFinishedAgent(
	order: readonly string[],
	terminalStatuses: (workspaceId: string) => ReadonlyMap<string, PaneStatus>,
	activeWorkspaceId: string | null,
): FinishedAgentTarget | null {
	const start = activeWorkspaceId ? order.indexOf(activeWorkspaceId) : -1;
	for (let step = 1; step <= order.length; step++) {
		const workspaceId = order[(start + step) % order.length];
		if (!workspaceId) continue;
		for (const [terminalId, status] of terminalStatuses(workspaceId)) {
			if (status === "review") return { workspaceId, terminalId };
		}
	}
	return null;
}
