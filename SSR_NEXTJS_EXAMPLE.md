# React River SSR Example (Next.js)

This example demonstrates how to implement Server-Side Rendering (SSR) with React River and Next.js (Pages Router).

## 1. Define your Providers

Create a file for your product state. Ensure you provide a `name` to the provider for SSR matching.

```tsx
// providers/product.ts
import { promiseProvider } from '@stball/react-river';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

// Mock fetch function
const fetchProduct = async (id: string): Promise<Product> => {
  // In a real app, this would be an API call
  return {
    id,
    name: 'Logix Pro Mouse',
    price: 59.99,
    description: 'High-performance wireless gaming mouse.',
  };
};

export const productProvider = promiseProvider(
  async (ref) => {
    // In a real app, you might read an ID from another provider or context
    return fetchProduct('prod_123');
  },
  { name: 'productData' },
); // Name is required for SSR hydration
```

## 2. Setup `_app.tsx`

Inject the dehydrated state into the `RiverScope`.

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { RiverScope } from '@stball/react-river';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    // initialState is passed from getServerSideProps
    <RiverScope initialState={pageProps.initialRiverState}>
      <Component {...pageProps} />
    </RiverScope>
  );
}

export default MyApp;
```

## 3. Implement `getServerSideProps`

Fetch data on the server and dehydrate the container.

```tsx
// pages/product/[id].tsx
import { GetServerSideProps } from 'next';
import { RiverContainer, useRiverWatch, when } from '@stball/react-river';
import { productProvider } from '../../providers/product';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const container = new RiverContainer();

  // 1. Trigger the fetch and wait for resolution
  // We use .promise accessor to await the actual data
  await container.read(productProvider.promise);

  // 2. Dehydrate the container to get a serializable state object
  const initialRiverState = container.dehydrate();

  return {
    props: {
      initialRiverState,
    },
  };
};

export default function ProductPage() {
  const productValue = useRiverWatch(productProvider);

  return (
    <div>
      <h1>Product Detail</h1>
      {when(productValue, {
        data: (product) => (
          <div>
            <h2>{product.name}</h2>
            <p>Price: ${product.price}</p>
            <p>{product.description}</p>
          </div>
        ),
        loading: () => <p>Loading...</p>,
        error: (err) => <p>Error: {String(err)}</p>,
      })}
    </div>
  );
}
```

## 4. Advanced: Handling Complex Types

If your state contains complex objects like Class instances or dates that aren't natively serializable to JSON, you can use `toJSON` and `fromJSON` hooks.

```tsx
// models/User.ts
export class User {
  id: number;
  name: string;
  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }
  get greeting() {
    return `Hello, ${this.name}!`;
  }
}

// providers/user.ts
export const userProvider = stateProvider(() => new User(0, 'Guest'), {
  name: 'user',
  // Transform Class instance to plain object for SSR transfer
  toJSON: (user) => ({ id: user.id, name: user.name }),
  // Reconstruct Class instance on the client after hydration
  fromJSON: (json) => new User(json.id, json.name),
});
```

### SSR Options Summary

| Option     | Description                                                                                                     |
| :--------- | :-------------------------------------------------------------------------------------------------------------- |
| `name`     | **Required** for SSR. Used as the key in the state object.                                                      |
| `ssr`      | Set to `false` to exclude a provider from SSR (e.g., sensitive tokens). Defaults to `true` for named providers. |
| `toJSON`   | Custom serialization logic. Validates that returned value is serializable.                                      |
| `fromJSON` | Custom hydration logic. Runs on the client when recovering state.                                               |

## How it works

1.  **Server Side**: `getServerSideProps` runs. It creates a `RiverContainer`, reads the `productProvider`, and waits for the promise to resolve.
2.  **Dehydration**: `container.dehydrate()` picks up the resolved value of `productData` and returns `{ "productData": { ... } }`. If a provider has `toJSON`, it is called first.
3.  **Transfer**: Next.js sends this object to the client in `pageProps`.
4.  **Client Hydration**: `RiverScope` receives `initialState`. When `ProductPage` renders and calls `useRiverWatch(productProvider)`, the container sees it already has a hydrated value for `"productData"`. If `fromJSON` is present, it transforms the data before use.
5.  **No Loading Flash**: The UI renders with the data immediately on the client, matching the HTML sent from the server.
