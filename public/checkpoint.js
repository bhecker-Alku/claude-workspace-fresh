import { html } from 'https://esm.sh/htm@3.1.1/preact/standalone';
import { nextSteps } from './next-steps.js';

const plain = (s) => s.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ');

/** One checkpoint at a time: the brain's question and three answers, each saying what happens next. */
export function CheckpointCard({ items, onAnswer, busy = false }) {
  if (!items.length) return null;
  const item = items[0];
  const steps = nextSteps(item.words);
  const question = item.words ? item.words.charAt(0).toUpperCase() + item.words.slice(1) : `The brain is waiting on you in "${plain(item.run)}".`;
  return html`<section class="checkpoint" aria-label="A brain is waiting on you">
    <div class="checkpoint-head"><span>The brain is asking you</span>${items.length > 1 ? html`<span class="count">1 of ${items.length}</span>` : null}</div>
    <p class="checkpoint-q">${question}</p>
    <div class="checkpoint-answers">
      <button class="answer" disabled=${busy} onClick=${() => onAnswer(item, 'Yes')}><strong>Yes</strong><span>${steps.yes}</span></button>
      <button class="answer" disabled=${busy} onClick=${() => onAnswer(item, 'No')}><strong>No</strong><span>${steps.no}</span></button>
      <button class="answer" disabled=${busy} onClick=${() => onAnswer(item, null)}><strong>Something else</strong><span>Type the right answer yourself.</span></button>
    </div>
    <div class="checkpoint-from">${busy ? 'This brain is working. Answer when it is done.' : `From: ${plain(item.run)}`}</div>
  </section>`;
}

/** The plain message the brain gets for an answer. Without an answer it ends ready for typing. */
export const answerText = (item, answer) =>
  `Checkpoint in run ${item.run} (${item.step})${item.words ? `: "${item.words}"` : ''}. My answer: ${answer ?? ''}`.trimEnd() + (answer ? '.' : ' ');
