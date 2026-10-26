# Vector backlog

Things Isaac wants changed in Vector (and the `effort` CLI that drives it). Newest asks at the bottom of each section. An agent picking one up moves it to Doing, and to Done with the commit. Decisions that are Isaac's go in his Queue (`effort ask`), not here.

## Waiting on Isaac

Nothing.

## Todo

- **A `waiting` report for children blocked on another child.** `effort watch` flags every idle child whose report says working as "finished its turn without reporting", including ones legitimately waiting (bundling's facts-table and greeting wait on bench). `effort report waiting "on bench"` should silence that until the state changes.
- **Pro features (automations, tasks, remote access, invites, mobile).** Isaac, 2026-10-26: not about using Superset's servers for free; "things like automations and tasks shouldn't be pro things", and Vector must never be blocked on a feature down the line. Both live on Superset's servers today (automations are stored, scheduled and dispatched there; tasks are stored there), which is why they're paid. A dev account doesn't help: dev mode runs against a local backend, so Vector would lose the real workspaces, hosts and sign-in that live in Superset's cloud, and flipping the plan in a copy of their server is the circumvention their license forbids. Rule for Vector: its own features stay local and work on Free (efforts, Queue and vim bindings do). If automations or tasks are ever needed, build Vector's own local versions: a local scheduler that starts agents with the `superset` CLI, and tasks in local files like `effort tasks`. Not needed now; Isaac doesn't use them.
- **More vim bindings.** Isaac plans to expand them; the first slice is in Done.
- **Show background work in the sidebar.** A sentinel waiting on its subagents shows as idle with no agent badge; the Efforts group should say research is running.
- **Research that needs no branch has a place in an effort.** Today it only fits in the sentinel's own subagents (from the bundling effort's handoff).

## Doing

## Done

- Vim-like bindings, first slice: `i` focuses the current agent, `Esc` leaves it (`Shift+Esc` still sends Esc to the agent, since Claude Code interrupts on Esc), Space is the leader: `Space q` Queue, `Space a` the agent (on the Queue page, the first item's), `Space Space` the next agent that finished its turn and is unseen, skipping effort children (2026-10-26).
- Queue alerts open the Queue page: `superset notifications show --page queue` (2026-10-26).
- The app installs as `~/Applications/Vector.app` (was `Superset Efforts.app`); takes effect on the next build (2026-10-26).
- `effort ask --withdraw`, and `effort queue`/`answer` on wevawie use the MacBook's Queue (2026-10-26).
- Every agent knows the Queue: a rule in the global CLAUDE.md on both machines, and sentinels decide autonomously, asking only for money, outward or irreversible, and customer-visible calls (2026-10-26).
- Efforts sidebar section; children of an effort never chime (2026-10-26).
- Sidebar labels showed Lingui ids (`O6_QE2`) in release builds; `build.sh` now fills the catalogs (2026-10-26).
- No self-update (2026-10-26).
- Queue page for the decisions agents raise, oldest first (2026-10-26).
