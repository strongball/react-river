import {
  CounterCard,
  TodoCard,
  UserCard,
  PostCard,
  TimerCard,
  StreamCard,
} from "./components";
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
