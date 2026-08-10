import { describe, it, expect, vi } from 'vitest';

import { RiverContainer } from '../container';
import { createProviderState } from '../container_types';
import { Notifier, AsyncNotifier } from '../notifier';
import {
  provider,
  stateProvider,
  promiseProvider,
  observableProvider,
  notifierProvider,
  asyncNotifierProvider,
} from '../provider';

describe('RiverContainer', () => {
  it('should read initial value from provider', () => {
    const container = new RiverContainer();
    const p = provider(() => 'hello', { name: 'test_provider_508' });

    expect(container.read(p)).toBe('hello');
  });

  it('should keep state between reads', () => {
    const container = new RiverContainer();
    let count = 0;
    const p = provider(() => ++count, { name: 'test_provider_742' });

    expect(container.read(p)).toBe(1);
    expect(container.read(p)).toBe(1);
  });

  it('should support stateProvider and set', () => {
    const container = new RiverContainer();
    const counter = stateProvider(() => 0, { name: 'test_stateProvider_1001' });

    expect(container.read(counter)).toBe(0);

    container.set(counter, 10);
    expect(container.read(counter)).toBe(10);

    container.set(counter, (prev) => prev + 5);
    expect(container.read(counter)).toBe(15);
  });

  it('should track dependencies and recompute', () => {
    const container = new RiverContainer();
    const base = stateProvider(() => 10, { name: 'test_stateProvider_1406' });
    const doubled = provider((ref) => ref.watch(base) * 2, { name: 'test_provider_1414' });

    expect(container.read(doubled)).toBe(20);

    container.set(base, 20);
    expect(container.read(doubled)).toBe(40);
  });

  it('should detect circular dependencies', () => {
    const container = new RiverContainer();

    // We need to use type casting or late definitions to create a loop
    const p1: any = provider((ref) => ref.watch(p2), { name: 'test_provider_1805' });
    const p2: any = provider((ref) => ref.watch(p1), { name: 'test_provider_1891' });

    expect(() => container.read(p1)).toThrow(/Circular dependency/);
  });

  it('should invalidate state', () => {
    const container = new RiverContainer();
    let count = 0;
    const p = provider(() => ++count, { name: 'test_provider_2151' });

    expect(container.read(p)).toBe(1);
    container.invalidate(p);
    expect(container.read(p)).toBe(2);
  });

  it('should support overrides', () => {
    const p = provider(() => 'original', { name: 'test_provider_2378' });
    const container = new RiverContainer({
      overrides: [{ original: p, create: () => 'overridden' }],
    });

    expect(container.read(p)).toBe('overridden');
  });

  it('should support scoped containers with overrides', () => {
    const p = provider(() => 'root', { name: 'test_provider_2689' });
    const root = new RiverContainer();
    const child = new RiverContainer({
      parent: root,
      overrides: [{ original: p, create: () => 'child' }],
    });

    expect(root.read(p)).toBe('root');
    expect(child.read(p)).toBe('child');
  });

  describe('Overrides for notifierProvider and asyncNotifierProvider', () => {
    it('notifierProvider override: create() should be called instead of the original notifier factory', () => {
      class OriginalNotifier extends Notifier<string> {
        build() {
          return 'original';
        }
      }
      const p = notifierProvider(() => new OriginalNotifier(), { name: 'test_notifierProvider_3400' });

      const overrideValue = 'overridden';
      const container = new RiverContainer({
        overrides: [{ original: p, create: () => overrideValue }],
      });

      // Bug: without the fix, this returns 'original' because override is ignored
      expect(container.read(p)).toBe('overridden');
    });

    it('notifierProvider override: scoped child container should use overridden value', () => {
      class OriginalNotifier extends Notifier<number> {
        build() {
          return 0;
        }
      }
      const p = notifierProvider(() => new OriginalNotifier(), { name: 'test_notifierProvider_4022' });

      const root = new RiverContainer();
      const child = new RiverContainer({
        parent: root,
        overrides: [{ original: p, create: () => 999 }],
      });

      expect(root.read(p)).toBe(0);
      // Bug: without the fix, child also returns 0
      expect(child.read(p)).toBe(999);
    });

    it('asyncNotifierProvider override: create() should be called instead of the original notifier factory', async () => {
      class OriginalAsyncNotifier extends AsyncNotifier<string> {
        async build() {
          return 'original';
        }
      }
      const p = asyncNotifierProvider(() => new OriginalAsyncNotifier(), { name: 'test_asyncNotifierProvider_4695' });

      const overrideResolved = 'overridden-async';
      const container = new RiverContainer({
        overrides: [
          {
            original: p,
            create: () => Promise.resolve(overrideResolved),
          },
        ],
      });

      // Bug: without the fix, the override create() is not called at all,
      // so the original AsyncNotifier.build() runs and produces asyncLoading → 'original'
      const result = container.read(p);
      // Both original and override start as loading, but check which build() ran
      expect(result.status).toBe('loading');

      // With the fix, the override promise resolves to 'overridden-async'
      const data = await container.read(p.promise);
      expect(data).toBe('overridden-async');
    });

    it('notifierProvider override: ref passed to create() is functional', () => {
      const base = notifierProvider(
        () =>
          new (class extends Notifier<number> {
            build() {
              return 42;
            }
          })(),
        { name: 'base' },
      );

      class OriginalNotifier extends Notifier<string> {
        build() {
          return 'should-not-be-used';
        }
      }
      const p = notifierProvider(() => new OriginalNotifier(), { name: 'test_notifierProvider_5934' });

      const container = new RiverContainer({
        overrides: [
          {
            original: p,
            create: (ref) => `value-is-${ref.read(base)}`,
          },
        ],
      });

      // Bug: without fix, original notifier runs and returns 'should-not-be-used'
      expect(container.read(p)).toBe('value-is-42');
    });
  });

  it('should notify observers', () => {
    const p = stateProvider(() => 0, { name: 'test_stateProvider_6305' });
    const observer = {
      onProviderCreate: vi.fn(),
      onProviderUpdate: vi.fn(),
      onProviderDispose: vi.fn(),
    };

    const container = new RiverContainer({ observers: [observer] });

    container.read(p);
    expect(observer.onProviderCreate).toHaveBeenCalledWith(p, 0);

    container.set(p, 1);
    expect(observer.onProviderUpdate).toHaveBeenCalledWith(p, 0, 1);

    container.dispose();
    expect(observer.onProviderDispose).toHaveBeenCalledWith(p);
  });

  it('should handle auto-dispose via microtask', async () => {
    const p = provider(
      (ref) => {
        let disposed = false;
        ref.onDispose(() => {
          disposed = true;
        });
        return {
          setDisposed: (v: boolean) => {
            disposed = v;
          },
          isDisposed: () => disposed,
        };
      },
      { name: 'disposable', cacheTime: 0 },
    ); // Use 0 for immediate microtask dispose

    const container = new RiverContainer();
    const val = container.read(p) as any;
    expect(val.isDisposed()).toBe(false);

    container.invalidate(p);
    expect(val.isDisposed()).toBe(true);

    const unsubscribe = container.subscribe(p, () => {});
    unsubscribe();

    // Wait for microtask
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

    expect(val.isDisposed()).toBe(true);
  });

  it('should handle invalidated with listeners', () => {
    const container = new RiverContainer();
    let count = 0;
    const p = stateProvider(() => ++count, { name: 'test_stateProvider_7767' });

    const listener = vi.fn();
    container.listen(p, listener);

    expect(container.read(p)).toBe(1);

    container.invalidate(p);
    expect(container.read(p)).toBe(2);
    expect(listener).toHaveBeenCalledWith(2, 1);
  });

  it('should support watch with selector', () => {
    const container = new RiverContainer();
    const user = stateProvider(() => ({ name: 'Alice', age: 25 }), { name: 'test_stateProvider_8177' });

    let computeCount = 0;
    const nameOnly = provider(
      (ref) => {
        computeCount++;
        return ref.watch(user, (u) => u.name);
      },
      { name: 'test_provider_8128' },
    );

    expect(container.read(nameOnly)).toBe('Alice');
    expect(computeCount).toBe(1);

    // Update unrelated property
    container.set(user, (u) => ({ ...u, age: 26 }));
    container.read(nameOnly);
    expect(computeCount).toBe(1); // Should NOT recompute because name is same

    // Update watched property
    container.set(user, (u) => ({ ...u, name: 'Bob' }));
    expect(container.read(nameOnly)).toBe('Bob');
    expect(computeCount).toBe(2); // Should recompute
  });

  it('should handle global providers', () => {
    const root = new RiverContainer();
    const child = new RiverContainer({ parent: root });

    const globalP = stateProvider(() => 0, { name: 'test_stateProvider_9251', global: true });

    root.set(globalP, 1);
    expect(child.read(globalP)).toBe(1);

    child.set(globalP, 2);
    expect(root.read(globalP)).toBe(2);
  });

  it('should support refreshing a provider', () => {
    const container = new RiverContainer();
    let count = 0;
    const p = provider(() => ++count, { name: 'test_provider_9216' });

    expect(container.read(p)).toBe(1);
    const newVal = container.refresh(p);
    expect(newVal).toBe(2);
    expect(container.read(p)).toBe(2);
  });

  describe('Custom Equality', () => {
    it('stateProvider should bail out when custom equals returns true', () => {
      const p = stateProvider(() => ({ count: 0 }), {
        name: 'test_equality',
        equals: (prev, next) => prev.count === next.count,
      });
      const container = new RiverContainer();
      const listener = vi.fn();
      container.listen(p, listener);

      // Initial state
      expect(container.read(p)).toEqual({ count: 0 });

      // Update with same count - should bail out
      container.set(p, { count: 0 });
      expect(listener).not.toHaveBeenCalled();

      // Update with different count - should trigger
      container.set(p, { count: 1 });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(container.read(p)).toEqual({ count: 1 });
    });

    it('stateProvider should use default Object.is when equals is not provided', () => {
      const p = stateProvider(() => ({ count: 0 }), { name: 'test_no_equality' });
      const container = new RiverContainer();
      const listener = vi.fn();
      container.listen(p, listener);

      // Update with same content but different object reference
      container.set(p, { count: 0 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should work with functional updates', () => {
      const p = stateProvider(() => ({ count: 0, meta: 'foo' }), {
        name: 'test_functional_equality',
        equals: (prev, next) => prev.count === next.count,
      });
      const container = new RiverContainer();
      const listener = vi.fn();
      container.listen(p, listener);

      // Update meta only - count stays same - should bail out
      container.set(p, (prev) => ({ ...prev, meta: 'bar' }));
      expect(listener).not.toHaveBeenCalled();

      // Update count - should trigger
      container.set(p, (prev) => ({ ...prev, count: 1 }));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should respect custom equality during reinitialize (invalidate)', () => {
      let count = 0;
      const p = stateProvider(() => ({ val: ++count }), {
        name: 'test_reinit_equality',
        equals: (prev, next) => prev.val === next.val,
      });
      const container = new RiverContainer();
      const listener = vi.fn();
      container.listen(p, listener);

      expect(container.read(p)).toEqual({ val: 1 });

      // Invalidate but factory returns same value (if we mocked it, but here it increments)
      // So let's force it to return same value by controlling count
      count = 0; // next call to factory will return { val: 1 }
      container.invalidate(p);
      expect(container.read(p)).toEqual({ val: 1 });
      expect(listener).not.toHaveBeenCalled();

      // Invalidate and factory returns different value
      count = 1; // next call returns { val: 2 }
      container.invalidate(p);
      expect(container.read(p)).toEqual({ val: 2 });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Asynchronous Providers', () => {
    it('promiseProvider should handle basic promise resolution', async () => {
      const container = new RiverContainer();
      const p = promiseProvider(async () => 'hello', { name: 'test_promiseProvider_9799' });

      expect(container.read(p).status).toBe('loading');
      const data = await container.read(p.promise);
      expect(data).toBe('hello');
      expect(container.read(p).data).toBe('hello');
    });

    it('promiseProvider should handle errors', async () => {
      const container = new RiverContainer();
      const p = promiseProvider(
        async () => {
          throw new Error('fail');
        },
        { name: 'test_promiseProvider_10203' },
      );

      container.read(p);
      await expect(container.read(p.promise)).rejects.toThrow('fail');
      expect(container.read(p).status).toBe('error');
    });

    it('observableProvider should handle observable stream', () => {
      const container = new RiverContainer();
      let nextCb: (v: string) => void;
      const p = observableProvider(
        () => ({
          subscribe: (callbacks: any) => {
            nextCb = typeof callbacks === 'function' ? callbacks : callbacks.next;
            return { unsubscribe: () => {} };
          },
        }),
        { name: 'test_observableProvider_10646' },
      );

      expect(container.read(p).status).toBe('loading');
      nextCb!('first');
      expect(container.read(p).data).toBe('first');
      nextCb!('second');
      expect(container.read(p).data).toBe('second');
    });

    it('should support watching promiseAccessor with selector', async () => {
      const container = new RiverContainer();
      const p = promiseProvider(async () => ({ id: 1, name: 'test' }), { name: 'test_promiseProvider_11222' });
      const nameP = provider(
        (ref) => {
          return ref.watch(p.promise, (data) => data?.name.toUpperCase());
        },
        { name: 'test_provider_11034' },
      );

      const namePromise = container.read(nameP);
      expect(namePromise).toBeInstanceOf(Promise);
      const name = await namePromise;
      expect(name).toBe('TEST');
    });

    it('promiseProvider refresh should transition to loading with previous data', async () => {
      const container = new RiverContainer();
      let count = 0;
      const p = promiseProvider(async () => {
        count++;
        return `val-${count}`;
      }, { name: 'refresh_test_promise' });

      // Initial read - transitions to loading
      expect(container.read(p).status).toBe('loading');
      expect(container.read(p).data).toBeUndefined();

      // Wait for resolve
      await container.read(p.promise);
      expect(container.read(p).status).toBe('data');
      expect(container.read(p).data).toBe('val-1');

      // Refresh
      container.invalidate(p);

      // Value should be loading but retain previous data 'val-1'
      const loadingVal = container.read(p);
      expect(loadingVal.status).toBe('loading');
      expect(loadingVal.data).toBe('val-1');
      expect(loadingVal.hasData).toBe(true);

      // Wait for second resolve
      await container.read(p.promise);
      expect(container.read(p).status).toBe('data');
      expect(container.read(p).data).toBe('val-2');
    });

    it('observableProvider refresh should transition to loading with previous data', async () => {
      const container = new RiverContainer();
      let nextCb: (v: string) => void;
      let subscribeCount = 0;
      const p = observableProvider(
        () => {
          subscribeCount++;
          return {
            subscribe: (callbacks: any) => {
              nextCb = typeof callbacks === 'function' ? callbacks : callbacks.next;
              return { unsubscribe: () => {} };
            },
          };
        },
        { name: 'refresh_test_obs' },
      );

      // Initial read - loading
      expect(container.read(p).status).toBe('loading');
      expect(container.read(p).data).toBeUndefined();

      // Emit first value
      nextCb!('val-1');
      expect(container.read(p).status).toBe('data');
      expect(container.read(p).data).toBe('val-1');

      // Refresh
      container.invalidate(p);

      // Should be loading but retain previous data
      const loadingVal = container.read(p);
      expect(loadingVal.status).toBe('loading');
      expect(loadingVal.data).toBe('val-1');
      expect(loadingVal.hasData).toBe(true);

      // Emit second value
      nextCb!('val-2');
      expect(container.read(p).status).toBe('data');
      expect(container.read(p).data).toBe('val-2');
    });

    it('asyncNotifierProvider refresh should transition to loading with previous data', async () => {
      const container = new RiverContainer();
      let count = 0;
      class TestAsyncNotifier extends AsyncNotifier<string> {
        async build() {
          count++;
          return `val-${count}`;
        }
      }

      const p = asyncNotifierProvider(() => new TestAsyncNotifier(), { name: 'refresh_test_notifier' });

      // Initial read - loading
      expect(container.read(p).status).toBe('loading');
      expect(container.read(p).data).toBeUndefined();

      // Wait for resolve
      await container.read(p.promise);
      expect(container.read(p).status).toBe('data');
      expect(container.read(p).data).toBe('val-1');

      // Refresh
      container.invalidate(p);

      // Should be loading but retain previous data
      const loadingVal = container.read(p);
      expect(loadingVal.status).toBe('loading');
      expect(loadingVal.data).toBe('val-1');
      expect(loadingVal.hasData).toBe(true);

      // Wait for second resolve
      await container.read(p.promise);
      expect(container.read(p).status).toBe('data');
      expect(container.read(p).data).toBe('val-2');
    });
  });

  it('should handle onCancel and onResume', async () => {
    const container = new RiverContainer();
    const onCancel = vi.fn();
    const onResume = vi.fn();

    const p = provider(
      (ref) => {
        ref.onCancel(onCancel);
        ref.onResume(onResume);
        return 'data';
      },
      { name: 'test_provider_11534' },
    );

    const unsubscribe = container.subscribe(p, () => {});
    expect(onCancel).not.toHaveBeenCalled();

    unsubscribe();
    expect(onCancel).toHaveBeenCalled();

    container.subscribe(p, () => {});
    expect(onResume).toHaveBeenCalled();
  });

  it('should support invalidateSelf', () => {
    const container = new RiverContainer();
    let count = 0;
    let refObj: any;
    const p = provider(
      (ref) => {
        refObj = ref;
        return ++count;
      },
      { name: 'test_provider_12072' },
    );

    expect(container.read(p)).toBe(1);

    refObj.invalidateSelf();
    expect(container.read(p)).toBe(2);
  });

  describe('Edge Cases & Branch Coverage', () => {
    it('observer error swallowing', () => {
      const brokenObserver: any = {
        onProviderInit: () => {
          throw new Error('broken');
        },
      };
      const container = new RiverContainer({ observers: [brokenObserver] });
      const p = provider(() => 1, { name: 'test_provider_12604' });
      expect(container.read(p)).toBe(1);
    });

    it('deep hierarchy getRootContainer and global delegation', () => {
      const root = new RiverContainer();
      const mid = new RiverContainer({ parent: root });
      const child = new RiverContainer({ parent: mid });

      const g = stateProvider(() => 0, { name: 'test_stateProvider_13495', global: true });
      child.set(g, 100);
      expect(root.read(g)).toBe(100);
      expect((child as any).states.has(g.id)).toBe(false);
    });

    it('resolvePromiseAccessor error and disposal safety', async () => {
      const p = promiseProvider(
        async () => {
          throw 'async-fail';
        },
        { name: 'test_promiseProvider_13515' },
      );
      const container = new RiverContainer();
      container.read(p);
      await new Promise((r) => setTimeout(r, 0));
      await expect(container.read(p.promise)).rejects.toBe('async-fail');

      container.dispose();
      expect(() => container.read(p.promise)).toThrow(/disposed/);
    });

    it('invalidate uninitialized provider', () => {
      const p = provider(() => 1, { name: 'test_provider_13646' });
      const container = new RiverContainer();
      container.invalidate(p); // Should not throw
    });

    it('snapshot naming and dependency tracking', () => {
      const container = new RiverContainer();
      const base = stateProvider(() => 1, { name: 'test_stateProvider_14112' });
      const nameless = provider((ref) => ref.watch(base) + 1, { name: 'nameless' });

      container.read(nameless);
      const snapshots = container.getProviderStates();
      expect(snapshots.length).toBe(2);
      expect(snapshots.some((s) => s.name?.includes('test_stateProvider_14112'))).toBe(true);
    });

    it('valuesEqual branches', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1, { name: 'test_stateProvider_14575' });
      container.read(p);
      container.set(p, 1); // No change
      container.set(p, 2); // Change
    });

    it('autoDispose with cacheTime and manual state deletion', async () => {
      vi.useFakeTimers();
      const p = provider(() => 1, { name: 'auto', autoDispose: true, cacheTime: 100 });
      const container = new RiverContainer();

      const unsub = container.listen(p, () => {});
      unsub();

      // Simulate race condition where state is deleted before timeout
      (container as any).states.delete(p.id);

      vi.advanceTimersByTime(110);
      vi.useRealTimers();
    });

    it('getProviderStates with ghost dependent', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1, { name: 'test_stateProvider_15346' });
      container.read(p);
      const state = container.getState(p.id)!;
      state.dependents.add('river:provider:unknown');
      const snapshots = container.getProviderStates();
      expect(snapshots.find((s) => s.id === p.id)?.dependents).toContain('river:provider:unknown');
    });

    it('assertNotDisposed on all public methods', () => {
      const container = new RiverContainer();
      container.dispose();
      const p = provider(() => 1, { name: 'test_provider_15540' });
      expect(() => container.read(p)).toThrow(/disposed/);
      expect(() =>
        container.set(
          stateProvider(() => 1, { name: 'test_stateProvider_16002' }),
          2,
        ),
      ).toThrow(/disposed/);
      expect(() => container.invalidate(p)).toThrow(/disposed/);
    });

    it('unknown provider kind', () => {
      const container = new RiverContainer();
      const fakeProvider: any = { id: 'river:wrong:fake', kind: 'wrong', options: {} };
      expect(() => (container as any).initializeProvider(fakeProvider)).toThrow(/Unknown provider kind/);
    });

    it('onProviderError notification', () => {
      const observer = { onProviderError: vi.fn() };
      const container = new RiverContainer({ observers: [observer] });
      const p = provider(
        () => {
          throw 'error';
        },
        { name: 'test_provider_16326' },
      );

      try {
        container.read(p);
      } catch {}
      expect(observer.onProviderError).toHaveBeenCalledWith(p, 'error');
    });

    it('should log provider error to console.error', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const container = new RiverContainer();
      const p = provider(
        () => {
          throw new Error('sync fail');
        },
        { name: 'test_provider_sync_fail' },
      );

      try {
        container.read(p);
      } catch {}

      expect(spy).toHaveBeenCalled();
      const errorArg = spy.mock.calls[0][0];
      expect(errorArg).toContain('[react-river] Error in provider "test_provider_sync_fail"');
      spy.mockRestore();
    });

    it('should log async provider error to console.error', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const container = new RiverContainer();
      const p = promiseProvider(
        async () => {
          throw new Error('async fail');
        },
        { name: 'test_provider_async_fail' },
      );

      container.read(p);
      await expect(container.read(p.promise)).rejects.toThrow('async fail');

      expect(spy).toHaveBeenCalled();
      const errorArg = spy.mock.calls[0][0];
      expect(errorArg).toContain('[react-river] Error in provider "test_provider_async_fail"');
      spy.mockRestore();
    });

    it('selector error during propagation', () => {
      const container = new RiverContainer();
      const base = stateProvider(() => 1, { name: 'test_stateProvider_17002' });
      const dependent = provider(
        (ref) => {
          return ref.watch(base, (v) => {
            if (v === 2) throw new Error('selector fail');
            return v;
          });
        },
        { name: 'test_provider_16713' },
      );

      container.read(dependent);
      // Should trigger catch in propagateToDependents, then reinitialize which throws
      expect(() => container.set(base, 2)).toThrow('selector fail');
    });

    it('snapshot listener notification on reinitialize change', () => {
      const container = new RiverContainer();
      let count = 0;
      const p = provider(() => ++count, { name: 'test_provider_17259' });

      const listener = vi.fn();
      container.subscribe(p, listener);

      container.read(p);
      container.invalidate(p);
      container.read(p);

      expect(listener).toHaveBeenCalled();
    });

    it('reinitialize with pending disposeTimeout', () => {
      vi.useFakeTimers();
      const container = new RiverContainer();
      const p = provider(() => 1, { name: 'cached', autoDispose: true, cacheTime: 1000 });

      const unsub = container.listen(p, () => {});
      unsub(); // Starts timeout

      container.invalidate(p); // Should clearTimeout
      vi.useRealTimers();
    });

    it('dispose callback throwing', () => {
      const container = new RiverContainer();
      const p = provider(
        (ref) => {
          ref.onDispose(() => {
            throw new Error('dispose error');
          });
          return 1;
        },
        { name: 'test_provider_18012' },
      );
      container.read(p);
      container.invalidate(p); // Should catch and swallow
      container.dispose(); // Should catch and swallow
    });

    it('actual disposal after cacheTime', async () => {
      vi.useFakeTimers();
      const container = new RiverContainer();
      let disposed = false;
      const p = provider(
        (ref) => {
          ref.onDispose(() => {
            disposed = true;
          });
          return 1;
        },
        { name: 'disposed', autoDispose: true, cacheTime: 100 },
      );

      const unsub = container.subscribe(p, () => {});
      unsub();

      vi.advanceTimersByTime(110);
      expect(disposed).toBe(true);
      vi.useRealTimers();
    });

    it('disposeState dependency cleanup', () => {
      const container = new RiverContainer();
      const base = stateProvider(() => 1, { name: 'test_stateProvider_19356' });
      const dep = provider((ref) => ref.watch(base) + 1, { name: 'test_provider_19803', autoDispose: true });

      container.read(dep);
      const baseState = container.getState(base.id);
      expect(baseState?.dependents.has(dep.id)).toBe(true);

      // Force dispose dep
      (container as any).disposeProvider(dep);
      expect(baseState?.dependents.has(dep.id)).toBe(false);
    });

    it('manual dispose when autoDispose is false', () => {
      const p = provider(() => 1, { name: 'test_provider_20257', autoDispose: false });
      const container = new RiverContainer();
      container.read(p);
      const unsub = container.listen(p, () => {});
      unsub();
      // Should not be disposed
      expect(container.read(p)).toBe(1);
    });

    it('updateValue and getOwnState safety', () => {
      const container = new RiverContainer();
      // Directly call private methods to hit early returns
      (container as any).updateValue('river:provider:missing', 1);
      expect((container as any).getOwnState('river:provider:missing')).toBeUndefined();
    });

    it('checkAutoDispose with invalid provider state', () => {
      const container = new RiverContainer();
      const p = provider(() => 1, { name: 'test_provider_20143' });
      // Calling on uninitialized provider should return early
      (container as any).checkAutoDispose(p);
    });

    it('propagateToDependents with missing state or provider', () => {
      const container = new RiverContainer();
      const id = 'river:provider:missing';
      (container as any).propagateToDependents(id);

      const p = stateProvider(() => 1, { name: 'test_stateProvider_20948' });
      container.read(p);
      const state = container.getState(p.id)!;
      state.dependents.add('river:provider:ghost');
      (container as any).propagateToDependents(p.id); // Should skip ghost
    });

    it('disposeProvider with uninitialized state', () => {
      const container = new RiverContainer();
      const p = provider(() => 1, { name: 'test_provider_20881' });
      (container as any).disposeProvider(p); // Should return early
    });

    it('getRootContainer on root container coverage', () => {
      const root = new RiverContainer();
      // @ts-ignore
      expect(root.getRootContainer()).toBe(root);
    });

    it('resolvePromiseAccessor error path and null parentValue', async () => {
      const container = new RiverContainer();

      // 1. null parentValue should reject with a descriptive error
      const fakeAccessor: any = {
        kind: 'promiseAccessor',
        name: 'test_accessor',
        _parentProvider: { id: 'river:promiseProvider:nonexistent', name: 'nonexistent', options: {} },
      };
      // Force read to return null
      const originalRead = container.read;
      container.read = () => null as any;
      const p1 = (container as any).resolvePromiseAccessor(fakeAccessor);
      expect(p1).toBeInstanceOf(Promise);
      await expect(p1).rejects.toThrow('has no value for promise accessor');
      container.read = originalRead;

      // 2. error path in listener
      let triggerError: any;
      const parent = promiseProvider(() => new Promise((_, reject) => (triggerError = reject)), {
        name: 'test_promiseProvider_22473',
      });
      const promise = container.read(parent.promise);
      triggerError('fail');
      await expect(promise).rejects.toBe('fail');
    });

    it('updateValue with missing provider in map', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1, { name: 'test_stateProvider_22652' });
      container.read(p);
      container.providerMap.delete(p.id);
      container.set(p, 2); // notifyObservers should skip
    });

    it('propagateToDependents without watchSelectors', () => {
      const container = new RiverContainer();
      const base = stateProvider(() => 1, { name: 'test_stateProvider_22976' });
      const dependent = stateProvider(() => 1, { name: 'test_stateProvider_23062' });

      container.read(base);
      container.read(dependent);

      const baseState = container.getState(base.id)!;
      baseState.dependents.add(dependent.id);
      // watchSelectors is undefined
      container.set(base, 2);
    });

    it('reinitialize uninitialized state early return', () => {
      const container = new RiverContainer();
      const p = provider(() => 1, { name: 'test_provider_22924' });
      container.invalidate(p); // Already has a test, but making sure
    });

    it('checkAutoDispose currentState null branch', async () => {
      const container = new RiverContainer();
      const p = provider(() => 1, { name: 'test_provider_24215', autoDispose: true });
      container.read(p);
      const unsub = container.listen(p, () => {});
      unsub();
      (container as any).states.delete(p.id);
      // microtask runs, currentState is null
      await new Promise<void>((r) => queueMicrotask(r));
    });

    it('disposeState and notifyObservers edge cases', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1, { name: 'test_stateProvider_24163' });
      container.read(p);
      const state = container.getState(p.id)!;
      state.initialized = false;
      // Should return early at line 529
      (container as any).teardownState(p.id, state, { clearListeners: true, cascadeAutoDispose: true });

      // Re-initialize uninitialized state
      (container as any).reinitialize(p);
    });

    it('getProviderStates with complex graph', () => {
      const container = new RiverContainer();
      const p1 = stateProvider(() => 1, { name: 'counter' });
      const p2 = provider((ref) => ref.watch(p1) + 1, { name: 'derived' });
      container.read(p2);

      const states = container.getProviderStates();
      expect(states.find((s) => s.name === 'counter')?.dependencies).toHaveLength(0);
      expect(states.find((s) => s.name === 'derived')?.dependencies).toContain('counter');
    });

    it('resolvePromiseAccessor immediate resolution', async () => {
      const container = new RiverContainer();

      // 1. Immediate data
      const p1 = promiseProvider(async () => 'data', { name: 'test_promiseProvider_25433' });
      await container.read(p1.promise);
      const acc1 = (container as any).resolvePromiseAccessor(p1.promise);
      await expect(acc1).resolves.toBe('data');

      // 2. Immediate error
      const p2 = promiseProvider(
        async () => {
          throw 'err';
        },
        { name: 'test_promiseProvider_25718' },
      );
      try {
        await container.read(p2.promise);
      } catch {}
      const acc2 = (container as any).resolvePromiseAccessor(p2.promise);
      await expect(acc2).rejects.toBe('err');
    });

    it('notifier initialization branches', () => {
      const container = new RiverContainer();

      // notifierProvider
      class MyNotif extends Notifier<number> {
        build() {
          return 1;
        }
      }
      const p1 = notifierProvider(() => new MyNotif(), { name: 'test_notifierProvider_26426' });
      expect(container.read(p1)).toBe(1);

      // asyncNotifierProvider
      class MyAsyncNotif extends AsyncNotifier<number> {
        async build() {
          return 2;
        }
      }
      const p2 = asyncNotifierProvider(() => new MyAsyncNotif(), { name: 'test_asyncNotifierProvider_26761' });
      expect(container.read(p2).status).toBe('loading');

      // notifierAccessor
      expect(container.read(p1.notifier)).toBeInstanceOf(MyNotif);
    });

    it('dispose loop with multiple providers', () => {
      const container = new RiverContainer();
      const p1 = stateProvider(() => 1, { name: 'test_stateProvider_26560' });
      const p2 = stateProvider(() => 2, { name: 'test_stateProvider_26639' });
      container.read(p1);
      container.read(p2);

      container.dispose();
      expect(container.disposed).toBe(true);
    });

    it('snapshot listeners coverage', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1, { name: 'test_stateProvider_26943' });
      const listener = vi.fn();

      container.subscribe(p, listener);
      container.set(p, 2);
      expect(listener).toHaveBeenCalled();
    });

    it('initializeProvider default branch coverage', () => {
      const container = new RiverContainer();
      const p: any = { id: 'river:unknown:unknown', kind: 'unknown', options: {} };
      expect(() => (container as any).initializeProvider(p)).toThrow(/Unknown provider kind/);
    });
    it('remaining branches (186, 268, 510) - final polish', async () => {
      const container = new RiverContainer();

      // --- 186: Explicitly test autoDispose: true branch ---
      const pAutoTrue = provider(() => 1, { name: 'test_provider_28317', autoDispose: true });
      container.read(pAutoTrue);
      expect(container.getProviderStates().find((s) => s.id === pAutoTrue.id)?.autoDispose).toBe(true);

      // --- 268: resolvePromiseAccessor data/error branches in listener ---
      // Data branch (Hits L265-267)
      let resolveP1: any;
      const pp1 = promiseProvider(() => new Promise((r) => (resolveP1 = r)), { name: 'test_promiseProvider_28268' });
      const acc1 = (container as any).resolvePromiseAccessor(pp1.promise);
      resolveP1('ok');
      await expect(acc1).resolves.toBe('ok');

      // Error branch (Hits L268-270)
      let rejectP2: any;
      const pp2 = promiseProvider(() => new Promise((_, r) => (rejectP2 = r)), { name: 'test_promiseProvider_28592' });
      const acc2 = (container as any).resolvePromiseAccessor(pp2.promise);
      rejectP2('fail');
      await expect(acc2).rejects.toBe('fail');

      // --- 510: checkAutoDispose microtask branch (currentState is null) ---
      const pDelete = provider(() => 1, { name: 'test_provider_29355', autoDispose: true });
      container.read(pDelete);
      const unsub = container.listen(pDelete, () => {});
      unsub();
      // Force delete state from map before microtask runs
      (container as any).states.delete(pDelete.id);
      await new Promise<void>((r) => queueMicrotask(r));
    });
    it('comprehensive edge cases (141-186, 268, 358, 510)', async () => {
      const container = new RiverContainer();

      // 1. Snapshot label (L162, L184-186)
      const idDep = 'river:provider:unknown';
      const depProvider: any = {
        id: idDep,
        name: idDep,
        kind: 'provider',
        options: { name: idDep, autoDispose: false },
      };
      container.providerMap.set(idDep, depProvider);
      const stateDep = createProviderState();
      stateDep.initialized = true;
      (container as any).states.set(idDep, stateDep);

      // 2. Skip logic in getProviderStates (L168, L171)
      const idGhost = 'river:provider:ghost';
      const stateGhost = createProviderState();
      stateGhost.initialized = false;
      (container as any).states.set(idGhost, stateGhost);

      const idMissing = 'river:provider:missing';
      const stateMissing = createProviderState();
      stateMissing.initialized = true;
      (container as any).states.set(idMissing, stateMissing);

      const snapshots = container.getProviderStates();
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].name).toBe('river:provider:unknown');

      // 3. resolvePromiseAccessor both branches (L265, L268)
      let resolveP1: any, rejectP2: any;
      const pp1 = promiseProvider(() => new Promise((r) => (resolveP1 = r)), { name: 'test_promiseProvider_30464' });
      const pp2 = promiseProvider(() => new Promise((_, r) => (rejectP2 = r)), { name: 'test_promiseProvider_30578' });
      const acc1 = (container as any).resolvePromiseAccessor(pp1.promise);
      const acc2 = (container as any).resolvePromiseAccessor(pp2.promise);
      resolveP1('ok');
      rejectP2('fail');
      await Promise.allSettled([acc1, acc2]);

      // 4. updateValue missing provider case (L358)
      (container as any).updateValue(idMissing, 456);

      // 5. checkAutoDispose microtask state deletion (L510)
      const pDelete = provider(() => 1, { name: 'test_provider_31552', autoDispose: true });
      container.read(pDelete);
      container.listen(pDelete, () => {})();
      (container as any).states.delete(pDelete.id);
      await new Promise<void>((r) => queueMicrotask(r));

      // 6. dispose specific branches (L141, L144)
      container.dispose();
    });
  });
});

describe('RiverContainer propagation regressions', () => {
  it('preserves state across a same-name HMR replacement', () => {
    const original = provider(() => 1, { name: 'hmr_stable' });
    const container = new RiverContainer();
    expect(container.read(original)).toBe(1);

    const replacement = provider(() => 2, { name: 'hmr_stable' });
    expect(replacement.id).toBe(original.id);
    expect(container.read(replacement)).toBe(1);

    container.invalidate(replacement);
    expect(container.read(replacement)).toBe(2);
  });

  it('rebuilds a diamond dependency once with the settled value', () => {
    const base = stateProvider(() => 1, { name: 'diamond_base' });
    const left = provider((ref) => ref.watch(base) * 2, { name: 'diamond_left' });
    const right = provider((ref) => ref.watch(base) * 3, { name: 'diamond_right' });
    let builds = 0;
    const total = provider((ref) => {
      builds++;
      return ref.watch(left) + ref.watch(right);
    }, { name: 'diamond_total' });
    const values: number[] = [];
    const container = new RiverContainer();
    container.listen(total, (next) => values.push(next));

    container.set(base, 2);

    expect(values).toEqual([10]);
    expect(builds).toBe(2);
  });

  it('orders queued dependents by transitive dependencies', () => {
    const base = stateProvider(() => 1, { name: 'ordered_base' });
    const middle = provider((ref) => ref.watch(base) * 2, { name: 'ordered_middle' });
    const nested = provider((ref) => ref.watch(middle) * 10, { name: 'ordered_nested' });
    let builds = 0;
    const total = provider((ref) => {
      builds++;
      // Register total before middle in base.dependents while total also
      // depends transitively on middle through nested.
      return ref.watch(base) + ref.watch(nested);
    }, { name: 'ordered_total' });
    const values: number[] = [];
    const container = new RiverContainer();
    container.listen(total, (next) => values.push(next));

    container.set(base, 2);

    expect(values).toEqual([42]);
    expect(builds).toBe(2);
  });

  it('uses the documented 60 second default cache time', () => {
    const disposable = provider(() => 1, { name: 'default_cache_time' });
    const container = new RiverContainer();
    const unsubscribe = container.subscribe(disposable, () => {});
    unsubscribe();

    expect(container.getProviderStates()[0]?.cacheTime).toBe(60000);
  });
});
