/** What each answer to a brain's checkpoint leads to, in plain words, from the brain's own question. */
export function nextSteps(words) {
  const m = /,\s+then\s+(.+?)[.?!]*\s*$/i.exec(words || '');
  if (!m || !m[1]) return { yes: 'Tell the brain yes.', no: 'Tell the brain no.' };
  return { yes: `The brain will ${m[1]}.`, no: 'The brain will hold off and ask what to change.' };
}
