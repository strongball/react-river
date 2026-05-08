# React River SSR Example (Next.js)

This example demonstrates how to implement Server-Side Rendering (SSR) with React River and Next.js (Pages Router).

## 1. Define your Providers

Create a file for your product state. Ensure you provide a `name` to the provider for SSR matching.

```tsx
// providers/product.ts
import { promiseProvider } from '@zerologix/react-river';

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
    description: 'High-performance wireless gaming mouse.'
  };
};

export const productProvider = promiseProvider(async (ref) => {
  // In a real app, you might read an ID from another provider or context
  return fetchProduct('prod_123');
}, { name: 'productData' }); // Name is required for SSR hydration
```

## 2. Setup `_app.tsx`

Inject the dehydrated state into the `RiverScope`.

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app';
import { RiverScope } from '@zerologix/react-river';

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
import { RiverContainer, useRiverWatch, when } from '@zerologix/react-river';
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

## How it works

1.  **Server Side**: `getServerSideProps` runs. It creates a `RiverContainer`, reads the `productProvider`, and waits for the promise to resolve.
2.  **Dehydration**: `container.dehydrate()` picks up the resolved value of `productData` and returns `{ "productData": { ... } }`.
3.  **Transfer**: Next.js sends this object to the client in `pageProps`.
4.  **Client Hydration**: `RiverScope` receives `initialState`. When `ProductPage` renders and calls `useRiverWatch(productProvider)`, the container sees it already has a hydrated value for `"productData"`.
5.  **No Loading Flash**: The UI renders with the data immediately on the client, matching the HTML sent from the server. The client-side factory still runs in the background to ensure data is fresh, but the user sees the data right away.
