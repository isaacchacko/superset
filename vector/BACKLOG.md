# Vector backlog

Things Isaac wants changed in Vector (and the `effort` CLI that drives it). Newest asks at the bottom of each section. An agent picking one up moves it to Doing, and to Done with the commit. Decisions that are Isaac's go in his Queue (`effort ask`), not here.

## Waiting on Isaac

- **Pro features (automations, tasks, remote access, invites, mobile).** Asked 2026-10-26: "why don't I have the pro plan on this forked version? i.e. i should be able to use automations." Vector has exactly the plan stock Superset has: the app asks Superset's servers for the active plan of the signed-in organization (`isaac's team`, the only one on `isaac.chacko05@gmail.com`), and that organization is on Free. The servers enforce it too: creating or running an automation calls `requireAutomationsPlan`, which refuses without Pro. Removing the paywall in Vector wouldn't work (the server still refuses) and isn't allowed (Superset's Elastic License 2.0 forbids circumventing its license-key and plan gating). The ways to get them: pay for Pro on `isaac's team`; sign in with an account whose organization already pays (Dryft's, if it has one); or build Vector's own local scheduler that starts agents with the `superset` CLI, which doesn't touch Superset's gated features. In Isaac's Queue.

## Todo

- **Queue alerts open the Queue page.** Today `effort ask`'s alert opens the asking agent's workspace. Needs a notification target for an app route, which `superset notifications show` doesn't have.
- **Show background work in the sidebar.** A sentinel waiting on its subagents shows as idle with no agent badge; the Efforts group should say research is running.
- **Research that needs no branch has a place in an effort.** Today it only fits in the sentinel's own subagents (from the bundling effort's handoff).

## Doing

## Done

- The app installs as `~/Applications/Vector.app` (was `Superset Efforts.app`); takes effect on the next build (2026-10-26).
- `effort ask --withdraw`, and `effort queue`/`answer` on wevawie use the MacBook's Queue (2026-10-26).
- Every agent knows the Queue: a rule in the global CLAUDE.md on both machines, and sentinels decide autonomously, asking only for money, outward or irreversible, and customer-visible calls (2026-10-26).
- Efforts sidebar section; children of an effort never chime (2026-10-26).
- Sidebar labels showed Lingui ids (`O6_QE2`) in release builds; `build.sh` now fills the catalogs (2026-10-26).
- No self-update (2026-10-26).
- Queue page for the decisions agents raise, oldest first (2026-10-26).
