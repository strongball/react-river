/* ════════════════════════════════════════════════════════════════
 *  React River — DevTools Styles (injected at runtime)
 *  This module injects styles into the document automatically,
 *  so consumers don't need to import any CSS file.
 * ════════════════════════════════════════════════════════════════ */

import CSS from './RiverDevTools.css?inline';

const STYLE_ID = 'river-devtools-styles';

let injected = false;

export function injectDevToolsStyles(): void {
  if (injected || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) {
    injected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  injected = true;
}
