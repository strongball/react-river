import { useState } from "react";
import { useWatch, useRiverRef, useListen, when } from "react-river";
import {
  counterProvider,
  doubledProvider,
  todosProvider,
  userProvider,
  postProvider,
  timerProvider,
  clockProvider,
} from "./example-providers";
import "./App.css";

// ════════════════════════════════════════════════════════════════
//  App — React River Demo
// ════════════════════════════════════════════════════════════════

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🌊 React River</h1>
        <p className="subtitle">Riverpod-inspired state management for React</p>
      </header>

      <div className="grid">
        <CounterCard />
        <TodoCard />
        <UserCard />
        <PostCard />
        <TimerCard />
        <StreamCard />
      </div>

      <footer className="app-footer">
        <p>Open DevTools console to see 🌊 River observer logs</p>
      </footer>
    </div>
  );
}

// ── 1. Counter + Computed ──────────────────────────────────────

function CounterCard() {
  const count = useWatch(counterProvider);
  const doubled = useWatch(doubledProvider);
  const ref = useRiverRef();

  // Side-effect listener demo: log when count changes
  useListen(counterProvider, (_prev, next) => {
    if (next === 10) {
      console.log("🎉 Counter reached 10!");
    }
  });

  return (
    <section className="card">
      <div className="card-badge">stateProvider + provider</div>
      <h2>Counter</h2>
      <div className="counter-display">{count}</div>
      <p className="muted">
        doubled = <strong>{doubled}</strong>
      </p>
      <div className="button-row">
        <button onClick={() => ref.set(counterProvider, (c) => c - 1)}>−</button>
        <button onClick={() => ref.set(counterProvider, 0)} className="secondary">
          Reset
        </button>
        <button onClick={() => ref.set(counterProvider, (c) => c + 1)}>+</button>
      </div>
    </section>
  );
}

// ── 2. Todo List ───────────────────────────────────────────────

function TodoCard() {
  const todos = useWatch(todosProvider);
  const ref = useRiverRef();
  const [input, setInput] = useState("");

  const notifier = ref.read(todosProvider.notifier);

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    notifier.add(trimmed);
    setInput("");
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
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a todo…"
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      {todos.length === 0 ? (
        <p className="empty-state">No todos yet ✨</p>
      ) : (
        <ul className="todo-list">
          {todos.map((todo) => (
            <li key={todo.id} className={todo.done ? "done" : ""}>
              <label>
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => notifier.toggle(todo.id)}
                />
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

// ── 3. Async User ──────────────────────────────────────────────

function UserCard() {
  const userAsync = useWatch(userProvider);
  const ref = useRiverRef();

  return (
    <section className="card">
      <div className="card-badge">asyncNotifierProvider</div>
      <h2>User Profile</h2>

      {when(userAsync, {
        loading: () => <div className="skeleton">Loading user…</div>,
        error: (e) => <div className="error-box">Error: {String(e)}</div>,
        data: (user) => (
          <div className="user-info">
            <div className="avatar">{user.name.charAt(0)}</div>
            <div>
              <strong>{user.name}</strong>
              <p className="muted">{user.email}</p>
            </div>
          </div>
        ),
      })}

      <div className="button-row">
        <button
          onClick={() => {
            const notifier = ref.read(userProvider.notifier);
            notifier.refreshUser();
          }}
          disabled={userAsync.isLoading}
        >
          {userAsync.isLoading ? "Refreshing…" : "Refresh User"}
        </button>
      </div>
    </section>
  );
}

// ── 4. Post — Family Provider ──────────────────────────────────

function PostCard() {
  const [postId, setPostId] = useState(1);

  return (
    <section className="card">
      <div className="card-badge">futureProviderFamily</div>
      <h2>Post Viewer</h2>

      <div className="button-row">
        {[1, 2, 3, 4, 5].map((id) => (
          <button
            key={id}
            className={id === postId ? "active" : "secondary"}
            onClick={() => setPostId(id)}
          >
            #{id}
          </button>
        ))}
      </div>

      <PostContent postId={postId} />
    </section>
  );
}

function PostContent({ postId }: { postId: number }) {
  const postAsync = useWatch(postProvider(postId));

  return when(postAsync, {
    loading: () => <div className="skeleton">Loading post #{postId}…</div>,
    error: (e) => <div className="error-box">Error: {String(e)}</div>,
    data: (post) => (
      <div className="post-content">
        <h3>{post.title}</h3>
        <p>{post.body}</p>
      </div>
    ),
  });
}

// ── 5. Timer — Auto-Dispose Demo ───────────────────────────────

function TimerCard() {
  const [show, setShow] = useState(false);

  return (
    <section className="card">
      <div className="card-badge">autoDispose: true</div>
      <h2>Auto-Dispose</h2>
      <p className="muted">
        When the timer is hidden, the provider is automatically disposed (check logs).
      </p>

      {show ? (
        <div className="timer-box">
          <TimerDisplay />
          <button onClick={() => setShow(false)} className="secondary full-width">
            Stop & Unmount Timer
          </button>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="full-width">
          Start Timer (Mount)
        </button>
      )}
    </section>
  );
}

function TimerDisplay() {
  const count = useWatch(timerProvider);
  return (
    <div className="timer-display">
      <span className="icon">⏱️</span>
      <strong>{count}</strong> seconds
    </div>
  );
}

// ── 6. Stream — streamProvider Demo ────────────────────────────

function StreamCard() {
  const clockAsync = useWatch(clockProvider);

  return (
    <section className="card">
      <div className="card-badge">streamProvider</div>
      <h2>Live Clock</h2>
      <p className="muted">
        This provider yields a new value every 2 seconds via an async generator.
      </p>

      {when(clockAsync, {
        loading: () => <div className="skeleton">Starting stream…</div>,
        error: (e) => <div className="error-box">Stream Error: {String(e)}</div>,
        data: (value) => (
          <div className="stream-display">
            <span className="pulse-dot"></span>
            <code>{value}</code>
          </div>
        ),
      })}
    </section>
  );
}
