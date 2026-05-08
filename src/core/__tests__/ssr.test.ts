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

  it('ignores providers without a name', () => {
    const unnamed = stateProvider(() => 42);
    const named = stateProvider(() => 'ok', { name: 'named' });
    const container = new RiverContainer();

    container.read(unnamed);
    container.read(named);
    const state = container.dehydrate();

    expect(state).toEqual({ named: 'ok' });
    expect(Object.keys(state)).toHaveLength(1);
  });

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
