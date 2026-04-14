import { describe, it, expect } from 'vitest';
import { provider, stateProvider, promiseProvider, observableProvider, notifierProvider, asyncNotifierProvider } from './provider';
import { Notifier, AsyncNotifier } from './notifier';

describe('Providers Factories', () => {
  it('provider() creates correct object', () => {
    const p = provider(() => 1, { name: 'test' });
    expect(p.kind).toBe('provider');
    expect(p.name).toBe('test');
    expect(p.options.autoDispose).toBe(true);
  });

  it('stateProvider() creates correct object with notifier accessor', () => {
    const p = stateProvider(() => 0, { name: 'counter' });
    expect(p.kind).toBe('stateProvider');
    expect(p.notifier).toBeDefined();
    expect(p.notifier.kind).toBe('notifierAccessor');
    expect(p.notifier._parentId).toBe(p.id);
  });

  it('promiseProvider() creates correct object with promise accessor', () => {
    const p = promiseProvider(async () => 'data', { name: 'async' });
    expect(p.kind).toBe('promiseProvider');
    expect(p.promise).toBeDefined();
    expect(p.promise.kind).toBe('promiseAccessor');
    expect(p.promise._parentId).toBe(p.id);
  });

  it('observableProvider() creates correct object', () => {
    const p = observableProvider(() => ({ subscribe: () => ({ unsubscribe: () => {} }) }), { name: 'obs' });
    expect(p.kind).toBe('observableProvider');
  });

  it('notifierProvider() creates correct object', () => {
    class MyNotifier extends Notifier<number> {
      override build() { return 0; }
      updateState(val: number) { this.state = val; }
    }
    const p = notifierProvider(() => new MyNotifier());
    expect(p.kind).toBe('notifierProvider');
    expect(p.notifier.kind).toBe('notifierAccessor');
  });

  it('asyncNotifierProvider() creates correct object', () => {
    class MyAsyncNotifier extends AsyncNotifier<number> {
      async build() { return 0; }
    }
    const p = asyncNotifierProvider(() => new MyAsyncNotifier());
    expect(p.kind).toBe('asyncNotifierProvider');
    expect(p.promise.kind).toBe('promiseAccessor');
  });

  it('naming inheritance for child accessors', () => {
    const p1 = stateProvider(() => 1, { name: 'counter' });
    expect(p1.notifier.name).toBe('counter.notifier');
    
    const p2 = promiseProvider(async () => 1, { name: 'fetch' });
    expect(p2.promise.name).toBe('fetch.promise');

    const p3 = notifierProvider(() => ({} as any), { name: 'notif' });
    expect(p3.notifier.name).toBe('notif.notifier');

    const p4 = asyncNotifierProvider(() => ({} as any), { name: 'base' });
    expect(p4.notifier.name).toBe('base.notifier');
    expect(p4.promise.name).toBe('base.promise');
  });
});
