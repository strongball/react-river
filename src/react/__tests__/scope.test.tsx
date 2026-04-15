import React from 'react';

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { stateProvider } from '../../core/provider';
import { useRiverRef } from '../hooks';
import { RiverScope, useRiverContainer } from '../scope';

describe('RiverScope', () => {
  it('should provide container to children', () => {
    const p = stateProvider(() => 'hello');
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
