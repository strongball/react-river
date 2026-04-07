import { useState } from 'react';
import { useRiverWatch, useRiverRef } from 'react-river';

import { todosProvider } from '../providers';

export function TodoCard() {
  const todos = useRiverWatch(todosProvider);
  const ref = useRiverRef();
  const [input, setInput] = useState('');

  const notifier = ref.read(todosProvider.notifier);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    notifier.add(trimmed);
    setInput('');
  };

  return (
    <section className="card">
      <div className="card-badge">notifierProvider</div>
      <h2>
        Todos <span className="count-badge">{todos.length}</span>
      </h2>

      <div className="input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a todo…"
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      {todos.length === 0 ? (
        <p className="empty-state">No todos yet ✨</p>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo.id} className={todo.done ? 'done' : ''}>
              <label>
                <input type="checkbox" checked={todo.done} onChange={() => notifier.toggle(todo.id)} />
                <span>{todo.text}</span>
              </label>
              <button className="delete-btn" onClick={() => notifier.remove(todo.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
