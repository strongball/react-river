import React from 'react';

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { stateProvider } from '../../core/provider';
import { useRiverMutation, useRiverWatch } from '../hooks';
import { RiverScope } from '../scope';

const wrapper = ({ children }: { children: React.ReactNode }) => <RiverScope>{children}</RiverScope>;

describe('useRiverMutation', () => {
  const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it('should start with idle state (asyncData undefined)', () => {
    const { result } = renderHook(() => useRiverMutation(async () => {}), { wrapper });

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

  it('should only let the latest mutation update state', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const { result } = renderHook(
      () =>
        useRiverMutation(async (_ref, value: 'first' | 'second') =>
          value === 'first' ? first.promise : second.promise,
        ),
      { wrapper },
    );

    let firstPromise!: Promise<string>;
    let secondPromise!: Promise<string>;
    act(() => {
      firstPromise = result.current.mutate('first');
      secondPromise = result.current.mutate('second');
    });

    await act(async () => {
      second.resolve('second result');
      await secondPromise;
    });
    expect(result.current.state.data).toBe('second result');

    const firstError = new Error('first failed');
    await act(async () => {
      first.reject(firstError);
      await expect(firstPromise).rejects.toBe(firstError);
    });
    expect(result.current.state.data).toBe('second result');
  });

  it('should not let an in-flight mutation overwrite reset state', async () => {
    const pending = deferred<number>();
    const { result } = renderHook(() => useRiverMutation(async () => pending.promise), { wrapper });

    let mutationPromise!: Promise<number>;
    act(() => {
      mutationPromise = result.current.mutate(undefined as never);
      result.current.reset();
    });

    await act(async () => {
      pending.resolve(42);
      await expect(mutationPromise).resolves.toBe(42);
    });
    expect(result.current.state.status).toBe('data');
    expect(result.current.state.data).toBeUndefined();
  });

  it('should call onSuccess / onSettled callbacks with context', async () => {
    const onMutate = vi.fn(() => ({ snapshot: 'before' }));
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(
      () => useRiverMutation(async (_ref, n: number) => n * 2, { onMutate, onSuccess, onSettled }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutate(5);
    });

    expect(onMutate).toHaveBeenCalledTimes(1);
    expect(onMutate).toHaveBeenCalledWith(5, expect.any(Object));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(10, 5, { snapshot: 'before' }, expect.any(Object));

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(10, undefined, 5, { snapshot: 'before' }, expect.any(Object));
  });

  it('should not classify an onSuccess callback error as a mutation failure', async () => {
    const callbackError = new Error('callback failed');
    const onError = vi.fn();
    const onSettled = vi.fn();
    const { result } = renderHook(
      () =>
        useRiverMutation(async () => 42, {
          onSuccess: () => {
            throw callbackError;
          },
          onError,
          onSettled,
        }),
      { wrapper },
    );

    await act(async () => {
      await expect(result.current.mutate(undefined as never)).rejects.toBe(callbackError);
    });

    expect(result.current.state.status).toBe('data');
    expect(result.current.state.data).toBe(42);
    expect(onError).not.toHaveBeenCalled();
    expect(onSettled).toHaveBeenCalledWith(42, undefined, undefined, undefined, expect.any(Object));
  });

  it('should call onError / onSettled callbacks with context on failure', async () => {
    const onMutate = vi.fn(() => ({ rollback: true }));
    const onError = vi.fn();
    const onSettled = vi.fn();
    const error = new Error('fail');

    const { result } = renderHook(
      () =>
        useRiverMutation(
          async () => {
            throw error;
          },
          { onMutate, onError, onSettled },
        ),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutate(undefined as never).catch(() => {});
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error, undefined, { rollback: true }, expect.any(Object));

    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith(undefined, error, undefined, { rollback: true }, expect.any(Object));
  });

  it('should support optimistic update & rollback via onMutate context', async () => {
    const listProvider = stateProvider(() => ['a', 'b', 'c'], { name: 'test_stateProvider_list' });
    const error = new Error('server error');

    const { result } = renderHook(
      () => {
        const list = useRiverWatch(listProvider);
        const mutation = useRiverMutation<void, string, { previous: string[] }>(
          async () => {
            throw error;
          },
          {
            onMutate: (itemToRemove, ref) => {
              const previous = ref.read(listProvider);
              // Optimistic: remove item immediately
              ref.set(listProvider, (prev) => prev.filter((i) => i !== itemToRemove));
              return { previous };
            },
            onError: (_err, _vars, context, ref) => {
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

  it('should abort mutation when onMutate throws', async () => {
    const onMutate = vi.fn(() => {
      throw new Error('onMutate error');
    });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useRiverMutation(async (_ref, n: number) => n * 2, { onMutate, onSuccess }), {
      wrapper,
    });

    // Mutation should abort when onMutate throws
    await act(async () => {
      await expect(result.current.mutate(5)).rejects.toThrow('onMutate error');
    });

    // The mutation function should NOT have been called
    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.state.status).toBe('error');
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
    const nameProvider = stateProvider(() => 'River', { name: 'test_stateProvider_name' });

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
