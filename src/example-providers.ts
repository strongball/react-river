/* ════════════════════════════════════════════════════════════════
 *  React River — Example Providers
 *  Defines all providers used in the demo app.
 * ════════════════════════════════════════════════════════════════ */

import {
  Notifier,
  AsyncNotifier,
  stateProvider,
  notifierProvider,
  asyncNotifierProvider,
  provider,
  futureProviderFamily,
  asyncData,
  asyncLoading,
  asyncError,
} from "./index";

// ── 1. Counter — stateProvider ─────────────────────────────────

export const counterProvider = stateProvider(() => 0, { name: "counter" });

// ── 2. Doubled — computed provider (depends on counter) ────────

export const doubledProvider = provider(
  (ref) => {
    const count = ref.watch(counterProvider);
    return count * 2;
  },
  { name: "doubled" },
);

// ── 3. Todo — notifierProvider ─────────────────────────────────

export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

let nextTodoId = 1;

class TodoNotifier extends Notifier<Todo[]> {
  build() {
    return [] as Todo[];
  }

  add(text: string) {
    this.state = [...this.state, { id: nextTodoId++, text, done: false }];
  }

  toggle(id: number) {
    this.state = this.state.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  remove(id: number) {
    this.state = this.state.filter((t) => t.id !== id);
  }
}

export const todosProvider = notifierProvider<TodoNotifier, Todo[]>(() => new TodoNotifier(), {
  name: "todos",
});

// ── 4. Async user — asyncNotifierProvider ──────────────────────

interface User {
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
      name: "Howie",
      email: "howie@example.com",
    };
  }

  async refreshUser() {
    this.state = asyncLoading(this.state.data);
    try {
      await sleep(1000);
      this.state = asyncData({
        id: 1,
        name: "Howie (refreshed)",
        email: `howie+${Date.now()}@example.com`,
      });
    } catch (e) {
      this.state = asyncError(e, this.state.data);
    }
  }
}

export const userProvider = asyncNotifierProvider<UserNotifier, User>(() => new UserNotifier(), {
  name: "user",
});

// ── 5. Post — futureProviderFamily ─────────────────────────────

interface Post {
  id: number;
  title: string;
  body: string;
}

export const postProvider = futureProviderFamily<Post, number>(
  async (_ref, postId) => {
    await sleep(800 + Math.random() * 700);
    return {
      id: postId,
      title: `Post #${postId}`,
      body: `This is the content of post ${postId}. Loaded at ${new Date().toLocaleTimeString()}.`,
    };
  },
  { name: "post" },
);

// ── 6. Infinite — notifierProvider ─────────────────────────────

class InfiniteNotifier extends Notifier<number> {
  build() {
    setInterval(() => {
      this.state += 1;
    }, 1000);
    return 0;
  }

  add() {
    this.state += 1;
  }
}

export const infiniteProvider = notifierProvider<InfiniteNotifier, number>(
  () => new InfiniteNotifier(),
);

// ── Helpers ────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
