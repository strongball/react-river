import { observableProvider } from '@stball/react-river';

import { sleep } from './utils';

export const asyncObservableProvider = observableProvider<string>(
  async (_ref) => {
    // Simulate an async setup phase (e.g., waiting for a socket connection)
    await sleep(2000);

    return {
      subscribe: (callbacks) => {
        const next = typeof callbacks === 'function' ? callbacks : callbacks.next;
        let count = 0;
        const timer = setInterval(() => {
          next(`Async Observable tick: ${++count}`);
        }, 1000);

        return {
          unsubscribe: () => {
            clearInterval(timer);
          },
        };
      },
    };
  },
  { name: 'asyncObservable' },
);
