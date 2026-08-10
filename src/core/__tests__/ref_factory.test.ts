import { describe, it, expect, vi } from 'vitest';

import { RiverContainer } from '../container';
import { provider, promiseProvider } from '../provider';
import { createRef } from '../ref_factory';

describe('Ref Factory & Dependency Tracking', () => {
  it('watchPromiseAccessor variations', async () => {
    const parent = promiseProvider(async () => 'data', { name: 'test_promiseProvider_328' });
    const container = new RiverContainer();

    // 1. watch without selector (transparent)
    const dep1 = promiseProvider(async (ref) => {
      const p = await ref.watch(parent.promise);
      return p + '!';
    }, { name: 'test_promiseProvider_512' });
    expect(await container.read(dep1.promise)).toBe('data!');

    // 2. watch with selector
    const dep2 = promiseProvider(async (ref) => {
      const val = await ref.watch(parent.promise, (d) => (d as string).toUpperCase());
      return val;
    }, { name: 'test_promiseProvider_772' });
    expect(await container.read(dep2.promise)).toBe('DATA');
  });

  it('dependency tracking branches: mixed watches', () => {
    const container = new RiverContainer();
    const target = provider(() => 1, { name: 'test_provider_1033' });

    // 1. Multiple conditional watches
    const p1 = provider((ref) => {
      ref.watch(target, (v) => v);
      return ref.watch(target, (v) => v + 1);
    }, { name: 'test_provider_1139' });

    // 2. Unconditional watch overrides conditional
    const p2 = provider((ref) => {
      ref.watch(target, (v) => v);
      return ref.watch(target);
    }, { name: 'test_provider_1348' });

    // 3. Conditional watch after unconditional (hit selectors !== null branch)
    const p3 = provider((ref) => {
      ref.watch(target);
      return ref.watch(target, (v) => v);
    }, { name: 'test_provider_1571' });

    container.read(p1);
    container.read(p2);
    container.read(p3);
  });

  it('ref methods: lifecycle and invalidation', () => {
    let capturedRef: any;
    const p = provider((ref) => {
      capturedRef = ref;
      return 1;
    }, { name: 'test_provider_1874' });
    const container = new RiverContainer();

    container.read(p);

    // read/listen/invalidate
    const dep = provider(() => 10, { name: 'test_provider_2090' });
    expect(capturedRef.read(dep)).toBe(10);
    capturedRef.listen(dep, () => {});
    capturedRef.invalidateSelf();

    // stale ref usage (after disposal)
    container.dispose();
    capturedRef.onDispose(() => {});
    capturedRef.onCancel(() => {});
    capturedRef.onResume(() => {});
  });

  it('stateless dependency tracking (mock callback)', () => {
    const ownerId = 'river:provider:owner';
    const target = provider(() => 1, { name: 'test_provider_2559' });
    const mockCb = {
      getState: () => undefined,
      providerMap: new Map(),
      ensureInitialized: () => {},
    };
    const ref = createRef(mockCb as any, ownerId);

    // Should handle missing states gracefully (lines 154, 158)
    ref.watch(target);
  });

  it('watchPromiseAccessor error handling with selector', async () => {
    vi.useFakeTimers();
    const container = new RiverContainer();
    let rejectP: any;
    const p = promiseProvider(() => {
      const pr = new Promise((_, r) => (rejectP = r));
      pr.catch(() => {});
      return pr;
    }, { name: 'test_promiseProvider_3172' });
    const dep = promiseProvider(async (ref) => {
      const pr = (ref as any).watch(p.promise, (v: any) => v);
      pr.catch(() => {});
      return await pr;
    }, { name: 'test_promiseProvider_3357' });

    container.read(dep);

    const promise1 = container.read(p.promise);
    const promise2 = container.read(dep.promise);
    promise1.catch(() => {});
    promise2.catch(() => {});

    const settled = Promise.allSettled([promise1, promise2]);

    rejectP(new Error('fail'));
    vi.runAllTimers();
    await settled;

    await expect(promise1).rejects.toThrow('fail');
    await expect(promise2).rejects.toThrow('fail');
    vi.useRealTimers();
  });

  it('watchPromiseAccessor with parent already in error', async () => {
    vi.useFakeTimers();
    let rejectParent: any;
    const parent = promiseProvider(() => {
      const pr = new Promise((_, r) => (rejectParent = r));
      pr.catch(() => {});
      return pr;
    }, { name: 'test_promiseProvider_4150' });
    const container = new RiverContainer();

    const pPromise = container.read(parent.promise);
    pPromise.catch(() => {});

    rejectParent(new Error('err'));
    vi.runAllTimers();
    await Promise.allSettled([pPromise]);

    const dep = promiseProvider(async (ref) => {
      const pr = ref.watch(parent.promise, (d) => d);
      pr.catch(() => {});
      return await pr;
    }, { name: 'test_promiseProvider_4571' });

    const dPromise = container.read(dep.promise);
    dPromise.catch(() => {});

    vi.runAllTimers();
    await Promise.allSettled([dPromise]);

    await expect(dPromise).rejects.toThrow('err');
    vi.useRealTimers();
  });

  it('ref.invalidateSelf when provider is missing from map', () => {
    const ownerId = 'river:provider:owner';
    const mockCb = {
      providerMap: new Map(),
      invalidate: vi.fn(),
    };
    const ref = createRef(mockCb as any, ownerId);
    ref.invalidateSelf();
    expect(mockCb.invalidate).not.toHaveBeenCalled();
  });
});
