# React River API Patterns

Confirm exact signatures in the installed declaration file before editing a consumer project.

## Providers and hooks

```ts
import { provider, stateProvider } from '@stball/react-river';

export const countProvider = stateProvider(() => 0, { name: 'count' });
export const doubledProvider = provider((ref) => ref.watch(countProvider) * 2, {
  name: 'doubled',
});
```

```tsx
const count = useRiverWatch(countProvider);
const ref = useRiverRef();
ref.set(countProvider, (value) => value + 1);
```

Use `useRiverWatch(provider, selector)` for focused subscriptions. The options form supports `{ selector, enabled }`; initially disabled returns `undefined`, while disabling after a read retains the cached selected value. Stabilize expensive selectors with `useCallback`.

Async providers expose `AsyncValue<T>`:

```tsx
return when(useRiverWatch(userProvider), {
  loading: () => <Spinner />,
  error: (error) => <ErrorMessage error={error} />,
  data: (user) => <UserView user={user} />,
});
```

## Families

```ts
const userByIdProvider = promiseProviderFamily((_ref, id: string) => fetchUser(id), { name: 'userById' });
const user = useRiverWatch(userByIdProvider(userId));
```

Family keys are deterministic and object-key-order independent. Valid `Date` and `undefined` values are supported recursively. `ref.invalidateFamily(userByIdProvider)` reinitializes active instances; `userByIdProvider.clear()` discards cached provider definitions.

## Notifiers and mutations

```ts
class CounterNotifier extends Notifier<number> {
  build() {
    return 0;
  }
  increment() {
    this.state += 1;
  }
}
const counterProvider = notifierProvider(() => new CounterNotifier(), {
  name: 'counter',
});
```

Use `useRiverMutation` for imperative async work. It returns `{ state, mutate, reset }`; `mutate` returns a promise and rethrows errors. `onMutate` context is forwarded to success, error, and settled callbacks.

## Overrides, cache, observers

Overrides use `{ original, create }`:

```tsx
<RiverScope overrides={[{ original: apiProvider, create: () => fakeApi }]}>
  <Feature />
</RiverScope>
```

Cache policy may be set on `RiverScope` or `RiverContainer`. Resolution is provider option, then scope/container policy, then defaults (`autoDispose: true`, `cacheTime: 60_000`).

```tsx
<RiverScope cachePolicy={{ autoDispose: true, cacheTime: 5_000 }}>
  <App />
</RiverScope>
```

Observers implement optional create, update, dispose, and error callbacks. `loggerObserver(prefix?)` provides all four; render `<RiverDevTools />` inside a scope only when an interactive debug panel is intended.
