# React River SSR and Testing

## SSR

Use a new `RiverContainer` per server request. Give SSR providers stable names, read/await required providers, call `container.dehydrate()`, serialize the result, and pass it to `<RiverScope initialState={payload}>` on the client. Hydrated keys are consumed once; `refresh` and `invalidate` rerun factories.

Use `toJSON`/`fromJSON` for custom classes and `ssr: false` for secrets or nontransferable request-only resources.

```ts
const container = new RiverContainer();
await container.read(userProvider.promise);
const payload = container.dehydrate();
container.dispose();
```

## Testing

Use `RiverContainer` for provider/dependency tests and render React consumers inside `RiverScope`. Prefer overrides for fakes instead of mocking library internals.

Cover, as applicable:

- provider initialization, updates, invalidation, disposal, and dependency propagation;
- async loading/success/error and stale completion behavior;
- hook snapshots, selector equality, enabled transitions, identity changes, and unmount cleanup;
- mutation success/failure, callback ordering, optimistic context, reset, and overlapping calls;
- SSR hydration and custom serialization.

Use unique provider names per test or dispose containers reliably. For resources such as timers, subscriptions, iterators, and abort controllers, register `ref.onDispose` and assert cleanup on invalidation/container disposal.

## Debugging

- Outside-scope hook error: add the nearest `RiverScope`.
- Stale derived value: use `ref.watch` instead of `ref.read` for reactive dependencies.
- Too many renders: select a smaller value, use immutable updates, and stabilize expensive selectors.
- Provider never disposes: inspect listeners, dependents, `autoDispose`, and `cacheTime`.
- Hydration miss: check provider `name`, `ssr`, payload keys, and `fromJSON`.
- Unhandled mutation rejection: await or catch the promise returned by `mutate`.
