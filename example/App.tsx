import { createDevToolsObserver, RiverDevTools, RiverScope } from '@zerologix/react-river';

import './App.css';
import {
  CounterCard,
  ScopedCounterCard,
  TodoCard,
  UserCard,
  PostCard,
  TimerCard,
  StreamCard,
} from './components';

// ════════════════════════════════════════════════════════════════
//  App — React River Demo
// ════════════════════════════════════════════════════════════════

export default function App() {
  const devtools = createDevToolsObserver();

  return (
    <RiverScope observers={[devtools.observer]}>
      <div className="app">
        <header className="app-header">
          <h1>🌊 React River</h1>
          <p className="subtitle">Riverpod-inspired state management for React</p>
        </header>

        <div className="grid">
          <ScopedCounterCard />
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
      <RiverDevTools devtools={devtools} />
    </RiverScope>
  );
}
