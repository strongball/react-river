import { stateProvider, provider } from '@stball/react-river';

export const counterProvider = stateProvider(() => 0, { name: 'counter' });

export const doubledProvider = provider(
  (ref) => {
    const count = ref.watch(counterProvider);
    return count * 2;
  },
  { name: 'doubled' },
);
