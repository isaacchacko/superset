import { Trans, useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useSidebarWorkspaceStatuses } from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import {
	isAgentTerminal,
	isInsertTarget,
	isVimPageAction,
	matchLeaderSequence,
	nextFinishedAgent,
	normalModeAction,
	VIM_LEADER_TIMEOUT_MS,
	VIM_PAGE_ACTION_EVENT,
	type VimAction,
} from "../../utils/vimBindings";

const TERMINAL_INPUT_SELECTOR = ".xterm-helper-textarea";
const FOCUS_RETRY_MS = 50;
const FOCUS_GIVE_UP_MS = 1_500;

interface DashboardSidebarVimBindingsProps {
	/** Workspaces in sidebar order, without effort children. */
	workspaceOrder: readonly string[];
	activeWorkspaceId: string | null;
}

function isVisible(element: Element): boolean {
	return element.isConnected && (element as HTMLElement).offsetParent !== null;
}

/**
 * i focuses the current agent and Escape leaves it (Shift+Escape still reaches
 * the agent). Space is the leader: q Queue, a agent, n new terminal in ~,
 * Space next finished agent; on the Queue, c u / c n copy the PR's URL /
 * number, p m nudges its agent to /prmerge it, j / k move through the list,
 * and Shift+H / Shift+L switch its tabs.
 */
export function DashboardSidebarVimBindings({
	workspaceOrder,
	activeWorkspaceId,
}: DashboardSidebarVimBindingsProps) {
	const { t } = useLingui();
	const navigate = useNavigate();
	const matchRoute = useMatchRoute();
	const utils = electronTrpc.useUtils();
	const statuses = useSidebarWorkspaceStatuses();
	const openHomeTerminal = electronTrpc.vector.openHomeTerminal.useMutation();
	// The keys typed after the leader, shown as a hint; null when the leader isn't pending.
	const [leaderKeys, setLeaderKeys] = useState<string | null>(null);

	// Read inside the one keydown listener, which is registered once.
	const latest = useRef({
		workspaceOrder,
		activeWorkspaceId,
		statuses,
		isQueueOpen: false,
		openHomeTerminal: openHomeTerminal.mutateAsync,
	});
	latest.current = {
		workspaceOrder,
		activeWorkspaceId,
		statuses,
		isQueueOpen: !!matchRoute({ to: "/queue", fuzzy: true }),
		openHomeTerminal: openHomeTerminal.mutateAsync,
	};
	const lastAgent = useRef<{ workspaceId: string; input: Element } | null>(
		null,
	);

	useEffect(() => {
		let leader: string | null = null;
		let leaderTimer: ReturnType<typeof setTimeout> | undefined;
		const setLeader = (keys: string | null) => {
			leader = keys;
			clearTimeout(leaderTimer);
			setLeaderKeys(keys);
			if (keys !== null) {
				leaderTimer = setTimeout(() => setLeader(null), VIM_LEADER_TIMEOUT_MS);
			}
		};

		const focusAgent = (workspaceId: string | null): boolean => {
			const remembered = lastAgent.current;
			if (
				remembered &&
				remembered.workspaceId === workspaceId &&
				isVisible(remembered.input)
			) {
				(remembered.input as HTMLElement).focus();
				return true;
			}
			const input = [
				...document.querySelectorAll(TERMINAL_INPUT_SELECTOR),
			].find(isVisible);
			(input as HTMLElement | undefined)?.focus();
			return !!input;
		};
		// After navigating, the workspace's terminals mount a beat later.
		const focusAgentSoon = (workspaceId: string) => {
			const giveUpAt = Date.now() + FOCUS_GIVE_UP_MS;
			const attempt = () => {
				if (focusAgent(workspaceId) || Date.now() > giveUpAt) return;
				setTimeout(attempt, FOCUS_RETRY_MS);
			};
			setTimeout(attempt, FOCUS_RETRY_MS);
		};
		const openTerminal = (workspaceId: string, terminalId: string) =>
			navigate({
				to: "/v2-workspace/$workspaceId",
				params: { workspaceId },
				search: { terminalId, focusRequestId: crypto.randomUUID() },
			});

		const run = async (action: VimAction): Promise<void> => {
			const { workspaceOrder, activeWorkspaceId, statuses, isQueueOpen } =
				latest.current;
			if (isVimPageAction(action)) {
				// Only the Queue has a selection to act on today.
				if (isQueueOpen) {
					window.dispatchEvent(
						new CustomEvent(VIM_PAGE_ACTION_EVENT, { detail: action }),
					);
				}
			} else if (action === "focus-agent") {
				focusAgent(activeWorkspaceId);
			} else if (action === "open-queue") {
				await navigate({ to: "/queue" });
			} else if (action === "new-terminal") {
				try {
					const { workspaceId, terminalId } =
						await latest.current.openHomeTerminal();
					await openTerminal(workspaceId, terminalId);
				} catch (error) {
					toast.error(t({ message: "Couldn't open a terminal" }), {
						description: (error as Error).message,
					});
				}
			} else if (action === "open-agent") {
				if (isQueueOpen) {
					const items = await utils.queue.list.fetch();
					const first = items.find((item) => item.status === "open");
					if (first) {
						await openTerminal(first.asker.workspace, first.asker.terminal);
						return;
					}
				}
				const workspaceId = activeWorkspaceId ?? lastAgent.current?.workspaceId;
				if (!workspaceId) return;
				if (workspaceId !== activeWorkspaceId) {
					await navigate({
						to: "/v2-workspace/$workspaceId",
						params: { workspaceId },
					});
				}
				focusAgentSoon(workspaceId);
			} else if (action === "next-finished-agent") {
				const target = nextFinishedAgent(
					workspaceOrder,
					(workspaceId) => statuses.get(workspaceId)?.statuses ?? new Map(),
					activeWorkspaceId,
				);
				if (!target) {
					toast(t({ message: "No finished agents" }));
					return;
				}
				await openTerminal(target.workspaceId, target.terminalId);
			}
		};

		const onFocusIn = (event: FocusEvent) => {
			const target = event.target as Element | null;
			const workspaceId = latest.current.activeWorkspaceId;
			if (target && workspaceId && isAgentTerminal(target)) {
				lastAgent.current = { workspaceId, input: target };
			}
		};

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey)
				return;
			const target = document.activeElement;
			if (isInsertTarget(target)) {
				if (
					event.key === "Escape" &&
					!event.shiftKey &&
					isAgentTerminal(target)
				) {
					event.preventDefault();
					event.stopPropagation();
					(target as HTMLElement).blur();
				}
				return;
			}
			if (event.key === "Escape") {
				setLeader(null);
				return;
			}
			let action: VimAction | null = null;
			if (leader !== null) {
				const match = matchLeaderSequence(leader + event.key);
				if (match === "pending") setLeader(leader + event.key);
				else {
					setLeader(null);
					action = match;
				}
				event.preventDefault();
				event.stopPropagation();
			} else if (event.key === " ") {
				setLeader("");
				event.preventDefault();
				event.stopPropagation();
			} else {
				action = normalModeAction(event.key);
				if (action) {
					event.preventDefault();
					event.stopPropagation();
				}
			}
			if (action) void run(action);
		};

		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("focusin", onFocusIn, true);
		return () => {
			clearTimeout(leaderTimer);
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("focusin", onFocusIn, true);
		};
	}, [navigate, utils, t]);

	if (leaderKeys === null) return null;
	return (
		<div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-popover-foreground text-xs shadow-md">
			<span className="font-medium">Space {leaderKeys}</span>
			{leaderKeys === "" ? (
				<Trans>
					{" "}
					· Space next finished agent · q Queue · a agent · n terminal · c copy
					· p prmerge
				</Trans>
			) : leaderKeys === "c" ? (
				<Trans> · u PR URL · n PR number</Trans>
			) : leaderKeys === "p" ? (
				<Trans> · m nudge the PR's agent to /prmerge</Trans>
			) : null}
		</div>
	);
}
