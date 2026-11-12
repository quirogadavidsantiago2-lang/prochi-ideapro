(() => {
  'use strict';

  const script = document.currentScript;
  if (!script || window.__IDEAPRO_PROCHI_WIDGET__) return;
  const source = new URL(script.src, document.baseURI);
  let destination;
  try {
    destination = script.dataset.prochiUrl
      ? new URL(script.dataset.prochiUrl, document.baseURI)
      : new URL('./', source);
  } catch {
    return;
  }
  const protocols = location.protocol === 'file:' ? ['https:', 'http:', 'file:'] : ['https:', 'http:'];
  if (!protocols.includes(destination.protocol) || destination.username || destination.password) return;
  window.__IDEAPRO_PROCHI_WIDGET__ = true;

  function mount() {
    const style = document.createElement('style');
    style.textContent = `
      .ideapro-prochi-widget {
        position: fixed;
        inset-inline-end: max(18px, env(safe-area-inset-right));
        bottom: max(18px, env(safe-area-inset-bottom));
        z-index: 2147483000;
        display: inline-flex;
        align-items: center;
        gap: 9px;
        max-width: calc(100vw - 36px);
        box-sizing: border-box;
        padding: 8px 13px 8px 8px;
        border: 1px solid #4c5c69;
        border-radius: 28px;
        background: #172633;
        color: #fff;
        font: 700 14px/1.3 system-ui, sans-serif;
        text-decoration: none;
        box-shadow: 0 8px 30px #17263338;
      }
      .ideapro-prochi-widget[data-position="left"] {
        inset-inline-end: auto;
        inset-inline-start: max(18px, env(safe-area-inset-left));
      }
      .ideapro-prochi-widget:hover { background: #263d4e; color: #fff; }
      .ideapro-prochi-widget:focus-visible { outline: 3px solid #f39200; outline-offset: 3px; }
      .ideapro-prochi-widget img { flex: none; width: 34px; height: 34px; border-radius: 50%; object-fit: cover; }
      .ideapro-prochi-widget span:last-child { color: #ffbf63; }
    `;
    document.head.append(style);

    const launcher = document.createElement('a');
    launcher.className = 'ideapro-prochi-widget';
    launcher.dataset.position = script.dataset.prochiPosition === 'left' ? 'left' : 'right';
    launcher.href = destination.href;
    launcher.target = '_blank';
    launcher.rel = 'noopener noreferrer';

    const avatar = document.createElement('img');
    avatar.src = new URL('prochi-avatar.jpeg', source).href;
    avatar.width = 34;
    avatar.height = 34;
    avatar.alt = '';

    const label = document.createElement('span');
    label.textContent = script.dataset.prochiLabel?.trim() || 'Habla con PROCHI';
    const arrow = document.createElement('span');
    arrow.textContent = '↗';
    arrow.setAttribute('aria-hidden', 'true');
    launcher.append(avatar, label, arrow);
    document.body.append(launcher);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true });
})();
