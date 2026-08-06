import { streamProvider } from '@zerologix/react-river';

import { sleep } from './utils';

/** A synchronous generator is consumed during initialization. */
export const syncGeneratorProvider = streamProvider<string>(
  function* () {
    yield 'first yield';
    yield 'final yield';
  },
  { name: 'syncGenerator' },
);

/** An async generator updates the provider as each value is yielded. */
export const asyncGeneratorProvider = streamProvider<string>(
  async function* () {
    for (let count = 1; count <= 5; count++) {
      await sleep(1000);
      yield `async generator tick ${count}/5`;
    }
  },
  { name: 'asyncGenerator' },
);
