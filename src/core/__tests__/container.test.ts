import { describe, it, expect, vi } from 'vitest';
import { RiverContainer } from './container';
import { provider, stateProvider, promiseProvider } from './provider';

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
      overrides: [
        { original: p, create: () => 'overridden' }
      ]
    });
    
    expect(container.read(p)).toBe('overridden');
  });

  it('should support scoped containers with overrides', () => {
    const p = provider(() => 'root');
    const root = new RiverContainer();
    const child = new RiverContainer({
      parent: root,
      overrides: [
        { original: p, create: () => 'child' }
      ]
    });
    
    expect(root.read(p)).toBe('root');
    expect(child.read(p)).toBe('child');
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
    const p = provider((ref) => {
      let disposed = false;
      ref.onDispose(() => { disposed = true; });
      return { setDisposed: (v: boolean) => { disposed = v; }, isDisposed: () => disposed };
    }, { cacheTime: 0 }); // Use 0 for immediate microtask dispose
    
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
        onProviderInit: () => { throw new Error('broken'); }
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
      const p = promiseProvider(async () => { throw 'async-fail'; });
      const container = new RiverContainer();
      container.read(p); 
      await new Promise(r => setTimeout(r, 0));
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
      expect(snapshots.some(s => s.name?.includes('provider_'))).toBe(true);
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

    it('assertNotDisposed on all public methods', () => {
      const container = new RiverContainer();
      container.dispose();
      const p = provider(() => 1);
      expect(() => container.read(p)).toThrow(/disposed/);
      expect(() => container.set(stateProvider(() => 1), 2)).toThrow(/disposed/);
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
      const fakeAccessor: any = { kind: 'promiseAccessor', _parentProvider: { id: Symbol('nonexistent'), options: {} } };
      // Force read to return null
      const originalRead = container.read;
      container.read = () => null as any;
      const p1 = (container as any).resolvePromiseAccessor(fakeAccessor);
      expect(p1).toBeInstanceOf(Promise);
      container.read = originalRead;

      // 2. error path in listener
      let triggerError: any;
      const parent = promiseProvider(() => new Promise((_, reject) => triggerError = reject));
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
       container.states.delete(p.id);
       // microtask runs, currentState is null
       await new Promise(r => queueMicrotask(r));
    });

    it('disposeState and notifyObservers edge cases', () => {
      const container = new RiverContainer();
      const p = stateProvider(() => 1);
      container.read(p);
      const state = container.getState(p.id)!;
      state.initialized = false;
      // Should return early at line 529
      (container as any).disposeState(p.id, state);

      // Re-initialize uninitialized state
      (container as any).reinitialize(p); 
    });
  });
});
