/* ════════════════════════════════════════════════════════════════
 *  React River — Unified Export Entry Point
 * ════════════════════════════════════════════════════════════════ */

// ── Core: AsyncValue ───────────────────────────────────────────
export type { AsyncValue, AsyncData, AsyncLoading, AsyncError } from './core/async_value';
export {
  asyncData,
  asyncError,
  asyncLoading,
  when,
  whenOrNull,
  mapAsyncValue,
  requireData,
  asyncValueEquals,
} from './core/async_value';

// ── Core: Provider Factories ───────────────────────────────────
export {
  provider,
  stateProvider,
  promiseProvider,
  observableProvider,
  notifierProvider,
  asyncNotifierProvider,
} from './core/provider';

// ── Core: Notifier Base Classes ────────────────────────────────
export { Notifier, AsyncNotifier } from './core/notifier';

// ── Core: Container ────────────────────────────────────────────
export { RiverContainer } from './core/container';
export type { RiverContainerOptions } from './core/container';

// ── Core: Family ───────────────────────────────────────────────
export type { ProviderFamily } from './core/family';
export {
  providerFamily,
  stateProviderFamily,
  promiseProviderFamily,
  observableProviderFamily,
  notifierProviderFamily,
  asyncNotifierProviderFamily,
} from './core/family';

// ── Core: Observer ─────────────────────────────────────────────
export type { RiverObserver } from './core/observer';

// ── Core: Types ────────────────────────────────────────────────
export type {
  Ref,
  RiverRef,
  ProviderBase,
  Provider,
  StateProvider,
  PromiseProvider,
  ObservableProvider,
  NotifierProvider,
  AsyncNotifierProvider,
  NotifierAccessor,
  StateController,
  ProviderOverride,
  ProviderOptions,
  ListenerCallback,
  Unsubscribe,
} from './core/types';

// ── React: Scope ───────────────────────────────────────────────
export { RiverScope } from './react/scope';
export type { RiverScopeProps } from './react/scope';

// ── React: Hooks ───────────────────────────────────────────────
export { useRiverWatch, useRiverRef, useRiverListen } from './react/hooks';

// ── React: Consumer ────────────────────────────────────────────
export { Consumer } from './react/consumer';
export type { ConsumerRef, ConsumerProps } from './react/consumer';

// ── DevTools ───────────────────────────────────────────────────
export { loggerObserver } from './devtools/devtools';
