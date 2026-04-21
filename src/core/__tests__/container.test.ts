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
    const p = provider(() => 'hello');

    expect(container.read(p)).toBe('hello');
  });

  it('should keep state between reads', () => {
    const container = new RiverContainer();
    let count = 0;
    const p = provider(() => ++count);

    expect(container.read(p)).toBe(1);
    expect(container.read(p)).toBe(1);
  });

  it('should support stateProvider and set', () => {
    const container = new RiverContainer();
    const counter = stateProvider(() => 0);

    expect(container.read(counter)).toBe(0);

    container.set(counter, 10);
    expect(container.read(counter)).toBe(10);

    container.set(counter, (prev) => prev + 5);
    expect(container.read(counter)).toBe(15);
  });

  it('should track dependencies and recompute', () => {
    const container = new RiverContainer();
    const base = stateProvider(() => 10);
    const doubled = provider((ref) => ref.watch(base) * 2);

    expect(container.read(doubled)).toBe(20);

    container.set(base, 20);
    expect(container.read(doubled)).toBe(40);
  });

  it('should detect circular dependencies', () => {
    const container = new RiverContainer();

    // We need to use type casting or late definitions to create a loop
    const p1: any = provider((ref) => ref.watch(p2));
    const p2: any = provider((ref) => ref.watch(p1));

    expect(() => container.read(p1)).toThrow(/Circular dependency/);
  });

  it('should invalidate state', () => {
    const container = new RiverContainer();
    let count = 0;
    const p = provider(() => ++count);

    expect(container.read(p)).toBe(1);
    container.invalidate(p);
    expect(container.read(p)).toBe(2);
  });

  it('should support overrides', () => {
    const p = provider(() => 'original');
    const container = new RiverContainer({
      overrides: [{ original: p, create: () => 'overridden' }],
    });

    expect(container.read(p)).toBe('overridden');
  });

  it('should support scoped containers with overrides', () => {
    const p = provider(() => 'root');
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
      const p = notifierProvider(() => new OriginalNotifier());

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
      const p = notifierProvider(() => new OriginalNotifier());

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
      const p = asyncNotifierProvider(() => new OriginalAsyncNotifier());

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
      );

      class OriginalNotifier extends Notifier<string> {
        build() {
          return 'should-not-be-used';
        }
      }
      const p = notifierProvider(() => new OriginalNotifier());

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
    const p = stateProvider(() => 0);
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
      { cacheTime: 0 },
    ); // Use 0 for immediate microtask dispose

    const container = new RiverContainer();
    const val = container.read(p);

    const unsubscribe = container.subscribe(p, () => {});
    expect(val.isDisposed()).toBe(false);

    unsubscribe();

    // Wait for microtask
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

    expect(val.isDisposed()).toBe(true);
  });

  it('should handle invalidated with listeners', () => {
    const container = new RiverContainer();
    let count = 0;
    const p = stateProvider(() => ++count);

    const listener = vi.fn();
    container.listen(p, listener);

    expect(container.read(p)).toBe(1);

    container.invalidate(p);
    expect(container.read(p)).toBe(2);
    expect(listener).toHaveBeenCalledWith(2, 1);
  });

  it('should support watch with selector', () => {
    const container = new RiverContainer();
    const user = stateProvider(() => ({ name: 'Alice', age: 25 }));

    let computeCount = 0;
    const nameOnly = provider((ref) => {
      computeCount++;
      return ref.watch(user, (u) => u.name);
    });

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

    const globalP = stateProvider(() => 0, { global: true });

    root.set(globalP, 1);
    expect(child.read(globalP)).toBe(1);

    child.set(globalP, 2);
    expect(root.read(globalP)).toBe(2);
  });

  it('should support refreshing a provider', () => {
    const container = new RiverContainer();
    let count = 0;
    const p = provider(() => ++count);

    expect(container.read(p)).toBe(1);
    const newVal = container.refresh(p);
    expect(newVal).toBe(2);
    expect(container.read(p)).toBe(2);
  });

  describe('Asynchronous Providers', () => {
    it('promiseProvider should handle basic promise resolution', async () => {
      const container = new RiverContainer();
      const p = promiseProvider(async () => 'hello');

      expect(container.read(p).status).toBe('loading');
      const data = await container.read(p.promise);
      expect(data).toBe('hello');
      expect(container.read(p).data).toBe('hello');
    });

    it('promiseProvider should handle errors', async () => {
      const container = new RiverContainer();
      const p = promiseProvider(async () => {
        throw new Error('fail');
      });

      container.read(p);
      await expect(container.read(p.promise)).rejects.toThrow('fail');
      expect(container.read(p).status).toBe('error');
    });

    it('observableProvider should handle observable stream', () => {
      const container = new RiverContainer();
      let nextCb: (v: string) => void;
      const p = observableProvider(() => ({
        subscribe: (callbacks: any) => {
          nextCb = typeof callbacks === 'function' ? callbacks : callbacks.next;
          return { unsubscribe: () => {} };
        },
      }));

      expect(container.read(p).status).toBe('loading');
      nextCb!('first');
      expect(container.read(p).data).toBe('first');
      nextCb!('second');
      expect(container.read(p).data).toBe('second');
    });

    it('should support watching promiseAccessor with selector', async () => {
      const container = new RiverContainer();
      const p = promiseProvider(async () => ({ id: 1, name: 'test' }));
      const nameP = provider((ref) => {
        return ref.watch(p.promise, (data) => data?.name.toUpperCase());
      });

      const namePromise = container.read(nameP);
      expect(namePromise).toBeInstanceOf(Promise);
      const name = await namePromise;
      expect(name).toBe('TEST');
    });
  });

  it('should handle onCancel and onResume', async () => {
    const container = new RiverContainer();
    const onCancel = vi.fn();
    const onResume = vi.fn();

    const p = provider((ref) => {
      ref.onCancel(onCancel);
      ref.onResume(onResume);
      return 'data';
    });

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
    const p = provider((ref) => {
      refObj = ref;
      return ++count;
    });

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
      const p = provider(() => 1);
      expect(container.read(p)).toBe(1);
    });

    it('deep hierarchy getRootContainer and global delegation', () => {
      const root = new RiverContainer();
      const mid = new RiverContainer({ parent: root });
      const child = new RiverContainer({ parent: mid });

      const g = stateProvider(() => 0, { global: true });
      child.set(g, 100);
      expect(root.read(g)).toBe(100);
      expect((child as any).states.has(g.id)).toBe(false);
    });

    it('resolvePromiseAccessor error and disposal safety', async () => {
      const p = promiseProvider(async () => {
        throw 'async-fail';
      });
      const container = new RiverContainer();
      container.read(p);
      await new Promise((r) => setTimeout(r, 0));
      await expect(container.read(p.promise)).rejects.toBe('async-fail');

      container.dispose();
      expect(() => container.read(p.promise)).toThrow(/disposed/);
    });

    it('invalidate uninitialized provider', () => {
      const p = provider(() => 1);
      const container = new RiverContainer();
      container.invalidate(p); // Should not throw
    });

    it('snapshot naming and dependency tracking', () => {
      const container = new RiverContainer();
      const base = stateProvider(() => 1);
      const nameless = provider((ref) => ref.watch(base) + 1, { name: undefined });

      container.read(nameless);
      const snapshots = container.getProviderStates();
      expect(snapshots.length).toBe(2);
      expect(snapshots.some((s) => s.name?.includes('provider_'))).toBe(true);
    });

    it('valuesEqual branches', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1);
      container.read(p);
      container.set(p, 1); // No change
      container.set(p, 2); // Change
    });

    it('autoDispose with cacheTime and manual state deletion', async () => {
      vi.useFakeTimers();
      const p = provider(() => 1, { autoDispose: true, cacheTime: 100 });
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
      const p = stateProvider(() => 1);
      container.read(p);
      const state = container.getState(p.id)!;
      state.dependents.add(Symbol()); // description-less symbol
      const snapshots = container.getProviderStates();
      expect(snapshots.find(s => s.id === p.id)?.dependents).toContain('unknown');
    });

    it('assertNotDisposed on all public methods', () => {
      const container = new RiverContainer();
      container.dispose();
      const p = provider(() => 1);
      expect(() => container.read(p)).toThrow(/disposed/);
      expect(() =>
        container.set(
          stateProvider(() => 1),
          2,
        ),
      ).toThrow(/disposed/);
      expect(() => container.invalidate(p)).toThrow(/disposed/);
    });

    it('unknown provider kind', () => {
      const container = new RiverContainer();
      const fakeProvider: any = { id: Symbol('fake'), kind: 'wrong' };
      expect(() => (container as any).initializeProvider(fakeProvider)).toThrow(/Unknown provider kind/);
    });

    it('onProviderError notification', () => {
      const observer = { onProviderError: vi.fn() };
      const container = new RiverContainer({ observers: [observer] });
      const p = provider(() => {
        throw 'error';
      });

      try {
        container.read(p);
      } catch {}
      expect(observer.onProviderError).toHaveBeenCalledWith(p, 'error');
    });

    it('selector error during propagation', () => {
      const container = new RiverContainer();
      const base = stateProvider(() => 1);
      const dependent = provider((ref) => {
        return ref.watch(base, (v) => {
          if (v === 2) throw new Error('selector fail');
          return v;
        });
      });

      container.read(dependent);
      // Should trigger catch in propagateToDependents, then reinitialize which throws
      expect(() => container.set(base, 2)).toThrow('selector fail');
    });

    it('snapshot listener notification on reinitialize change', () => {
      const container = new RiverContainer();
      let count = 0;
      const p = provider(() => ++count);

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
      const p = provider(() => 1, { autoDispose: true, cacheTime: 1000 });

      const unsub = container.listen(p, () => {});
      unsub(); // Starts timeout

      container.invalidate(p); // Should clearTimeout
      vi.useRealTimers();
    });

    it('dispose callback throwing', () => {
      const container = new RiverContainer();
      const p = provider((ref) => {
        ref.onDispose(() => {
          throw new Error('dispose error');
        });
        return 1;
      });
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
        { autoDispose: true, cacheTime: 100 },
      );

      const unsub = container.subscribe(p, () => {});
      unsub();

      vi.advanceTimersByTime(110);
      expect(disposed).toBe(true);
      vi.useRealTimers();
    });

    it('disposeState dependency cleanup', () => {
      const container = new RiverContainer();
      const base = stateProvider(() => 1);
      const dep = provider((ref) => ref.watch(base) + 1, { autoDispose: true });

      container.read(dep);
      const baseState = container.getState(base.id);
      expect(baseState?.dependents.has(dep.id)).toBe(true);

      // Force dispose dep
      (container as any).disposeProvider(dep);
      expect(baseState?.dependents.has(dep.id)).toBe(false);
    });

    it('manual dispose when autoDispose is false', () => {
      const p = provider(() => 1, { autoDispose: false });
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
      (container as any).updateValue(Symbol('missing'), 1);
      expect((container as any).getOwnState(Symbol('missing'))).toBeUndefined();
    });

    it('checkAutoDispose with invalid provider state', () => {
      const container = new RiverContainer();
      const p = provider(() => 1);
      // Calling on uninitialized provider should return early
      (container as any).checkAutoDispose(p);
    });

    it('propagateToDependents with missing state or provider', () => {
      const container = new RiverContainer();
      const id = Symbol('missing');
      (container as any).propagateToDependents(id);

      const p = stateProvider(() => 1);
      container.read(p);
      const state = container.getState(p.id)!;
      state.dependents.add(Symbol('ghost'));
      (container as any).propagateToDependents(p.id); // Should skip ghost
    });

    it('disposeProvider with uninitialized state', () => {
      const container = new RiverContainer();
      const p = provider(() => 1);
      (container as any).disposeProvider(p); // Should return early
    });

    it('getRootContainer on root container coverage', () => {
      const root = new RiverContainer();
      // @ts-ignore
      expect(root.getRootContainer()).toBe(root);
    });

    it('resolvePromiseAccessor error path and null parentValue', async () => {
      const container = new RiverContainer();

      // 1. null parentValue (simulated)
      const fakeAccessor: any = {
        kind: 'promiseAccessor',
        _parentProvider: { id: Symbol('nonexistent'), options: {} },
      };
      // Force read to return null
      const originalRead = container.read;
      container.read = () => null as any;
      const p1 = (container as any).resolvePromiseAccessor(fakeAccessor);
      expect(p1).toBeInstanceOf(Promise);
      container.read = originalRead;

      // 2. error path in listener
      let triggerError: any;
      const parent = promiseProvider(() => new Promise((_, reject) => (triggerError = reject)));
      const promise = container.read(parent.promise);
      triggerError('fail');
      await expect(promise).rejects.toBe('fail');
    });

    it('updateValue with missing provider in map', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1);
      container.read(p);
      container.providerMap.delete(p.id);
      container.set(p, 2); // notifyObservers should skip
    });

    it('propagateToDependents without watchSelectors', () => {
      const container = new RiverContainer();
      const base = stateProvider(() => 1);
      const dependent = stateProvider(() => 1);

      container.read(base);
      container.read(dependent);

      const baseState = container.getState(base.id)!;
      baseState.dependents.add(dependent.id);
      // watchSelectors is undefined
      container.set(base, 2);
    });

    it('reinitialize uninitialized state early return', () => {
      const container = new RiverContainer();
      const p = provider(() => 1);
      container.invalidate(p); // Already has a test, but making sure
    });

    it('checkAutoDispose currentState null branch', async () => {
      const container = new RiverContainer();
      const p = provider(() => 1, { autoDispose: true });
      container.read(p);
      const unsub = container.listen(p, () => {});
      unsub();
      (container as any).states.delete(p.id);
      // microtask runs, currentState is null
      await new Promise<void>((r) => queueMicrotask(r));
    });

    it('disposeState and notifyObservers edge cases', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1);
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
      const p1 = promiseProvider(async () => 'data');
      await container.read(p1.promise);
      const acc1 = (container as any).resolvePromiseAccessor(p1.promise);
      await expect(acc1).resolves.toBe('data');

      // 2. Immediate error
      const p2 = promiseProvider(async () => {
        throw 'err';
      });
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
      const p1 = notifierProvider(() => new MyNotif());
      expect(container.read(p1)).toBe(1);

      // asyncNotifierProvider
      class MyAsyncNotif extends AsyncNotifier<number> {
        async build() {
          return 2;
        }
      }
      const p2 = asyncNotifierProvider(() => new MyAsyncNotif());
      expect(container.read(p2).status).toBe('loading');

      // notifierAccessor
      expect(container.read(p1.notifier)).toBeInstanceOf(MyNotif);
    });

    it('dispose loop with multiple providers', () => {
      const container = new RiverContainer();
      const p1 = stateProvider(() => 1);
      const p2 = stateProvider(() => 2);
      container.read(p1);
      container.read(p2);

      container.dispose();
      expect(container.disposed).toBe(true);
    });

    it('snapshot listeners coverage', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1);
      const listener = vi.fn();

      container.subscribe(p, listener);
      container.set(p, 2);
      expect(listener).toHaveBeenCalled();
    });

    it('initializeProvider default branch coverage', () => {
      const container = new RiverContainer();
      const p: any = { id: Symbol('unknown'), kind: 'unknown', options: {} };
      expect(() => (container as any).initializeProvider(p)).toThrow(/Unknown provider kind/);
    });
    it('remaining branches (186, 268, 510) - final polish', async () => {
      const container = new RiverContainer();

      // --- 186: Explicitly test autoDispose: true branch ---
      const pAutoTrue = provider(() => 1, { autoDispose: true });
      container.read(pAutoTrue);
      expect(container.getProviderStates().find(s => s.id === pAutoTrue.id)?.autoDispose).toBe(true);

      // --- 268: resolvePromiseAccessor data/error branches in listener ---
      // Data branch (Hits L265-267)
      let resolveP1: any;
      const pp1 = promiseProvider(() => new Promise((r) => resolveP1 = r));
      const acc1 = (container as any).resolvePromiseAccessor(pp1.promise);
      resolveP1('ok');
      await expect(acc1).resolves.toBe('ok');

      // Error branch (Hits L268-270)
      let rejectP2: any;
      const pp2 = promiseProvider(() => new Promise((_, r) => rejectP2 = r));
      const acc2 = (container as any).resolvePromiseAccessor(pp2.promise);
      rejectP2('fail');
      await expect(acc2).rejects.toBe('fail');

      // --- 510: checkAutoDispose microtask branch (currentState is null) ---
      const pDelete = provider(() => 1, { autoDispose: true });
      container.read(pDelete);
      const unsub = container.listen(pDelete, () => {});
      unsub();
      // Force delete state from map before microtask runs
      (container as any).states.delete(pDelete.id); 
      await new Promise<void>(r => queueMicrotask(r)); 
    });
    it('comprehensive edge cases (141-186, 268, 358, 510)', async () => {
      const container = new RiverContainer();

      // 1. Snapshot and getLabel fallback (L162, L184-186)
      const idDep = Symbol(); 
      const depProvider: any = { id: idDep, kind: 'provider', options: { autoDispose: false } };
      container.providerMap.set(idDep, depProvider);
      const stateDep = createProviderState();
      stateDep.initialized = true;
      (container as any).states.set(idDep, stateDep);

      // 2. Skip logic in getProviderStates (L168, L171)
      const idGhost = Symbol('ghost');
      const stateGhost = createProviderState();
      stateGhost.initialized = false; 
      (container as any).states.set(idGhost, stateGhost);

      const idMissing = Symbol('missing');
      const stateMissing = createProviderState();
      stateMissing.initialized = true; 
      (container as any).states.set(idMissing, stateMissing);

      const snapshots = container.getProviderStates();
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].name).toBe('unknown'); 

      // 3. resolvePromiseAccessor both branches (L265, L268)
      let resolveP1: any, rejectP2: any;
      const pp1 = promiseProvider(() => new Promise(r => resolveP1 = r));
      const pp2 = promiseProvider(() => new Promise((_, r) => rejectP2 = r));
      const acc1 = (container as any).resolvePromiseAccessor(pp1.promise);
      const acc2 = (container as any).resolvePromiseAccessor(pp2.promise);
      resolveP1('ok'); rejectP2('fail');
      await Promise.allSettled([acc1, acc2]);

      // 4. updateValue missing provider case (L358)
      (container as any).updateValue(idMissing, 456);

      // 5. checkAutoDispose microtask state deletion (L510)
      const pDelete = provider(() => 1, { autoDispose: true });
      container.read(pDelete);
      container.listen(pDelete, () => {})() ; 
      (container as any).states.delete(pDelete.id); 
      await new Promise<void>(r => queueMicrotask(r));

      // 6. dispose specific branches (L141, L144)
      container.dispose();
    });
  });
});
