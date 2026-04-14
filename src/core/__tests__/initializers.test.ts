import { describe, it, expect, vi } from 'vitest';

import { RiverContainer } from '../container';
import { AsyncNotifier } from '../notifier';
import { stateProvider, provider, promiseProvider, observableProvider, asyncNotifierProvider } from '../provider';

describe('Initializers', () => {
  it('abort logic across provider types', async () => {
    // 1. Observable - next after abort
    const container1 = new RiverContainer();
    let push: any;
    const p1 = observableProvider(() => ({
      subscribe: (o: any) => {
        push = typeof o === 'function' ? o : o.next;
        return { unsubscribe: () => {} };
      },
    }));
    container1.read(p1);
    container1.dispose();
    push(1); // Should hit aborted branch

    // 2. Observable - error after abort
    const container2 = new RiverContainer();
    let pushErr: any;
    const p2 = observableProvider(() => ({
      subscribe: (o: any) => {
        pushErr = o.error;
        return { unsubscribe: () => {} };
      },
    }));
    container2.read(p2);
    container2.dispose();
    pushErr('fail'); // Should hit aborted branch

    // 3. Promise - resolve after abort
    const container3 = new RiverContainer();
    let resolvePromise: any;
    const p3 = promiseProvider(
      () =>
        new Promise((r) => {
          resolvePromise = r;
        }),
    );
    container3.read(p3);
    container3.dispose();
    resolvePromise(1); // Should hit aborted branch

    // 4. AsyncNotifier - success after abort
    const container4 = new RiverContainer();
    let resolveNotifier: any;
    class AbortNotif extends AsyncNotifier<number> {
      async build() {
        return new Promise<number>((r) => {
          resolveNotifier = r;
        });
      }
    }
    container4.read(asyncNotifierProvider(() => new AbortNotif()));
    container4.dispose();
    resolveNotifier(1); // Should hit aborted branch
  });

  it('observableProvider error and creation branches', async () => {
    const container = new RiverContainer();

    // 1. Observable error
    let triggerError: any;
    const p1 = observableProvider(() => ({
      subscribe: (o: any) => {
        triggerError = typeof o === 'function' ? null : o.error;
        return { unsubscribe: () => {} };
      },
    }));
    container.read(p1);
    triggerError('stream-fail');
    expect((container.read(p1) as any).error).toBe('stream-fail');

    // 2. Async creation failure
    const p2 = observableProvider(async () => {
      throw 'creation-fail';
    });
    container.read(p2);
    await new Promise((r) => setTimeout(r, 0));
    expect((container.read(p2) as any).error).toBe('creation-fail');
  });

  it('notifierAccessor and stateProvider controller branches', () => {
    const base = stateProvider(() => 1);
    const container = new RiverContainer();

    // stateProvider controller (Notifier)
    const controller = container.read(base.notifier);
    expect(controller.state).toBe(1);
    controller.state = 2;
    controller.update((v) => v + 1);
    expect(controller.state).toBe(3);

    // Manual notifierAccessor simulation
    const accessor: any = {
      kind: 'notifierAccessor',
      id: Symbol('acc'),
      _parentId: base.id,
      _parentProvider: base,
      options: {},
    };
    container.read(accessor);
    expect(container.providerMap.has(base.id)).toBe(true);
  });

  it('notifierAccessor missing parent error', () => {
    const container = new RiverContainer();
    const orphanAccessor: any = {
      kind: 'notifierAccessor',
      id: Symbol('orphan'),
      _parentId: Symbol('missing'),
      options: {},
    };
    expect(() => (container as any).ensureInitialized(orphanAccessor)).toThrow(/Parent provider not found/);
  });

  it('initialization overrides', () => {
    const p = provider(() => 1);
    const sp = stateProvider(() => 10);
    const op = observableProvider(() => ({
      subscribe: (o: any) => {
        o.next(100);
        return { unsubscribe: () => {} };
      },
    }));

    const container = new RiverContainer({
      overrides: [
        { original: p, create: () => 2 },
        { original: sp, create: () => 20 },
        {
          original: op,
          create: () => ({
            subscribe: (o: any) => {
              o.next(200);
              return { unsubscribe: () => {} };
            },
          }),
        },
      ],
    });

    expect(container.read(p)).toBe(2);
    expect(container.read(sp)).toBe(20);
    expect((container.read(op) as any).data).toBe(200);
  });

  it('initializers with overrides and abort logic', async () => {
    const container = new RiverContainer();
    const ref = { onDispose: vi.fn() };

    // 1. initPromiseProvider with override
    const p1 = promiseProvider(async () => 1);
    const container1 = new RiverContainer({
      overrides: [{ original: p1, create: () => Promise.resolve(2) }],
    });
    expect(await container1.read(p1.promise)).toBe(2);

    // 2. initObservableProvider with override
    const op1 = observableProvider(() => ({
      subscribe: (o: any) => {
        o.next(1);
        return { unsubscribe: () => {} };
      },
    }));
    const container2 = new RiverContainer({
      overrides: [
        {
          original: op1,
          create: () => ({
            subscribe: (o: any) => {
              o.next(2);
              return { unsubscribe: () => {} };
            },
          }),
        },
      ],
    });
    expect((container2.read(op1) as any).data).toBe(2);

    // 3. initObservableProvider async creation abort check
    let resolveObs: any;
    const op2 = observableProvider(() => new Promise<any>((r) => (resolveObs = r)));
    const container3 = new RiverContainer();
    container3.read(op2);
    container3.dispose();
    resolveObs({ subscribe: () => ({ unsubscribe: () => {} }) }); // Should abort
  });

  it('abort branches coverage in all initializers', async () => {
    // 1. Promise resolution abort
    let resolveP: any;
    const p1 = promiseProvider(() => {
      const pr = new Promise((r) => (resolveP = r));
      pr.catch(() => {});
      return pr;
    });
    const container1 = new RiverContainer();
    container1.read(p1.promise).catch(() => {}); // Catch early
    container1.read(p1);
    container1.dispose();
    resolveP(1); // Hits line 88

    // 2. Observable next/error abort
    let triggerNext: any, triggerErr: any;
    const op1 = observableProvider(() => ({
      subscribe: (o: any) => {
        triggerNext = o.next;
        triggerErr = o.error;
        return { unsubscribe: () => {} };
      },
    }));
    const container2 = new RiverContainer();
    container2.read(op1);
    container2.dispose();
    triggerNext(1); // Hits line 117
    triggerErr(new Error('err')); // Hits line 121

    // 3. AsyncNotifier abort
    let resolveN: any, rejectN: any;
    class AN extends AsyncNotifier<number> {
      async build() {
        const pr = new Promise<number>((r, j) => {
          resolveN = r;
          rejectN = j;
        });
        pr.catch(() => {});
        return pr;
      }
    }
    const p2 = asyncNotifierProvider(() => new AN());
    const container3 = new RiverContainer();
    container3.read(p2.promise).catch(() => {}); // Catch early
    container3.read(p2);
    container3.dispose();
    resolveN(1); // Hits line 197
    rejectN(new Error('err')); // Hits line 203
  });
});
