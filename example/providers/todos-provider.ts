import { Notifier, notifierProvider } from "react-river";

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

export const todosProvider = notifierProvider(() => new TodoNotifier(), {
  name: "todos",
});
