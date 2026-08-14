# React River SSR Example (React Router v7 / Remix)

This example demonstrates how to implement Server-Side Rendering (SSR) with React River and React Router v7 Data Loading (`loader`).

The core concept is to use the `loader` to trigger data prefetching on the server side, store the data into a `RiverContainer`, and then dehydrate the container's state to be passed to the client for `<RiverScope>` hydration.

---

## 1. Global Context Injection (Recommended)

This approach creates a per-request `RiverContainer`, injects it into the React Router load context, fetches data in the loaders, and dehydrates the container in `root.tsx`.

### 1.1. Setup `server.ts` (Server Entry)

Create an isolated `RiverContainer` for each HTTP request to avoid cross-request state pollution.

```typescript
// server.ts (or where createRequestHandler is defined)
import { createRequestHandler } from "@react-router/node";
import { RiverContainer } from "@stball/react-river";

export const handler = createRequestHandler({
  build,
  getLoadContext(req) {
    // Create an isolated container for this request
    return {
      riverContainer: new RiverContainer(),
    };
  },
});
```

_(Note: You will need to extend `AppLoadContext` in your project's types to make TypeScript aware of `riverContainer`)_

### 1.2. Prefetch Data in Route Loader

In your page's `loader`, access the container from `context` and trigger your asynchronous Providers.

```tsx
// src/pages/settings/index.tsx
import { userProfileProvider } from "~/providers/user";

export async function loader({ context }) {
  const container = context.riverContainer;

  // Trigger and wait for the async provider to fetch data
  await container.read(userProfileProvider.future);

  // You can also manually set synchronous state providers
  // container.set(themeProvider, 'dark');

  // We don't need to return the data here since it's already in the container
  return null;
}
```

### 1.3. Dehydrate and Hydrate in Root

In the `loader` of your `root.tsx`, dehydrate the container containing all the fetched states and return it. Then, wrap your application in `<RiverScope>` using the initial state.

```tsx
// src/root.tsx
import { useLoaderData, Outlet, Scripts } from "react-router";
import { RiverScope } from "@stball/react-river";

// The root loader runs after/alongside child loaders
export async function loader({ context }) {
  const container = context.riverContainer;

  // Dehydrate the container into a serializable JSON state
  return {
    riverInitialState: container.dehydrate(),
  };
}

export default function App() {
  const { riverInitialState } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>{/* Meta, Links */}</head>
      <body>
        {/* The frontend will hydrate this state, preventing duplicate API calls */}
        <RiverScope initialState={riverInitialState}>
          <Outlet />
        </RiverScope>

        <Scripts />
      </body>
    </html>
  );
}
```

---

## 2. Route-Level Hydration (Alternative)

If you cannot modify the Server Context or prefer each route to independently manage its hydration, you can complete the entire process within individual route `loader`s.

```tsx
// src/pages/training/index.tsx
import { useLoaderData } from "react-router";
import { RiverContainer, RiverScope, useRiverWatch } from "@stball/react-river";
import { trainingListProvider } from "~/providers/training";

// 1. Loader: Create a local Container -> Fetch Data -> Dehydrate
export async function loader() {
  const container = new RiverContainer();

  // Wait for data to be ready
  await container.read(trainingListProvider.future);

  // Return the dehydrated local state
  return {
    initialState: container.dehydrate(),
  };
}

// 2. Component: Hydrate the local RiverScope
export default function TrainingPage() {
  const { initialState } = useLoaderData<typeof loader>();

  return (
    <RiverScope initialState={initialState}>
      <TrainingContent />
    </RiverScope>
  );
}

// 3. Child Component: Consumes state immediately without loading phase
function TrainingContent() {
  const data = useRiverWatch(trainingListProvider);

  return (
    <div>
      <h1>Training List</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

---

## 💡 Important Notes

- **Hydration Mismatch:** Ensure all `Provider`s are initialized with a unique `name` property so that `dehydrate` and `hydrate` can accurately map states between Server and Client.
- **Stale-While-Revalidate:** When hydrating via `<RiverScope initialState={...}>`, async providers will default to the hydrated state. If you want to silently refetch data in the background, ensure your Provider's logic accommodates this behavior.
