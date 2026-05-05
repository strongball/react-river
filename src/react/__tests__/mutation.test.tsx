import React from 'react';

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { stateProvider } from '../../core/provider';
import { useRiverMutation, useRiverRef, useRiverWatch } from '../hooks';
import { RiverScope } from '../scope';

const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

describe('useRiverMutation', () => {
  it('should start with idle state (asyncData undefined)', () => {
    const { result } = renderHook(
      () => useRiverMutation(async () => {}),
      { wrapper },
    );

    expect(result.current.state.status).toBe('data');
    expect(result.current.state.data).toBeUndefined();
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.isError).toBe(false);
  });

  it('should transition loading → data on success', async () => {
    const { result } = renderHook(
      () =>
        useRiverMutation(async (_ref, name: string) => {
          return `Hello, ${name}`;
        }),
      { wrapper },
    );

    let promise: Promise<string>;
    act(() => {
      promise = result.current.mutate('River');
    });

    // Should be loading
    expect(result.current.state.status).toBe('loading');
    expect(result.current.state.isLoading).toBe(true);

    // Wait for completion
    await act(async () => {
      await promise;
    });

    expect(result.current.state.status).toBe('data');
    expect(result.current.state.data).toBe('Hello, River');
    expect(result.current.state.isLoading).toBe(false);
  });

  it('should transition loading → error on failure', async () => {
    const error = new Error('mutation failed');
    const { result } = renderHook(
      () =>
        useRiverMutation(async () => {
          throw error;
        }),
      { wrapper },
    );

    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.mutate(undefined as never).catch(() => {});
    });

    expect(result.current.state.isLoading).toBe(true);

    await act(async () => {
      await promise;
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.isError).toBe(true);
    expect(result.current.state.error).toBe(error);
  });

  it('should reset state back to idle', async () => {
    const { result } = renderHook(
      () =>
        useRiverMutation(async () => {
          return 42;
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutate(undefined as never);
    });

    expect(result.current.state.data).toBe(42);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('data');
    expect(result.current.state.data).toBeUndefined();
  });

  it('should call onSuccess / onSettled callbacks with context', async () => {
    const onMutate = vi.fn(() => ({ snapshot: 'before' }));
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(
      () =>
        useRiverMutation(
          async (_ref, n: number) => n * 2,
          { onMutate, onSuccess, onSettled },
        ),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutate(5);
    });

    expect(onMutate).toHaveBeenCalledTimes(1);
    expect(onMutate).toHaveBeenCalledWith(5, expect.any(Object));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(10, 5, expect.any(Object), { snapshot: 'before' });

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(10, undefined, 5, expect.any(Object), { snapshot: 'before' });
  });

  it('should call onError / onSettled callbacks with context on failure', async () => {
    const onMutate = vi.fn(() => ({ rollback: true }));
    const onError = vi.fn();
    const onSettled = vi.fn();
    const error = new Error('fail');

    const { result } = renderHook(
      () =>
        useRiverMutation(
          async () => { throw error; },
          { onMutate, onError, onSettled },
        ),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutate(undefined as never).catch(() => {});
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error, undefined, expect.any(Object), { rollback: true });

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(undefined, error, undefined, expect.any(Object), { rollback: true });
  });

  it('should support optimistic update & rollback via onMutate context', async () => {
    const listProvider = stateProvider(() => ['a', 'b', 'c']);
    const error = new Error('server error');

    const { result } = renderHook(
      () => {
        const list = useRiverWatch(listProvider);
        const mutation = useRiverMutation<void, string, { previous: string[] }>(
          async () => { throw error; },
          {
            onMutate: (itemToRemove, ref) => {
              const previous = ref.read(listProvider);
              // Optimistic: remove item immediately
              ref.set(listProvider, prev => prev.filter(i => i !== itemToRemove));
              return { previous };
            },
            onError: (_err, _vars, ref, context) => {
              // Rollback on error
              if (context?.previous) ref.set(listProvider, context.previous);
            },
          },
        );
        return { list, mutation };
      },
      { wrapper },
    );

    expect(result.current.list).toEqual(['a', 'b', 'c']);

    // Trigger delete of 'b'
    await act(async () => {
      await result.current.mutation.mutate('b').catch(() => {});
    });

    // After error + rollback, list should be restored
    expect(result.current.list).toEqual(['a', 'b', 'c']);
  });

  it('should still proceed when onMutate throws', async () => {
    const onMutate = vi.fn(() => { throw new Error('onMutate error'); });

    const { result } = renderHook(
      () =>
        useRiverMutation(
          async (_ref, n: number) => n * 2,
          { onMutate },
        ),
      { wrapper },
    );

    // Mutation should still execute despite onMutate throwing
    await act(async () => {
      await result.current.mutate(5);
    });

    expect(result.current.state.status).toBe('data');
    expect(result.current.state.data).toBe(10);
  });

  it('should isolate state per hook instance (table scenario)', async () => {
    const { result: hook1 } = renderHook(
      () =>
        useRiverMutation(async (_ref, id: string) => {
          return `deleted-${id}`;
        }),
      { wrapper },
    );

    const { result: hook2 } = renderHook(
      () =>
        useRiverMutation(async (_ref, id: string) => {
          return `deleted-${id}`;
        }),
      { wrapper },
    );

    // Trigger only hook1
    await act(async () => {
      await hook1.current.mutate('row-1');
    });

    // hook1 has data, hook2 still idle
    expect(hook1.current.state.status).toBe('data');
    expect(hook1.current.state.data).toBe('deleted-row-1');

    expect(hook2.current.state.status).toBe('data');
    expect(hook2.current.state.data).toBeUndefined();
  });

  it('should access providers via ref inside mutation fn', async () => {
    const nameProvider = stateProvider(() => 'River');

    const { result } = renderHook(
      () =>
        useRiverMutation(async (ref) => {
          const name = ref.read(nameProvider);
          return `Hello, ${name}`;
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutate(undefined as never);
    });

    expect(result.current.state.data).toBe('Hello, River');
  });

  it('mutate should throw the error to the caller', async () => {
    const error = new Error('boom');
    const { result } = renderHook(
      () =>
        useRiverMutation(async () => {
          throw error;
        }),
      { wrapper },
    );

    await act(async () => {
      await expect(result.current.mutate(undefined as never)).rejects.toThrow('boom');
    });
  });
});

