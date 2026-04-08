import { AsyncNotifier, asyncNotifierProvider, asyncData, asyncLoading, asyncError } from '@zerologix/react-river';

import { sleep } from './utils';

export interface User {
  id: number;
  name: string;
  email: string;
}

class UserNotifier extends AsyncNotifier<User> {
  async build(): Promise<User> {
    // Simulate API call
    await sleep(1500);
    return {
      id: 1,
      name: 'Howie',
      email: 'howie@example.com',
    };
  }

  async refreshUser() {
    this.state = asyncLoading(this.state.data);
    try {
      await sleep(1000);
      this.state = asyncData({
        id: 1,
        name: 'Howie (refreshed)',
        email: `howie+${Date.now()}@example.com`,
      });
    } catch (e) {
      this.state = asyncError(e, this.state.data);
    }
  }
}

export const userProvider = asyncNotifierProvider(() => new UserNotifier(), {
  name: 'user',
});
