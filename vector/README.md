# Vector

Isaac's Superset: upstream Superset ([ParadevAI/Paradev](https://github.com/ParadevAI/Paradev), formerly superset-sh/superset) plus whatever Vector changes, kept as a short stack of commits on top so it can follow upstream forever.

Licensed like upstream, under the Elastic License 2.0 (`LICENSE.md`).

## What Vector changes

`git log upstream/main..main` is the whole list. Today:

- **Efforts in the sidebar.** An Efforts section above Sessions shows each effort (one root task, from the `effort` CLI): its sentinel, children, working/need-you counts, PRs and open tasks. Children of an effort never chime; the sentinel raises the alerts that need Isaac.
- **Queue.** A sidebar page of the decisions agents raised with `effort ask`, oldest first. Answer each with a decision or a follow-up question; the answer is typed into the asking agent's terminal.
- **No self-update.** Upstream's updater would replace a Vector build with stock Superset.
- **`vector/`**: this folder, the scripts that keep Vector building and current.

## Branches

- `main`: `upstream/main` plus Vector's commits. New Vector work lands here.
- `release/desktop-vX.Y.Z`: that upstream release plus Vector's commits. This is what gets built.

## Keep up with upstream

```sh
vector/sync.sh
```

Rebases `main` onto the latest `upstream/main` and force-pushes it. Vector CI (`.github/workflows/vector-ci.yml`, on GitHub's free runners) typechecks and runs Vector's tests on every push to `main` and `release/*`; nothing typechecks locally. Upstream's own workflows are disabled on the fork in the repository settings. On a conflict it stops so you can resolve it and `git rebase --continue`. `rerere` is on, so a conflict resolved once is replayed automatically next time.

## Build the app

Vector is built on GitHub's free macOS runners, not on Isaac's machine:

```sh
vector/release.sh             # bring release/<tag> up to date with main's Vector commits and push it
vector/install.sh --wait --restart   # wait for CI to build the pushed commit, install it, reopen Vector
```

`release.sh` uses the release `/Applications/Superset.app` runs unless given a tag. It checks out `release/<tag>` in `~/Programs/vector-release` (made from the tag the first time), cherry-picks any Vector commits it lacks and pushes it. Vector CI typechecks it, then builds `Vector.app` with `vector/build-app.sh` and uploads it. `install.sh` downloads the newest green build and installs it at `~/Applications/Vector.app`; without `--restart` it stages it and prints the one command to swap it in while Vector is running.

`vector/build.sh` does the same build locally, for when CI isn't an option.

The app is still "Superset" inside: the same app id, product name, `~/.superset`, `~/Library/Application Support/Superset` and keychain entry. So it shares the stock app's settings, sign-in, hosts, workspaces and terminals, with nothing to sync.

- Run one or the other, never both: quit one before opening the other.
- Build on the release the stock app runs. A newer release can migrate `~/.superset`'s databases past what the stock app understands. When the stock app updates, run `vector/build.sh` again.
- The first launch asks for "Superset Safe Storage" in the keychain, because this build is signed ad hoc. Choose Always Allow.
- Starting it points the `superset` CLI wrapper (`~/.superset/bin/superset`) at its own copy. Opening the stock app points it back.

## Change Vector

1. Commit on `main`, one commit per change, with a subject that says what Vector does differently. `build.sh` matches commits across branches by subject, so keep subjects unique.
2. For UI work, iterate in dev mode (`bun run dev` in `apps/desktop`: its own window, data and backend) and screenshot it with `vector/shot.sh`.
3. `vector/build.sh` to get it into the app, then check the real window: `vector/shot.sh out.png sidebar` captures Superset's window without focusing it.

New user-facing strings go through Lingui like upstream's. `build.sh` adds them to the catalogs with English for every locale (`fill-translations.py`); without that a release build shows message ids like `070kfV`.
