import { describe, expect, it, vi } from 'vitest';
import { RiverContainer } from '../container';
import { provider, stateProvider, promiseProvider, notifierProvider } from '../provider';
import { Notifier } from '../notifier';
import { asyncData, asyncLoading } from '../async_value';

import type { AsyncValue } from '../async_value';

// ── Helpers ────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── dehydrate() ────────────────────────────────────────────────

describe('dehydrate()', () => {
  it('exports named providers as a plain object', () => {
    const greetingProvider = stateProvider(() => 'hello', { name: 'greeting' });
    const container = new RiverContainer();

    container.read(greetingProvider);
    const state = container.dehydrate();

    expect(state).toEqual({ greeting: 'hello' });
  });

  // Removed: ignores providers without a name (names are now mandatory)

  it('exports async provider data values (unwrapped)', async () => {
    const userProvider = promiseProvider(() => Promise.resolve({ id: 1, name: 'John' }), {
      name: 'user',
    });
    const container = new RiverContainer();

    container.read(userProvider);
    await delay(10); // wait for promise to resolve

    const state = container.dehydrate();
    expect(state).toEqual({ user: { id: 1, name: 'John' } });
  });

  it('skips async providers that are still loading', () => {
    const slowProvider = promiseProvider(() => new Promise(() => {}), { name: 'slow' });
    const container = new RiverContainer();

    container.read(slowProvider);
    const state = container.dehydrate();

    // Loading state should not be exported
    expect(state).toEqual({});
  });

  it('exports multiple named providers', () => {
    const themeProvider = stateProvider(() => 'dark', { name: 'theme' });
    const localeProvider = stateProvider(() => 'en', { name: 'locale' });
    const container = new RiverContainer();

    container.read(themeProvider);
    container.read(localeProvider);
    const state = container.dehydrate();

    expect(state).toEqual({ theme: 'dark', locale: 'en' });
  });

  it('exports read-only provider values', () => {
    const computedProvider = provider(() => 42, { name: 'computed' });
    const container = new RiverContainer();

    container.read(computedProvider);
    const state = container.dehydrate();

    expect(state).toEqual({ computed: 42 });
  });
});

// ── Hydration (initialState) ───────────────────────────────────

describe('hydration via initialState', () => {
  it('promiseProvider starts with hydrated value instead of loading', () => {
    const fetchUser = vi.fn(() => Promise.resolve({ id: 2, name: 'Fresh' }));
    const userProvider = promiseProvider(fetchUser, { name: 'user' });

    const container = new RiverContainer({
      initialState: { user: { id: 1, name: 'Hydrated' } },
    });

    const value = container.read(userProvider) as AsyncValue<{ id: number; name: string }>;

    // Should start with hydrated data, not loading
    expect(value).toEqual(asyncData({ id: 1, name: 'Hydrated' }));
    // Factory should still be called (client re-fetches)
    expect(fetchUser).toHaveBeenCalledOnce();
  });

  it('promiseProvider updates to fresh data after factory resolves', async () => {
    const userProvider = promiseProvider(
      () => Promise.resolve({ id: 2, name: 'Fresh' }),
      { name: 'user' },
    );

    const container = new RiverContainer({
      initialState: { user: { id: 1, name: 'Hydrated' } },
    });

    container.read(userProvider);
    await delay(10);

    const value = container.read(userProvider) as AsyncValue<{ id: number; name: string }>;
    expect(value).toEqual(asyncData({ id: 2, name: 'Fresh' }));
  });

  it('notifierProvider uses hydrated value as initial state', () => {
    class CounterNotifier extends Notifier<number> {
      build() {
        return 0;
      }
      increment() {
        this.state = this.state + 1;
      }
    }

    const counterProvider = notifierProvider(() => new CounterNotifier(), { name: 'counter' });

    const container = new RiverContainer({
      initialState: { counter: 42 },
    });

    const value = container.read(counterProvider);
    expect(value).toBe(42);
  });

  it('unnamed providers are not affected by initialState', () => {
    const unnamed = promiseProvider(() => Promise.resolve('data'));

    const container = new RiverContainer({
      initialState: { unnamed: 'should-not-match' },
    });

    const value = container.read(unnamed);
    // Should be loading since unnamed providers can't match initialState keys
    expect(value).toEqual(asyncLoading());
  });

  it('providers not in initialState initialize normally', () => {
    const otherProvider = stateProvider(() => 'default', { name: 'other' });

    const container = new RiverContainer({
      initialState: { unrelated: 'value' },
    });

    const value = container.read(otherProvider);
    expect(value).toBe('default');
  });
});

// ── Full SSR round-trip ────────────────────────────────────────

describe('SSR round-trip (dehydrate → hydrate)', () => {
  it('dehydrated state can hydrate a new container', async () => {
    // Server-side: create container, initialize providers, dehydrate
    const themeProvider = stateProvider(() => 'dark', { name: 'theme' });
    const userProvider = promiseProvider(
      () => Promise.resolve({ id: 1, name: 'John' }),
      { name: 'user' },
    );

    const serverContainer = new RiverContainer();
    serverContainer.read(themeProvider);
    serverContainer.read(userProvider);
    await delay(10);

    const dehydrated = serverContainer.dehydrate();
    expect(dehydrated).toEqual({
      theme: 'dark',
      user: { id: 1, name: 'John' },
    });

    // Client-side: create new container with dehydrated state
    const clientContainer = new RiverContainer({ initialState: dehydrated });

    // Theme should be immediately available
    expect(clientContainer.read(themeProvider)).toBe('dark');

    // User should start with hydrated data (no loading flash)
    const userValue = clientContainer.read(userProvider) as AsyncValue<{ id: number; name: string }>;
    expect(userValue).toEqual(asyncData({ id: 1, name: 'John' }));
  });
});

// ── Family Providers ───────────────────────────────────────────

describe('familyProvider SSR', () => {
  it('dehydrates family provider instances with formatted names', async () => {
    const { promiseProviderFamily } = await import('../family');
    const userFamily = promiseProviderFamily(
      (_ref, id: number) => Promise.resolve({ id, name: `User ${id}` }),
      { name: 'user' },
    );

    const container = new RiverContainer();
    container.read(userFamily(123));
    await delay(10);

    const state = container.dehydrate();
    expect(state).toEqual({
      'user(123)': { id: 123, name: 'User 123' },
    });
  });

  it('hydrates family provider instances using formatted names', async () => {
    const { promiseProviderFamily } = await import('../family');
    const userFamily = promiseProviderFamily(
      (_ref, id: number) => Promise.resolve({ id, name: `User ${id}` }),
      { name: 'user' },
    );

    const container = new RiverContainer({
      initialState: {
        'user(456)': { id: 456, name: 'Hydrated User' },
      },
    });

    // User should start with hydrated data (no loading flash)
    const userValue = container.read(userFamily(456));
    expect(userValue).toEqual(asyncData({ id: 456, name: 'Hydrated User' }));
  });
});

// ── SSR Options (ssr flag, toJSON, fromJSON) ───────────────────

describe('SSR options', () => {
  it('ssr: false excludes provider from dehydration', () => {
    const secretProvider = stateProvider(() => 'secret-token', { name: 'secret', ssr: false });
    const publicProvider = stateProvider(() => 'public', { name: 'public' });
    const container = new RiverContainer();

    container.read(secretProvider);
    container.read(publicProvider);

    const state = container.dehydrate();
    expect(state).toEqual({ public: 'public' });
    expect(state).not.toHaveProperty('secret');
  });

  it('default behavior: named providers participate in SSR (ssr defaults to true)', () => {
    const themeProvider = stateProvider(() => 'dark', { name: 'theme' });
    const container = new RiverContainer();
    container.read(themeProvider);

    const state = container.dehydrate();
    expect(state).toEqual({ theme: 'dark' });
  });

  it('non-serializable values are still skipped with warning even without explicit ssr flag', () => {
    class User {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      greet() { return `Hi, ${this.name}`; }
    }

    const userProvider = stateProvider(() => new User('John'), { name: 'user' });
    const container = new RiverContainer();
    container.read(userProvider);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = container.dehydrate();

    // Non-serializable → skipped from output
    expect(state).not.toHaveProperty('user');
    // Warning is issued in dev mode
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('toJSON transforms the exported value', () => {
    class Product {
      id: number;
      name: string;
      private _internal: string;
      constructor(id: number, name: string, internal: string) {
        this.id = id;
        this.name = name;
        this._internal = internal;
      }
    }

    const productProvider = stateProvider(
      () => new Product(1, 'Widget', 'secret'),
      {
        name: 'product',
        toJSON: (product: Product) => ({ id: product.id, name: product.name }),
      },
    );
    const container = new RiverContainer();
    container.read(productProvider);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const state = container.dehydrate();

    expect(state).toEqual({ product: { id: 1, name: 'Widget' } });
    // toJSON output is serializable, so no warning
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('toJSON works with async providers (transforms unwrapped data)', async () => {
    const userProvider = promiseProvider(
      () => Promise.resolve({ id: 1, name: 'John', password: 'secret' }),
      {
        name: 'user',
        toJSON: (data: any) => ({ id: data.id, name: data.name }),
      },
    );
    const container = new RiverContainer();
    container.read(userProvider);
    await new Promise((r) => setTimeout(r, 10));

    const state = container.dehydrate();
    expect(state).toEqual({ user: { id: 1, name: 'John' } });
  });

  it('fromJSON transforms the hydrated value', () => {
    class User {
      id: number;
      name: string;
      constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
      }
      greet() { return `Hi, ${this.name}`; }
    }

    const userProvider = stateProvider(
      () => new User(0, 'default'),
      {
        name: 'user',
        fromJSON: (json: any) => new User(json.id, json.name),
      },
    );

    const container = new RiverContainer({
      initialState: { user: { id: 1, name: 'Hydrated' } },
    });

    const value = container.read(userProvider);
    expect(value).toBeInstanceOf(User);
    expect(value.greet()).toBe('Hi, Hydrated');
  });

  it('fromJSON works with async providers', () => {
    class UserData {
      id: number;
      name: string;
      constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
      }
      display() { return `${this.id}: ${this.name}`; }
    }

    const userProvider = promiseProvider(
      () => Promise.resolve(new UserData(2, 'Fresh')),
      {
        name: 'user',
        fromJSON: (json: any) => new UserData(json.id, json.name),
      },
    );

    const container = new RiverContainer({
      initialState: { user: { id: 1, name: 'Hydrated' } },
    });

    const value = container.read(userProvider) as AsyncValue<UserData>;
    expect(value.status).toBe('data');
    expect(value.data).toBeInstanceOf(UserData);
    expect(value.data!.display()).toBe('1: Hydrated');
  });

  it('toJSON + fromJSON round-trip', async () => {
    class Config {
      theme: string;
      locale: string;
      constructor(theme: string, locale: string) {
        this.theme = theme;
        this.locale = locale;
      }
      label() { return `${this.theme}/${this.locale}`; }
    }

    const options = {
      name: 'config',
      toJSON: (c: Config) => ({ theme: c.theme, locale: c.locale }),
      fromJSON: (json: any) => new Config(json.theme, json.locale),
    };

    // Server
    const serverContainer = new RiverContainer();
    const configProvider = stateProvider(() => new Config('dark', 'en'), options);
    serverContainer.read(configProvider);

    const dehydrated = serverContainer.dehydrate();
    expect(dehydrated).toEqual({ config: { theme: 'dark', locale: 'en' } });

    // Client
    const clientContainer = new RiverContainer({ initialState: dehydrated });
    const value = clientContainer.read(configProvider);
    expect(value).toBeInstanceOf(Config);
    expect(value.label()).toBe('dark/en');
  });
});
