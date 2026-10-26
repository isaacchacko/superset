import type { PaneStatus } from "shared/tabs-types";

/**
 * Vim-like bindings. Insert mode is any focused text field, agent terminals
 * included; normal mode is everything else, where single keys are commands and
 * Space is the leader.
 */
export const VIM_LEADER_TIMEOUT_MS = 1_000;

export type VimAction =
	| "focus-agent"
	| "open-queue"
	| "open-agent"
	| "next-finished-agent";

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

/** The action a normal-mode key triggers, given whether the leader is pending. */
export function vimActionFor(
	key: string,
	leaderPending: boolean,
): VimAction | "leader" | null {
	if (leaderPending) {
		if (key === " ") return "next-finished-agent";
		if (key === "q") return "open-queue";
		if (key === "a") return "open-agent";
		return null;
	}
	if (key === " ") return "leader";
	if (key === "i") return "focus-agent";
	return null;
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
