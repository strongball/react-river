# 🌊 React River

[![npm version](https://img.shields.io/npm/v/@zerologix/react-river.svg)](https://www.npmjs.com/package/@zerologix/react-river)
[![license](https://img.shields.io/npm/l/@zerologix/react-river.svg)](https://github.com/zerologix/react-river/blob/main/LICENSE)

**React River** is a lightweight, high-performance state management library for React, heavily inspired by the philosophy of **Riverpod** from the Flutter ecosystem. It combines the simplicity of hooks with the power of a centralized dependency injection system.

---

## ✨ Features

- **🚀 Declarative & Reactive**: Define state as "Providers" and watch them automatically update.
- **🔗 Dependency Injection**: Easily compose providers that depend on other providers.
- **⚡ Performance Optimized**: Fine-grained subscriptions with `select` selectors to prevent unnecessary re-renders.
- **🛠️ First-class Async Support**: Built-in `promiseProvider` and `observableProvider` with loading/error/data states.
- **🔍 DevTools**: Built-in interactive DevTools and logging for debugging state transitions and dependency graphs.
- **📦 Type Safe**: Written in TypeScript with deep inference for your state and notifiers.
- **🧹 Auto Disposal**: Automatically cleans up unused state and resources (configurable via `cacheTime`).

---

## 📦 Installation

```bash
npm install @zerologix/react-river
# or
yarn add @zerologix/react-river
```

---

## 🚀 Getting Started

### 1. Wrap your app with `RiverScope`

Place `RiverScope` at the root of your application (or any subtree) to provide the state container.

```tsx
import { RiverScope } from "@zerologix/react-river";

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
import { stateProvider, provider } from "@zerologix/react-river";

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
import { useRiverWatch, useRiverRef } from "@zerologix/react-river";
import { counterProvider, doubledProvider } from "./providers";

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
| `notifierProvider`      | Complex logic encapsulated in a synchronous `Notifier` class.        |
| `asyncNotifierProvider` | Async logic encapsulated in an `AsyncNotifier` class.                |

### Hooks

- **`useRiverWatch(provider)`**: Subscribes to a provider and re-renders when it changes.
- **`useRiverWatch(provider, selector)`**: Subscribes to a specific part of the state. Only re-renders if the selected value changes.
- **`useRiverRef()`**: Returns a `RiverRef` for imperative operations (`read`, `set`, `invalidate`, `refresh`).
- **`useRiverListen(provider, (next, prev) => { ... })`**: Runs a callback whenever the state changes. Does **not** trigger re-renders.

### Provider Families

Families allow you to parameterize your providers (e.g., fetching a user by ID).

```ts
const userByIdProvider = promiseProviderFamily((ref, id: string) => {
  return fetchUser(id);
});

// Usage:
const user = useRiverWatch(userByIdProvider("123"));
```

---

## 🌊 Async Handling

React River uses `AsyncValue` to handle asynchronous states gracefully. Use the `when` utility for exhaustive pattern matching.

```ts
import { promiseProvider, useRiverWatch, when } from '@zerologix/react-river';

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
import { Notifier, notifierProvider } from '@zerologix/react-river';

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
import {
  createDevToolsObserver,
  RiverDevTools,
  RiverScope,
} from "@zerologix/react-river";

function App() {
  // Create an observer to track events
  const devtools = createDevToolsObserver();

  return (
    <RiverScope observers={[devtools.observer]}>
      <YourAppShell />
      {/* Add the UI panel */}
      <RiverDevTools devtools={devtools} />
    </RiverScope>
  );
}
```

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

---

## 🏗️ Architecture & Deep Dive

For a detailed look at the internal workings of React River, including dependency tracking, state propagation, and the auto-disposal mechanism, please check out our [Architecture Documentation](./ARCHITECTURE.md).
