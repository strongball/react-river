# 🌊 React River

[![npm version](https://img.shields.io/npm/v/@stball/react-river.svg)](https://www.npmjs.com/package/@stball/react-river)
[![license](https://img.shields.io/npm/l/@stball/react-river.svg)](https://github.com/stball/react-river/blob/main/LICENSE)

**React River** is a lightweight, high-performance state management library for React, heavily inspired by the philosophy of **Riverpod** from the Flutter ecosystem. It combines the simplicity of hooks with the power of a centralized dependency injection system.

---

## ✨ Features

- **🚀 Declarative & Reactive**: Define state as "Providers" and watch them automatically update.
- **🔗 Dependency Injection**: Easily compose providers that depend on other providers.
- **⚡ Performance Optimized**: Fine-grained subscriptions with `select` selectors to prevent unnecessary re-renders.
- **🛠️ First-class Async Support**: Built-in `promiseProvider`, `observableProvider`, and `streamProvider` with loading/error/data states.
- **🌐 SSR Ready**: Built-in `dehydrate()` / `initialState` support for seamless Server-Side Rendering hydration with zero loading flash.
- **🔍 DevTools**: Built-in interactive DevTools and logging for debugging state transitions and dependency graphs.
- **📦 Type Safe**: Written in TypeScript with deep inference for your state and notifiers.
- **🧹 Auto Disposal**: Automatically cleans up unused state and resources (configurable via `cacheTime`).

---

## 📦 Installation

```bash
npm install @stball/react-river
# or
yarn add @stball/react-river
```

---

## 🚀 Getting Started

### 1. Wrap your app with `RiverScope`

Place `RiverScope` at the root of your application (or any subtree) to provide the state container.

```tsx
import { RiverScope } from '@stball/react-river';

function App() {
  return (
    <RiverScope>
      <MainApp />
    </RiverScope>
  );
}
```

### 2. Define a Provider

Providers are "definitions" of state. They don't hold state themselves; the `RiverScope` container does.

```ts
import { stateProvider, provider } from '@stball/react-river';

// 1. Simple mutable state
export const counterProvider = stateProvider(() => 0);

// 2. Computed value that "watches" another provider
export const doubledProvider = provider((ref) => {
  const count = ref.watch(counterProvider);
  return count * 2;
});
```

### 3. Use it in your Components

Use hooks to interact with your providers.

```tsx
import { useRiverWatch, useRiverRef } from '@stball/react-river';
import { counterProvider, doubledProvider } from './providers';

function Counter() {
  // Watch a provider for changes (triggers re-render)
  const count = useRiverWatch(counterProvider);
  const doubled = useRiverWatch(doubledProvider);

  // Get an imperative ref (read, set, invalidate, etc.)
  const ref = useRiverRef();

  return (
    <div>
      <p>
        Count: {count} (Doubled: {doubled})
      </p>
      <button onClick={() => ref.set(counterProvider, (c) => c + 1)}>+1</button>
    </div>
  );
}
```

---

## 🧪 Core Concepts

### Provider Types

| Provider                | Purpose                                                              |
| :---------------------- | :------------------------------------------------------------------- |
| `provider`              | Read-only computed value. Great for derived state or data selectors. |
| `stateProvider`         | Simple mutable state. Provides a `set` method to update value.       |
| `promiseProvider`       | Asynchronous data fetching. Returns an `AsyncValue`.                 |
| `observableProvider`    | Stream/Subscription based state (e.g., WebSockets, Observables).     |
| `streamProvider`        | Generator / iterable based state (`function*` or `async function*`). |
| `notifierProvider`      | Complex logic encapsulated in a synchronous `Notifier` class.        |
| `asyncNotifierProvider` | Async logic encapsulated in an `AsyncNotifier` class.                |

`streamProvider` consumes synchronous and asynchronous iterables. Each yielded value becomes the provider's current data:

```ts
import { streamProvider } from '@stball/react-river';

const numbersProvider = streamProvider(
  async function* () {
    yield 1;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    yield 2;
  },
  { name: 'numbers' },
);
```

The provider stops the iterator when it is disposed or refreshed. A synchronous generator is consumed during initialization, so its final yielded value is the value available after `read()` returns.

### Hooks

- **`useRiverWatch(provider)`**: Subscribes to a provider and re-renders when it changes.
- **`useRiverWatch(provider, selector)`**: Subscribes to a specific part of the state. Only re-renders if the selected value changes.
- **`useRiverWatch(provider, { selector?, enabled? })`**: Combines selection with conditional subscription. While initially disabled it returns `undefined`; if disabled after being enabled, it keeps the last selected value until enabled again.
- **`useRiverRef()`**: Returns a `RiverRef` for imperative operations (`read`, `set`, `invalidate`, `invalidateFamily`, `refresh`).
- **`useRiverListen(provider, (next, prev) => { ... })`**: Runs a callback whenever the state changes. Does **not** trigger re-renders.
- **`useRiverMutation(mutationFn, options?)`**: Runs an imperative async operation with React-local `AsyncValue` state.

Use the options form of `useRiverWatch` when a subscription should be conditional:

```tsx
const userName = useRiverWatch(userProvider, {
  selector: (user) => user.name,
  enabled: isSignedIn,
});
```

### Mutations

`useRiverMutation` returns `{ state, mutate, reset }`. The mutation function receives a `RiverRef` and the variables passed to `mutate`. Lifecycle callbacks receive the same variables and ref; a value returned by `onMutate` is also passed to the success, error, and settled callbacks for optimistic updates or rollback.

```tsx
function DeleteUserButton({ userId }: { userId: string }) {
  const { state, mutate, reset } = useRiverMutation(
    async (ref, id: string) => {
      await ref.read(apiProvider).deleteUser(id);
    },
    {
      onSuccess: (_data, _id, _context, ref) => {
        ref.invalidate(usersProvider);
        ref.invalidateFamily(userByIdProvider);
      },
    },
  );

  return (
    <>
      <button disabled={state.isLoading} onClick={() => void mutate(userId).catch(showErrorToast)}>
        Delete user
      </button>
      <button onClick={reset}>Reset mutation state</button>
    </>
  );
}
```

### Provider Families

Families allow you to parameterize your providers (e.g., fetching a user by ID).

```ts
const userByIdProvider = promiseProviderFamily((ref, id: string) => fetchUser(id), { name: 'userById' });

// Usage:
const user = useRiverWatch(userByIdProvider('123'));
```

Family arguments use deterministic keys. They may contain JSON values, `undefined`, or valid `Date` instances, including inside arrays and plain objects. Object key order does not affect identity, while `undefined`, `null`, a `Date`, and the same ISO timestamp as a string remain distinct.

Functions, symbols, `bigint`, non-finite numbers, invalid dates, circular references, class instances, and other non-plain objects are rejected. Structurally equivalent arguments return the same cached provider instance.

Use `invalidateFamily` to re-initialize every initialized instance at once:

```tsx
const ref = useRiverRef();

await saveUser();
ref.invalidateFamily(userByIdProvider);
```

---

## 🌊 Async Handling

React River uses `AsyncValue` to handle asynchronous states gracefully. Use the `when` utility for exhaustive pattern matching.

```ts
import { promiseProvider, useRiverWatch, when } from '@stball/react-river';

const todoProvider = promiseProvider(async (ref) => {
  const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
  return response.json();
});

function TodoItem() {
  const todo = useRiverWatch(todoProvider);

  return (
    <div>
      {when(todo, {
        data: (data) => <h1>{data.title}</h1>,
        loading: () => <p>Loading...</p>,
        error: (err) => <p style={{ color: 'red' }}>Error: {String(err)}</p>,
      })}
    </div>
  );
}
```

---

## 🏗️ Notifiers

For complex state logic or encapsulated business rules, use `Notifier` or `AsyncNotifier`.

```ts
import { Notifier, notifierProvider } from '@stball/react-river';

class CounterNotifier extends Notifier<number> {
  build() {
    return 0; // Initial state
  }

  increment() {
    this.state++;
  }
}

const counterProvider = notifierProvider(() => new CounterNotifier());

// In component:
const count = useRiverWatch(counterProvider);
const notifier = useRiverWatch(counterProvider.notifier); // Access the class instance

return <button onClick={() => notifier.increment()}>{count}</button>;
```

---

## 🛠️ DevTools

Enhance your development experience with the built-in DevTools! It provides a floating panel to inspect provider values, track events, and visualize dependency graphs.

```tsx
import { RiverDevTools, RiverScope } from '@stball/react-river';

function App() {
  return (
    <RiverScope>
      <YourAppShell />
      {/* Add the UI panel, it automatically binds to the nearest RiverScope container */}
      <RiverDevTools />
    </RiverScope>
  );
}
```

For console logging or custom lifecycle monitoring, pass `RiverObserver` objects to either `RiverScope` or `RiverContainer`:

```tsx
import { loggerObserver, RiverScope, type RiverObserver } from '@stball/react-river';

const auditObserver: RiverObserver = {
  onProviderError(provider, error) {
    reportError(provider.name, error);
  },
};

const stateLogger = loggerObserver('App state');

function App() {
  return (
    <RiverScope observers={[stateLogger, auditObserver]}>
      <YourAppShell />
    </RiverScope>
  );
}
```

Observers can implement `onProviderCreate`, `onProviderUpdate`, `onProviderDispose`, and `onProviderError`. `loggerObserver(prefix?)` provides all four and writes the events to the console.

---

## 🧪 Scoping & Overrides

React River allows you to override providers for specific subtrees. This is exceptionally useful for testing or providing different mock implementations.

```tsx
const appOverrides = [
  {
    original: authProvider,
    create: (ref) => new MockAuthService(),
  },
];

<RiverScope overrides={appOverrides}>
  <App />
</RiverScope>;
```

### Cache Policy

Set default disposal behavior for a scope or a standalone container with `cachePolicy`:

```tsx
<RiverScope cachePolicy={{ autoDispose: true, cacheTime: 5_000 }}>
  <App />
</RiverScope>
```

```ts
import { RiverContainer } from '@stball/react-river';

const container = new RiverContainer({
  cachePolicy: { autoDispose: false },
});
```

The built-in defaults are `autoDispose: true` and `cacheTime: 60_000` milliseconds. `cacheTime` only applies when the resolved `autoDispose` value is `true`. Provider-level `autoDispose` and `cacheTime` options override the container or scope policy.

---

## 🌐 Server-Side Rendering (SSR)

React River has built-in support for SSR hydration. The workflow uses two APIs:

- `container.dehydrate()` — serializes provider state on the **server**
- `<RiverScope initialState={...}>` — restores state on the **client**

### Step 1: Name your providers

A `name` is **required** for any provider to participate in SSR. This name is used as the key in the dehydrated state object.

```ts
export const userProvider = promiseProvider(
  async () => fetchUser(),
  { name: 'user' }, // ← required for SSR
);
```

### Step 2: Dehydrate on the server

```ts
// e.g. Next.js getServerSideProps
const container = new RiverContainer();

// Read and await async providers
await container.read(userProvider.promise);

// Serialize all provider states
const initialRiverState = container.dehydrate();
// => { "user": { id: 1, name: "John" } }
```

### Step 3: Hydrate on the client

```tsx
// pages/_app.tsx (Next.js) or your root layout
import { RiverScope } from '@stball/react-river';

function App({ pageProps }) {
  return (
    <RiverScope initialState={pageProps.initialRiverState}>
      <Component {...pageProps} />
    </RiverScope>
  );
}
```

### How it works

When a provider is first read on the client and there is a matching key in `initialState`:

| Provider type                                                                         | Client initial state                              | Background factory                 |
| :------------------------------------------------------------------------------------ | :------------------------------------------------ | :--------------------------------- |
| `stateProvider` / `provider`                                                          | Uses hydrated value directly                      | Runs (to rebuild `ref.watch` deps) |
| `notifierProvider`                                                                    | Uses hydrated value, Notifier instance created    | Runs `build()` (to rebuild deps)   |
| `promiseProvider` / `observableProvider` / `streamProvider` / `asyncNotifierProvider` | `asyncData(hydratedValue)` — **no loading flash** | Runs — Stale-while-revalidate      |

> **Stale-while-revalidate**: For async providers, the UI renders immediately with the hydrated data (no loading spinner), while the factory re-fetches silently in the background. When fresh data arrives, the UI updates automatically.

> **One-time consumption**: Each `initialState` key is deleted after first use. `refresh()` and `invalidate()` always re-run the factory — they never re-use stale hydrated data.

### SSR Options

| Option       | Description                                                                                        |
| :----------- | :------------------------------------------------------------------------------------------------- |
| `name`       | **Required** for SSR. Used as the key in the dehydrated state object.                              |
| `ssr: false` | Opt-out of SSR for this provider (e.g., sensitive tokens). Named providers participate by default. |
| `toJSON`     | Custom serialization: transform the value before it is written to the dehydrated payload.          |
| `fromJSON`   | Custom deserialization: transform the raw JSON back into your model class on the client.           |

```ts
export const userProvider = stateProvider(() => new User(0, 'Guest'), {
  name: 'user',
  toJSON: (user) => ({ id: user.id, name: user.name }), // server: Class → plain object
  fromJSON: (json) => new User(json.id, json.name), // client: plain object → Class
});
```

For a complete Next.js example, see [SSR_NEXTJS_EXAMPLE.md](./SSR_NEXTJS_EXAMPLE.md).

---

## 🏗️ Architecture & Deep Dive

For a detailed look at the internal workings of React River, including dependency tracking, state propagation, and the auto-disposal mechanism, please check out our [Architecture Documentation](./ARCHITECTURE.md).
