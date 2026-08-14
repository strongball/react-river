---
name: react-river
description: Implement, migrate, review, debug, and test React state management using @stball/react-river. Use when a project imports React River or asks for RiverScope, providers, families, AsyncValue, notifiers, mutations, overrides, cache policy, observers, DevTools, SSR hydration, or React River tests.
---

# React River

Use the installed package and `dist/index.d.ts` as the source of truth. Read the project’s existing conventions before changing code.

## Workflow

1. Inspect `package.json`, lockfiles, imports, existing `RiverScope`, provider definitions, and test setup. If the package is absent, use the project’s existing package manager and registry configuration; preserve its lockfile.
2. Choose the smallest primitive:
   - `provider` for derived read-only state;
   - `stateProvider` for mutable state;
   - `promiseProvider` for one-shot async data;
   - `observableProvider` for subscribe/unsubscribe sources;
   - `streamProvider` for sync or async iterables;
   - `Notifier`/`AsyncNotifier` for state with multiple operations and lifecycle logic;
   - `useRiverMutation` for imperative async actions with local status.
3. Define providers at module scope with stable, unique `name` values. Wrap consumers in `RiverScope`; use nested scopes and `overrides` for isolation and tests.
4. Use `ref.watch` for reactive provider dependencies and `ref.read` for one-time reads. In components use `useRiverWatch` for rendering, `useRiverRef` for handlers, and `useRiverListen` for side effects without rendering.
5. Handle `AsyncValue` loading, error, and data states exhaustively. Register resource cleanup with `ref.onDispose`. Set `autoDispose`/`cacheTime` only when retention requirements justify it.
6. Verify with the project’s typecheck, lint, tests, and build commands.

## Guardrails

- Do not call React hooks from provider factories or `ref.watch` from event handlers.
- Do not mutate watched arrays/objects in place; use immutable updates.
- Do not create uncached providers during render.
- Do not reuse provider names; names are runtime identity and SSR keys.
- Family arguments support JSON-like values, `undefined`, and valid `Date` objects. Reject functions, symbols, bigint, non-finite numbers, invalid dates, circular data, class instances, and other non-plain objects.
- `family.clear()` drops cached definitions; `ref.invalidateFamily(family)` reinitializes active instances.
- `initialState` is one-time hydration data, not a permanent cache. Refresh and invalidation rerun factories.
- `RiverScope` has no external-container prop; use `RiverContainer` directly outside React.

## References

- Read [references/api-patterns.md](references/api-patterns.md) for providers, hooks, families, notifiers, mutations, overrides, cache policy, and observers.
- Read [references/ssr-testing.md](references/ssr-testing.md) for SSR, serialization, testing, and lifecycle debugging.

## Completion Checklist

- Scope exists around all consumers.
- Provider names are stable and unique.
- `watch`/`read` usage matches reactive intent.
- Async states and cleanup are covered.
- Tests cover the changed behavior and validation passes.
