import { observableProvider } from 'react-river';

import { sleep } from './utils';

export const clockProvider = observableProvider<string>(
  (_ref) => ({
    subscribe: ({ next, error, complete }) => {
      let active = true;
      (async () => {
        try {
          while (active) {
            await sleep(1000);
            if (!active) break;
            next(`Observable tick: ${new Date().toLocaleTimeString()}`);
          }
          complete();
        } catch (e) {
          if (active) error(e);
        }
      })();

      return {
        unsubscribe: () => {
          active = false;
        },
      };
    },
  }),
  { name: 'clock' },
);
