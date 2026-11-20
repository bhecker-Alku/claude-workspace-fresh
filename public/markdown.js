/** Small, safe markdown for brain replies: escapes HTML first, then bold, italics, code, links, headings, lists. */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A file:/// link or a Windows file path (C:\...\name.ext). The app opens it in its normal program.
const fileLink = (label, p) => `<a href="#" class="file-link" data-path="${p}" title="Open ${p}">${label}</a>`;
const WIN_FILE = /^[A-Za-z]:[\\/][^<>"|?*\n]*\.\w{1,6}$/;

function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(file:\/\/\/?([^\s)]+)\)/g, (_, label, p) => fileLink(label, decodeURI(p)))
    .replace(/\[([^\]]+)\]\(&lt;([A-Za-z]:[\\/][^)]*?)&gt;\)/g, (_, label, p) => fileLink(label, p))
    .replace(/`([^`]+)`/g, (_, c) => (WIN_FILE.test(c) ? `<code class="file-link" data-path="${c}" title="Click to open">${c}</code>` : `<code>${c}</code>`))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

/** A ``` fenced block, drawn as a card with a Copy button (chat.js handles the click). */
function copyCard(label, lines) {
  const title = esc(label.trim() || 'Ready to copy');
  return `<div class="card copyblock"><div class="copyhead"><strong>${title}</strong>`
    + `<button type="button" class="btn sm primary copybtn">Copy</button></div>`
    + `<pre>${esc(lines.join('\n'))}</pre></div>`;
}

export function markdown(text) {
  const out = [];
  let list = null;
  let fence = null; // { label, lines } while inside a ``` block
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of text.split('\n')) {
    const f = line.match(/^\s*```(.*)$/);
    if (fence) {
      if (f && !f[1].trim()) { out.push(copyCard(fence.label, fence.lines)); fence = null; }
      else fence.lines.push(line);
      continue;
    }
    if (f) { close(); fence = { label: f[1], lines: [] }; continue; }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    const ul = line.match(/^\s*[-*]\s+(.*)/);
    const h = line.match(/^(#{1,3})\s+(.*)/);
    if (ol || ul) {
      const tag = ol ? 'ol' : 'ul';
      if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; }
      out.push(`<li>${inline((ol || ul)[1])}</li>`);
    } else {
      close();
      if (h) out.push(`<h4>${inline(h[2])}</h4>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  if (fence) out.push(copyCard(fence.label, fence.lines)); // still streaming, or never closed
  return out.join('');
}
