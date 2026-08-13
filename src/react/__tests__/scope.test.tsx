import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { stateProvider } from '../../core/provider';
import { useRiverRef } from '../hooks';
import { RiverScope, useRiverContainer } from '../scope';

describe('RiverScope', () => {
  it('should provide container to children', () => {
    const p = stateProvider(() => 'hello', { name: 'test_stateProvider_387' });
    function Child() {
      const ref = useRiverRef();
      return <div data-testid="val">{ref.read(p)}</div>;
    }

    render(
      <RiverScope>
        <Child />
      </RiverScope>,
    );

    expect(screen.getByTestId('val').textContent).toBe('hello');
  });

  it('should hydrate providers from initialState', () => {
    const p = stateProvider(() => 'factory', { name: 'scope_hydrated_provider' });

    function Child() {
      const ref = useRiverRef();
      return <div data-testid="hydrated-val">{ref.read(p)}</div>;
    }

    render(
      <RiverScope initialState={{ scope_hydrated_provider: 'hydrated' }}>
        <Child />
      </RiverScope>,
    );

    expect(screen.getByTestId('hydrated-val').textContent).toBe('hydrated');
  });

  it('should replace observers when the observers prop changes', () => {
    const p = stateProvider(() => 0, { name: 'scope_observer_provider' });
    const firstObserver = { onProviderUpdate: vi.fn() };
    const secondObserver = { onProviderUpdate: vi.fn() };
    let setValue: ((value: number) => void) | undefined;

    function Child() {
      const ref = useRiverRef();
      ref.read(p);
      setValue = (value) => ref.set(p, value);
      return null;
    }

    const { rerender } = render(
      <RiverScope observers={[firstObserver]}>
        <Child />
      </RiverScope>,
    );

    rerender(
      <RiverScope observers={[secondObserver]}>
        <Child />
      </RiverScope>,
    );
    setValue?.(1);

    expect(firstObserver.onProviderUpdate).not.toHaveBeenCalled();
    expect(secondObserver.onProviderUpdate).toHaveBeenCalledOnce();
  });

  it('should support StrictMode remount logic', () => {
    let containerInstance: any;

    function Child() {
      containerInstance = useRiverContainer();
      return null;
    }

    const { unmount, rerender } = render(
      <React.StrictMode>
        <RiverScope>
          <Child />
        </RiverScope>
      </React.StrictMode>,
    );

    const firstContainer = containerInstance;
    expect(firstContainer).toBeDefined();
    expect(firstContainer.disposed).toBe(false);

    // Re-render
    rerender(
      <React.StrictMode>
        <RiverScope>
          <Child />
        </RiverScope>
      </React.StrictMode>,
    );

    expect(containerInstance).toBe(firstContainer);
    expect(containerInstance.disposed).toBe(false);
    expect(containerInstance._disposeTimeout).toBeUndefined();

    unmount();
    // Disposal is deferred via setTimeout(..., 0)
    // We can't easily test the timeout itself without vi.useFakeTimers()
  });

  it('should dispose container on unmount after timeout', async () => {
    vi.useFakeTimers();
    let containerInstance: any;

    function Child() {
      containerInstance = useRiverContainer();
      return null;
    }

    const { unmount } = render(
      <RiverScope>
        <Child />
      </RiverScope>,
    );

    const container = containerInstance;
    unmount();

    expect(container.disposed).toBe(false);
    vi.advanceTimersByTime(0);
    expect(container.disposed).toBe(true);
    vi.useRealTimers();
  });
});
