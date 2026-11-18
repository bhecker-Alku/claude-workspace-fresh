import { html } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { markdown } from './markdown.js';

const PATHS = {
  brain: 'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z M12 5v13',
  plus: 'M5 12h14 M12 5v14',
  send: 'M22 2 11 13 M22 2l-7 20-4-9-9-4Z',
  paperclip: 'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
  library: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M5 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  check: 'M20 6 9 17l-5-5',
  power: 'M12 2v10 M18.4 6.6a9 9 0 1 1-12.77.04',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z',
  x: 'M18 6 6 18 M6 6l12 12',
  moon: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  chevron: 'm9 18 6-6-6-6',
  trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  apps: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M17.5 14v7 M14 17.5h7',
  refresh: 'M21 12a9 9 0 1 1-2.64-6.36L21 8 M21 3v5h-5',
  pencil: 'M21.17 6.81a1 1 0 0 0-3.98-3.98L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z M15 5l4 4',
};

export const Icon = ({ name }) =>
  html`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name].split(' M').map((d, i) => html`<path d=${i ? 'M' + d : d} />`)}</svg>`;

export function Working({ steps, live }) {
  return html`<details class="card working" open=${live}>
    <summary><${Icon} name="chevron" /> Working · ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}</summary>
    <ul>${steps.map((s) => html`<li>${s}</li>`)}</ul>
  </details>`;
}

export function TeamUp({ item }) {
  return html`<details class="card teamup">
    <summary>
      <${Icon} name="users" />
      <span>Asked <strong>${item.brain}</strong></span>
      ${item.needsConfirmation ? html`<span class="badge warn">Needs confirmation</span>` : html`<span class="badge">Answered</span>`}
    </summary>
    <div class="body"><div class="msg note">${item.question}</div><div class="md" dangerouslySetInnerHTML=${{ __html: markdown(item.answer) }}></div></div>
  </details>`;
}

export function Approval({ item, onDecide }) {
  const state = item.allowed === undefined ? null : item.allowed;
  return html`<div class="card approval" role="group" aria-label=${'Approval: ' + (item.title || 'action')}>
    <h3><${Icon} name="shield" /> ${item.title || 'An action'}
      ${state === true ? html`<span class="badge ok">Approved</span>` : state === false ? html`<span class="badge no">Denied</span>` : null}
    </h3>
    ${item.detail ? html`<pre>${item.detail}</pre>` : null}
    ${state === null && item.id
      ? html`<div class="actions">
          <button class="btn sm" autofocus onClick=${() => onDecide(item.id, false)}><${Icon} name="x" /> Deny</button>
          <button class="btn sm primary" onClick=${() => onDecide(item.id, true)}><${Icon} name="check" /> Approve</button>
        </div>`
      : null}
  </div>`;
}
