import { observableProvider } from 'react-river';
import { sleep } from './utils';

export const asyncObservableProvider = observableProvider<string>(async (_ref) => {
  // Simulate an async setup phase (e.g., waiting for a socket connection)
  await sleep(2000);

  return {
    subscribe: ({ next }) => {
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
}, { name: 'asyncObservable' });
