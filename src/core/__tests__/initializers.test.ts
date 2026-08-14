import { describe, it, expect } from 'vitest';

import { RiverContainer } from '../container';
import { AsyncNotifier } from '../notifier';
import { stateProvider, provider, promiseProvider, observableProvider, asyncNotifierProvider } from '../provider';

describe('Initializers', () => {
  it('initialization abort logic', async () => {
    // 1. Observable - next/error after abort
    const container1 = new RiverContainer();
    let push: any, pushErr: any;
    const op1 = observableProvider(
      () => ({
        subscribe: (o: any) => {
          push = typeof o === 'function' ? o : o.next;
          pushErr = o.error;
          return { unsubscribe: () => {} };
        },
      }),
      { name: 'test_observable_op1' },
    );
    container1.read(op1);
    container1.dispose();
    push(1); // Hits line 117
    pushErr('fail'); // Hits line 121

    // 2. Promise - resolve/reject after abort
    const container2 = new RiverContainer();
    let resolveP: any, rejectP: any;
    const pp = promiseProvider(
      () =>
        new Promise((res, rej) => {
          resolveP = res;
          rejectP = rej;
        }),
      { name: 'test_promise_pp' },
    );
    container2.read(pp);
    container2.dispose();
    resolveP(1); // Hits line 80
    rejectP('err'); // Hits line 88

    // 3. Async creation success after abort (Observable)
    const container3 = new RiverContainer();
    let resolveObs: any;
    const op2 = observableProvider(() => new Promise<any>((r) => (resolveObs = r)), { name: 'test_observable_op2' });
    container3.read(op2);
    container3.dispose();
    resolveObs({ subscribe: () => ({ unsubscribe: () => {} }) }); // Hits line 133 (if statement)

    // 4. AsyncNotifier - success/error after abort
    const container4 = new RiverContainer();
    let resolveN: any, rejectN: any;
    class AN extends AsyncNotifier<number> {
      async build() {
        return new Promise<number>((r, j) => {
          resolveN = r;
          rejectN = j;
        });
      }
    }
    container4.read(asyncNotifierProvider(() => new AN(), { name: 'test_asyncNotifier_AN' }));
    container4.dispose();
    resolveN(1); // Hits line 197
    rejectN(new Error('err')); // Hits line 203
  });

  it('observableProvider error and creation branches', async () => {
    const container = new RiverContainer();

    // 1. Observable error
    let triggerError: any;
    const p1 = observableProvider(
      () => ({
        subscribe: (o: any) => {
          triggerError = typeof o === 'function' ? null : o.error;
          return { unsubscribe: () => {} };
        },
      }),
      { name: 'test_observable_p1' },
    );
    container.read(p1);
    triggerError('stream-fail');
    expect((container.read(p1) as any).error).toBe('stream-fail');

    // 2. Async creation failure
    const p2 = observableProvider(
      async () => {
        throw 'creation-fail';
      },
      { name: 'test_observable_p2' },
    );
    container.read(p2);
    await new Promise((r) => setTimeout(r, 0));
    expect((container.read(p2) as any).error).toBe('creation-fail');

    // 3. Async creation success (Hits line 134)
    const p3 = observableProvider(
      async () => ({
        subscribe: (o: any) => {
          o.next('async-ok');
          return { unsubscribe: () => {} };
        },
      }),
      { name: 'test_observable_p3' },
    );
    container.read(p3);
    await new Promise((r) => setTimeout(r, 0));
    expect((container.read(p3) as any).data).toBe('async-ok');
  });

  it('notifierAccessor and stateProvider controller branches', () => {
    const base = stateProvider(() => 1, { name: 'test_state_base' });
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
      id: 'river:notifierAccessor:acc',
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
      id: 'river:notifierAccessor:orphan',
      _parentId: 'river:provider:missing',
      options: {},
    };
    expect(() => (container as any).ensureInitialized(orphanAccessor)).toThrow(/Parent provider not found/);
  });

  it('initialization overrides', () => {
    const p = provider(() => 1, { name: 'test_provider_p' });
    const sp = stateProvider(() => 10, { name: 'test_state_sp' });
    const op = observableProvider(
      () => ({
        subscribe: (o: any) => {
          o.next(100);
          return { unsubscribe: () => {} };
        },
      }),
      { name: 'test_observable_op' },
    );

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
});
