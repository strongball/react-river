import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { stateProvider } from '../../core/provider';
import { Consumer } from '../consumer';
import { RiverScope } from '../scope';

const counterProvider = stateProvider(() => 0, { name: 'test_stateProvider_counter' });

describe('Consumer Component', () => {
  it('should render children using render-prop', () => {
    render(
      <RiverScope>
        <Consumer>
          {(ref) => {
            const count = ref.read(counterProvider);
            return <div data-testid="count">{count}</div>;
          }}
        </Consumer>
      </RiverScope>,
    );

    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('should support imperative operations via ref', () => {
    let capturedRef: any;
    render(
      <RiverScope>
        <Consumer>
          {(ref) => {
            capturedRef = ref;
            const count = ref.read(counterProvider);
            return <div data-testid="count">{count}</div>;
          }}
        </Consumer>
      </RiverScope>,
    );

    expect(screen.getByTestId('count')).toHaveTextContent('0');

    act(() => {
      capturedRef.set(counterProvider, 100);
    });

    // Note: In the current implementation, ref.watch calls ref.read() (non-reactive)
    // So we don't expect it to re-render automatically unless we use a hook.
    // However, if we re-render manually or if the parent re-renders, it should show 100.

    // For now, let's just verify the state was updated in the container.
    expect(capturedRef.read(counterProvider)).toBe(100);
  });

  it('should re-render when a watched provider changes', async () => {
    let renderCount = 0;
    render(
      <RiverScope>
        <Consumer>
          {(ref) => {
            renderCount++;
            const count = ref.watch(counterProvider);
            return (
              <div>
                <span data-testid="count">{count}</span>
                <button onClick={() => ref.set(counterProvider, (prev) => prev + 1)}>Incr</button>
              </div>
            );
          }}
        </Consumer>
      </RiverScope>,
    );

    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(renderCount).toBe(1);

    act(() => {
      screen.getByText('Incr').click();
    });

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    // It might render once for the first discovery and once for the update
    expect(renderCount).toBeGreaterThan(1);
  });
});
