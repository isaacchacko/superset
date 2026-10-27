import { Trans, useLingui } from "@lingui/react/macro";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@superset/ui/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@superset/ui/dialog";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useHotkey } from "renderer/hotkeys";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { formatRelativeTime } from "renderer/lib/formatRelativeTime";
import { getHostServiceClientByUrl } from "renderer/lib/host-service-client";
import { useHostWorkspaces } from "renderer/routes/_authenticated/providers/HostWorkspacesProvider";
import { useLocalHostService } from "renderer/routes/_authenticated/providers/LocalHostServiceProvider";
import { CHAT_RANGES, filterChats } from "./utils/chatSearch";

type RecentChat = Awaited<
	ReturnType<
		ReturnType<
			typeof getHostServiceClientByUrl
		>["terminalAgents"]["recentChats"]["query"]
	>
>[number];

/**
 * Cmd+K: this machine's Claude chats, newest first, from the last 24 hours
 * unless Tab widens the range. A running chat opens in its terminal; any other
 * is resumed in its workspace, or in a new one named for it.
 */
export function ChatSearch() {
	const { t, i18n } = useLingui();
	const navigate = useNavigate();
	const { activeHostUrl } = useLocalHostService();
	const { workspaces } = useHostWorkspaces();
	const resumeChat = electronTrpc.vector.resumeChat.useMutation();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [rangeIndex, setRangeIndex] = useState(0);
	const [selected, setSelected] = useState("");
	const range = CHAT_RANGES[rangeIndex] ?? CHAT_RANGES[0];

	useHotkey("SEARCH_CHATS", () => setOpen(true));

	const { data: chats = [], isFetching } = useQuery({
		queryKey: ["vector-recent-chats", activeHostUrl, range?.ms ?? null],
		enabled: open && !!activeHostUrl,
		staleTime: 0,
		placeholderData: (previous) => previous,
		queryFn: () =>
			getHostServiceClientByUrl(
				activeHostUrl as string,
			).terminalAgents.recentChats.query({
				since: range?.ms ? Date.now() - range.ms : 0,
			}),
	});

	// The sidebar's name; a workspace it no longer lists (archived) doesn't count.
	const workspaceNames = useMemo(
		() => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])),
		[workspaces],
	);
	const workspaceName = (chat: RecentChat) =>
		chat.workspace ? (workspaceNames.get(chat.workspace.id) ?? null) : null;
	const results = filterChats(chats, query, workspaceName);
	const firstResult = results[0]?.sessionId ?? "";

	// Keep the newest match highlighted as the query or range changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on query and range only
	useEffect(() => setSelected(firstResult), [query, rangeIndex, firstResult]);

	const close = (next: boolean) => {
		setOpen(next);
		if (!next) {
			setQuery("");
			setRangeIndex(0);
		}
	};

	const openChat = async (chat: RecentChat) => {
		close(false);
		try {
			const place =
				chat.live ??
				(await resumeChat.mutateAsync({
					sessionId: chat.sessionId,
					configDir: chat.configDir,
					cwd: chat.cwd,
					title: chat.title,
					workspaceId: workspaceName(chat) ? (chat.workspace?.id ?? null) : null,
				}));
			await navigate({
				to: "/v2-workspace/$workspaceId",
				params: { workspaceId: place.workspaceId },
				search: {
					terminalId: place.terminalId,
					focusRequestId: crypto.randomUUID(),
				},
			});
		} catch (error) {
			toast.error(t({ message: "Couldn't open the chat" }), {
				description: (error as Error).message,
			});
		}
	};

	const onInputKeyDown = (event: React.KeyboardEvent) => {
		if (event.key !== "Tab") return;
		event.preventDefault();
		const step = event.shiftKey ? -1 : 1;
		setRangeIndex(
			(index) => (index + step + CHAT_RANGES.length) % CHAT_RANGES.length,
		);
	};

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent
				showCloseButton={false}
				className="!max-w-[720px] sm:!max-w-[720px] translate-y-0 max-h-[80vh] overflow-hidden p-0"
				style={{ top: "max(16px, calc(50% - 278px))" }}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>
						<Trans>Search chats</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>Find a recent agent chat and open it.</Trans>
					</DialogDescription>
				</DialogHeader>
				<Command
					shouldFilter={false}
					value={selected}
					onValueChange={setSelected}
					className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2 [&_[cmdk-list]]:max-h-[min(500px,calc(80vh-5.5rem))]"
				>
					<CommandInput
						value={query}
						onValueChange={setQuery}
						onKeyDown={onInputKeyDown}
						placeholder={t({ message: "Search chats…" })}
					/>
					<div className="flex items-center gap-1 border-b px-3 py-1.5 text-xs">
						{CHAT_RANGES.map((option, index) => (
							<button
								key={option.ms ?? "all"}
								type="button"
								onClick={() => setRangeIndex(index)}
								className={cn(
									"rounded px-2 py-0.5 transition-colors",
									index === rangeIndex
										? "bg-accent text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{i18n._(option.label)}
							</button>
						))}
						<span className="ml-auto text-muted-foreground">
							{isFetching ? (
								<Trans>Reading chats…</Trans>
							) : (
								<Trans>⇥ wider · ↵ open</Trans>
							)}
						</span>
					</div>
					<CommandList>
						<CommandEmpty>
							{isFetching ? (
								<Trans>Reading chats…</Trans>
							) : (
								<Trans>No chats. Tab looks further back.</Trans>
							)}
						</CommandEmpty>
						{results.map((chat) => {
							const name = workspaceName(chat);
							const where = name ?? chat.cwd.split("/").pop() ?? chat.cwd;
							const prompt = chat.lastPrompt ?? chat.firstPrompt;
							return (
								<CommandItem
									key={chat.sessionId}
									value={chat.sessionId}
									onSelect={() => void openChat(chat)}
									className="flex flex-col items-stretch gap-0.5"
								>
									<div className="flex items-center gap-2">
										<span className="truncate font-medium">{chat.title}</span>
										{chat.live && (
											<span className="shrink-0 rounded bg-emerald-500/15 px-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
												<Trans>running</Trans>
											</span>
										)}
										<span className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums">
											{formatRelativeTime(chat.updatedAt)}
										</span>
									</div>
									<div className="truncate text-muted-foreground text-xs">
										{[where, chat.branch, prompt].filter(Boolean).join(" · ")}
									</div>
								</CommandItem>
							);
						})}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
