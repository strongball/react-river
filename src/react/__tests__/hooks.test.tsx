import React, { useState } from 'react';

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { RiverContainer } from '../../core/container';
import { stateProvider } from '../../core/provider';
import { useRiverWatch, useRiverRef, useRiverListen } from '../hooks';
import { RiverScope, useRiverContainer } from '../scope';

const counterProvider = stateProvider(() => 0, { name: 'test_stateProvider_400' });

describe('React Hooks', () => {
  it('useRiverWatch should track state changes', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

    const { result } = renderHook(
      () => {
        const count = useRiverWatch(counterProvider);
        const ref = useRiverRef();
        return { count, ref };
      },
      { wrapper },
    );

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.ref.set(counterProvider, 1);
    });

    expect(result.current.count).toBe(1);

    act(() => {
      result.current.ref.set(counterProvider, (prev) => prev + 1);
    });

    expect(result.current.count).toBe(2);
  });

  it('useRiverWatch should support selectors', () => {
    const userProvider = stateProvider(() => ({ name: 'John', age: 30 }), { name: 'test_stateProvider_1244' });

    const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

    const { result } = renderHook(
      () => {
        const name = useRiverWatch(userProvider, (u) => u.name);
        const ref = useRiverRef();
        return { name, ref };
      },
      { wrapper },
    );

    expect(result.current.name).toBe('John');

    act(() => {
      result.current.ref.set(userProvider, { name: 'Doe', age: 30 });
    });

    expect(result.current.name).toBe('Doe');
  });

  it('useRiverListen should trigger callback without re-rendering', () => {
    const callback = vi.fn();
    let renderCount = 0;

    const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

    const { result } = renderHook(
      () => {
        renderCount++;
        useRiverListen(counterProvider, callback);
        return useRiverRef();
      },
      { wrapper },
    );

    expect(renderCount).toBe(1);
    expect(callback).toHaveBeenCalledTimes(0);

    act(() => {
      result.current.set(counterProvider, 100);
    });

    expect(renderCount).toBe(1);
    expect(callback).toHaveBeenCalledWith(100, 0);
  });

  it('useRiverRef should provide access to refresh and invalidate', () => {
    let count = 0;
    const p = stateProvider(() => ++count, { name: 'test_stateProvider_2630' });

    const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

    const { result } = renderHook(() => useRiverRef(), { wrapper });

    expect(result.current.read(p)).toBe(1);

    act(() => {
      result.current.invalidate(p);
    });
    expect(result.current.read(p)).toBe(2);

    let val: number = 0;
    act(() => {
      val = result.current.refresh(p);
    });
    expect(val).toBe(3);
    expect(result.current.read(p)).toBe(3);
  });

  it('useRiverWatch should handle cache optimization branches', () => {
    const objProvider = stateProvider(() => ({ meta: { updated: false }, data: 1 }), { name: 'test_stateProvider_3285' });
    const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

    const { result } = renderHook(
      () => {
        const data = useRiverWatch(objProvider, (o) => o.data);
        const ref = useRiverRef();
        return { data, ref };
      },
      { wrapper },
    );

    expect(result.current.data).toBe(1);

    // Update different field — so selected value is unchanged
    act(() => {
      result.current.ref.set(objProvider, (prev) => ({ ...prev, meta: { updated: true } }));
    });
    expect(result.current.data).toBe(1);
  });

  it('RiverScope - behavior of global vs local providers across nested scopes', () => {
    // Global provider: should inherit/share state via root container
    const globalP = stateProvider(() => 1, { name: 'test_stateProvider_4153',  global: true });
    // Local provider: should be isolated in each scope by default
    const localP = stateProvider(() => 2, { name: 'test_stateProvider_4281' });

    const { result } = renderHook(
      () => {
        const ref = useRiverRef();
        return {
          global: ref.read(globalP),
          local: ref.read(localP),
        };
      },
      {
        wrapper: ({ children }) => (
          // Outer scope overrides both.
          // Note: For globals, this only works if this container is seen as the "root"
          // for the hierarchy under test.
          <RiverScope
            overrides={[
              { original: globalP, create: () => 10 },
              { original: localP, create: () => 20 },
            ]}
          >
            {/* Inner scope defaults localP back to factory because it's isolated */}
            <RiverScope>{children}</RiverScope>
          </RiverScope>
        ),
      },
    );

    // Global inherits state (10) as it resolves at the shared ancestor/root
    expect(result.current.global).toBe(10);
    // Local is isolated in the inner scope's container, using its own initializer (defaults to 2)
    expect(result.current.local).toBe(2);
  });

  it('useRiverContainer should throw when used outside scope', () => {
    // Disable console.error for this test to keep output clean from expected React error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useRiverContainer())).toThrow(/must be used within a/);
    spy.mockRestore();
  });

  it('RiverScope should handle deferred disposal branches', () => {
    vi.useFakeTimers();
    const container = new RiverContainer();
    const c = container as any;

    // Simulate what scope.tsx does:
    // 1. Unmount schedules disposal
    c._disposeTimeout = setTimeout(() => container.dispose(), 100);

    // 2. Remount (before 100ms) cancels it
    if (c._disposeTimeout) {
      clearTimeout(c._disposeTimeout);
      c._disposeTimeout = undefined;
    }

    expect(container.disposed).toBe(false);

    // 3. Let time pass
    vi.advanceTimersByTime(200);
    expect(container.disposed).toBe(false);
    vi.useRealTimers();
  });

  // ── Stale external state in selector ──────────────────────────

  /**
   * Bug: When a selector closes over an external React state value,
   * updating that external state should cause the hook to return a new
   * selected value — even if the provider's raw value hasn't changed.
   *
   * Without the fix, the rawValue cache hits and returns the stale selected
   * value because `cacheRef.rawValue === rawValue` still holds.
   */
  it('useRiverWatch selector should reflect updated external React state (no provider change)', () => {
    const itemsProvider = stateProvider(
      () => [
        { id: 1, status: 'active' },
        { id: 2, status: 'inactive' },
      ],
      { name: 'test_stateProvider_selector_external_1' },
    );

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RiverScope>{children}</RiverScope>
    );

    const { result } = renderHook(
      () => {
        const [filter, setFilter] = useState<'active' | 'inactive' | 'all'>('all');

        // Selector closes over the external `filter` React state
        const filtered = useRiverWatch(
          itemsProvider,
          (items) => items.filter((i) => filter === 'all' || i.status === filter),
        );

        return { filtered, setFilter };
      },
      { wrapper },
    );

    // Initially, all items visible
    expect(result.current.filtered).toHaveLength(2);

    // Change external filter state — provider value does NOT change
    act(() => {
      result.current.setFilter('active');
    });

    // Should now only return the active item
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe(1);

    // Change filter again
    act(() => {
      result.current.setFilter('inactive');
    });

    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.filtered[0].id).toBe(2);
  });

  /**
   * Ensures the cache doesn't return the stale selectedValue when the selector's
   * semantic changes (due to external state), even though rawValue is identical.
   *
   * This is the cache bail-out scenario: rawValue unchanged, but selector changed.
   */
  it('useRiverWatch cache should not return stale value when selector semantics change', () => {
    const multiplierProvider = stateProvider(() => 10, {
      name: 'test_stateProvider_selector_external_2',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RiverScope>{children}</RiverScope>
    );

    const { result } = renderHook(
      () => {
        const [multiplier, setMultiplier] = useState(2);

        // selector closes over `multiplier`; if cache isn't invalidated
        // when `multiplier` changes, this will return stale results.
        const computed = useRiverWatch(
          multiplierProvider,
          (value) => value * multiplier,
        );

        return { computed, setMultiplier };
      },
      { wrapper },
    );

    // 10 * 2 = 20
    expect(result.current.computed).toBe(20);

    // Change multiplier — multiplierProvider raw value stays at 10
    act(() => {
      result.current.setMultiplier(3);
    });

    // Should now be 10 * 3 = 30, not the stale 20
    expect(result.current.computed).toBe(30);
  });

  it('useRiverWatch should support selector within options object', () => {
    const userProvider = stateProvider(() => ({ name: 'John', age: 30 }), { name: 'test_stateProvider_opts_selector' });
    const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

    const { result } = renderHook(
      () => {
        const name = useRiverWatch(userProvider, { selector: (u) => u.name });
        const ref = useRiverRef();
        return { name, ref };
      },
      { wrapper },
    );

    expect(result.current.name).toBe('John');

    act(() => {
      result.current.ref.set(userProvider, { name: 'Doe', age: 30 });
    });

    expect(result.current.name).toBe('Doe');
  });

  it('useRiverWatch should support enabled: false and not subscribe or read initially', () => {
    let buildCount = 0;
    const lazyProvider = stateProvider(() => {
      buildCount++;
      return 'lazy';
    }, { name: 'test_stateProvider_lazy' });

    const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

    const { result } = renderHook(
      () => {
        const [enabled, setEnabled] = useState(false);
        const value = useRiverWatch(lazyProvider, { enabled });
        const ref = useRiverRef();
        return { value, setEnabled, ref };
      },
      { wrapper },
    );

    // Should not initialize provider if disabled
    expect(buildCount).toBe(0);
    expect(result.current.value).toBeUndefined();

    // Enable it
    act(() => {
      result.current.setEnabled(true);
    });

    // Now it should initialize and return the value
    expect(buildCount).toBe(1);
    expect(result.current.value).toBe('lazy');

    // Update value while enabled
    act(() => {
      result.current.ref.set(lazyProvider, 'updated');
    });
    expect(result.current.value).toBe('updated');

    // Disable it again
    act(() => {
      result.current.setEnabled(false);
    });

    // Should keep returning the last cached value (stale-while-disabled)
    expect(result.current.value).toBe('updated');

    // Update value while disabled
    act(() => {
      result.current.ref.set(lazyProvider, 'ignored');
    });

    // Should NOT have received the update
    expect(result.current.value).toBe('updated');

    // Enable again — should receive the latest value
    act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.value).toBe('ignored');
  });
});

