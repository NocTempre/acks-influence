# Changelog

Releases before 0.13.0 predate this file; see the git history and GitHub
releases for earlier changes.

## 0.13.1

- Relationships section: more resilient Notes-tab host lookup on the character
  sheet (two additional fallback selectors), and a warn-once console message
  when no host exists instead of silently not rendering — stored attitudes are
  never lost, but their absence from the sheet is now visible.
- Manifest: socketlib requires entry now carries its `reason` (TOOLCHAIN §3).

## 0.13.0

- acks-lib is now consumed through its public API (`globalThis.acksLib`)
  instead of load-time deep imports of lib internals. Same implementation, no
  second copy of the gating logic — but a missing or late-loading lib now
  degrades gracefully (ability-sourced modifiers absent, effect scopes
  undetermined: offered, never asserted) with an init warning, instead of a
  module-load crash.
- Dependency floors pinned: acks-lib >= 0.8.0, socketlib >= 1.1.0.
- Compatibility aligned with the family: Foundry core minimum 14 and acks
  system minimum 14 (both previously claimed 13, untested there).
