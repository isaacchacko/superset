import { Trans, useLingui } from "@lingui/react/macro";
import { toast } from "@superset/ui/sonner";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useSidebarWorkspaceStatuses } from "../../providers/DashboardSidebarWorkspaceStatusProvider";
import {
	isAgentTerminal,
	isInsertTarget,
	nextFinishedAgent,
	VIM_LEADER_TIMEOUT_MS,
	vimActionFor,
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
 * i focuses the current agent, Escape leaves it (Shift+Escape still reaches the
 * agent), and Space is the leader: q opens the Queue, a opens an agent, Space
 * jumps to the next finished agent.
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
	const [leaderPending, setLeaderPending] = useState(false);

	// Read inside the one keydown listener, which is registered once.
	const latest = useRef({ workspaceOrder, activeWorkspaceId, statuses });
	latest.current = { workspaceOrder, activeWorkspaceId, statuses };
	const isQueueOpen = !!matchRoute({ to: "/queue", fuzzy: true });
	const isQueueOpenRef = useRef(isQueueOpen);
	isQueueOpenRef.current = isQueueOpen;
	const lastAgent = useRef<{ workspaceId: string; input: Element } | null>(
		null,
	);

	useEffect(() => {
		let leader = false;
		let leaderTimer: ReturnType<typeof setTimeout> | undefined;
		const setLeader = (pending: boolean) => {
			leader = pending;
			clearTimeout(leaderTimer);
			setLeaderPending(pending);
			if (pending) {
				leaderTimer = setTimeout(() => setLeader(false), VIM_LEADER_TIMEOUT_MS);
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

		const run = async (
			action: ReturnType<typeof vimActionFor>,
		): Promise<void> => {
			const { workspaceOrder, activeWorkspaceId, statuses } = latest.current;
			if (action === "focus-agent") {
				focusAgent(activeWorkspaceId);
			} else if (action === "open-queue") {
				await navigate({ to: "/queue" });
			} else if (action === "open-agent") {
				if (isQueueOpenRef.current) {
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
				setLeader(false);
				return;
			}
			const action = vimActionFor(event.key, leader);
			if (leader) setLeader(false);
			if (!action) return;
			event.preventDefault();
			event.stopPropagation();
			if (action === "leader") {
				setLeader(true);
				return;
			}
			void run(action);
		};

		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("focusin", onFocusIn, true);
		return () => {
			clearTimeout(leaderTimer);
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("focusin", onFocusIn, true);
		};
	}, [navigate, utils, t]);

	if (!leaderPending) return null;
	return (
		<div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-popover-foreground text-xs shadow-md">
			<Trans>
				<span className="font-medium">Space</span> · q Queue · a agent · Space
				next finished agent
			</Trans>
		</div>
	);
}
