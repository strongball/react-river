import { streamProvider } from 'react-river';

import { sleep } from './utils';

export const clockProvider = streamProvider(
  async function* (_ref) {
    while (true) {
      await sleep(1000);
      yield `Stream tick: ${new Date().toLocaleTimeString()}`;
    }
  },
  { name: 'clock' },
);
