#!/usr/bin/env node
// Word and PowerPoint for the brain, with nothing to install (Node 18+).
//
//   node engine/tools/office.mjs text <file.docx|file.pptx>      print the text, numbered so feedback can point at it
//   node engine/tools/office.mjs docx <in.md> <out.docx> [--title "Title"]   save markdown as a Word document
//   node engine/tools/office.mjs changed <old.txt> <new.txt>   which paragraphs changed between two saved versions
//
// PDFs: read them directly (the Read tool opens PDFs). Excel and other formats are not handled here.
// Text output numbers paragraphs as [P12] (Word) and slides as [Slide 3] (PowerPoint).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- reading .docx / .pptx (they are zip files of XML) ----

/** Reads every file in a zip into a Map of name -> Buffer. Handles stored and deflated entries. */
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file (is it really a .docx or .pptx?)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26), lExtraLen = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lNameLen + lExtraLen, local + 30 + lNameLen + lExtraLen + csize);
    if (method === 0) files.set(name, Buffer.from(data));
    else if (method === 8) files.set(name, inflateRawSync(data));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const runsText = (xml) => unxml([...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)].map((m) => (m[1] !== undefined ? m[1] : m[0] === '<w:tab/>' ? '\t' : '\n')).join(''));

/** Word: one line per paragraph, numbered, with headings marked and list items bulleted. Tables become rows. */
export function docxText(buf) {
  const files = readZip(buf);
  const doc = files.get('word/document.xml')?.toString('utf8');
  if (!doc) throw new Error('no word/document.xml inside: not a Word document');
  const body = doc.slice(doc.indexOf('<w:body'));
  const out = [];
  let n = 0;
  for (const m of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g)) {
    const block = m[0];
    if (block.startsWith('<w:tbl>')) {
      for (const row of block.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)) {
        const cells = [...row[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => runsText(c[0]).replace(/\s+/g, ' ').trim());
        out.push(`[T${++n}] | ${cells.join(' | ')} |`);
      }
      continue;
    }
    const text = runsText(block).trim();
    if (!text) continue;
    const style = block.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '';
    const h = style.match(/^(?:Heading|heading|Titre|berschrift)\s?(\d)/) ?? (style === 'Title' ? ['', '1'] : null);
    const list = /<w:numPr>/.test(block) || /List/i.test(style);
    const caption = /Caption/i.test(style);
    out.push(`[P${++n}] ${h ? '#'.repeat(Number(h[1])) + ' ' : list ? '- ' : caption ? '(caption) ' : ''}${text}`);
  }
  const comments = files.get('word/comments.xml')?.toString('utf8');
  if (comments) {
    const list = [...comments.matchAll(/<w:comment [^>]*w:author="([^"]*)"[^>]*>([\s\S]*?)<\/w:comment>/g)].map((c) => `- ${unxml(c[1])}: ${runsText(c[2]).trim()}`);
    if (list.length) out.push('', '## Comments in the document', ...list);
  }
  return out.join('\n');
}

/** PowerPoint: each slide's text in order, then its speaker notes. */
export function pptxText(buf) {
  const files = readZip(buf);
  const slides = [...files.keys()].filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1]));
  if (!slides.length) throw new Error('no slides inside: not a PowerPoint file');
  const para = (xml) => [...xml.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map((p) => unxml([...p[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join('')).trim()).filter(Boolean);
  const out = [];
  slides.forEach((s, i) => {
    out.push(`[Slide ${i + 1}]`, ...para(files.get(s).toString('utf8')).map((t) => `  ${t}`));
    const notes = files.get(`ppt/notesSlides/notesSlide${s.match(/(\d+)\.xml/)[1]}.xml`)?.toString('utf8');
    const nt = notes ? para(notes).filter((t) => !/^\d+$/.test(t)) : [];
    if (nt.length) out.push('  (speaker notes) ' + nt.join(' '));
    out.push('');
  });
  return out.join('\n');
}

// ---- writing .docx from markdown ----

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** A zip with stored (uncompressed) entries: small, simple, and opened by Word without complaint. */
export function writeZip(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.from(content), nameBuf = Buffer.from(name), crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameBuf.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** **bold**, *italic* and plain text as Word runs. */
const runs = (text) => text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).filter(Boolean).map((t) => {
  const bold = /^\*\*.*\*\*$/.test(t), italic = !bold && /^\*.*\*$/.test(t);
  const s = bold ? t.slice(2, -2) : italic ? t.slice(1, -1) : t;
  return `<w:r>${bold || italic ? `<w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(s)}</w:t></w:r>`;
}).join('');

/** Markdown (headings, paragraphs, - and 1. lists, **bold**, *italic*, > quotes) to a Word document. */
export function markdownToDocx(md, title = '') {
  const paras = [];
  const p = (text, style) => paras.push(`<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}${runs(text)}</w:p>`);
  // The document's own first heading already is the title: do not add it twice, and do not drop it.
  const firstHeading = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').split(/\r?\n/).find((l) => l.trim())?.match(/^#\s+(.*)$/)?.[1]?.trim();
  if (title && firstHeading?.toLowerCase() !== title.trim().toLowerCase()) p(title, 'Title');
  let buf = [];
  const flush = () => { if (buf.length) { p(buf.join(' ')); buf = []; } };
  for (const raw of md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    let m;
    if (!line.trim()) { flush(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flush(); p(m[2], `Heading${m[1].length}`); }
    else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { flush(); p(m[1], 'ListBullet'); }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flush(); p(m[1], 'ListNumber'); }
    else if ((m = line.match(/^>\s?(.*)$/))) { flush(); p(m[1], 'Quote'); }
    else buf.push(line.trim());
  }
  flush();
  const style = (id, name, extra) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/>${extra}</w:style>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
    + style('Title', 'Title', '<w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:sz w:val="48"/></w:rPr>')
    + [1, 2, 3, 4].map((n) => style(`Heading${n}`, `heading ${n}`, `<w:pPr><w:keepNext/><w:spacing w:before="${360 - n * 60}" w:after="120"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${36 - n * 4}"/></w:rPr>`)).join('')
    + style('ListBullet', 'List Bullet', '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:spacing w:after="60"/></w:pPr>')
    + style('ListNumber', 'List Number', '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:spacing w:after="60"/></w:pPr>')
    + style('Quote', 'Quote', '<w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr>') + '</w:styles>';
  const lvl = (fmt, text) => `<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>`;
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0">${lvl('bullet', '•')}</w:abstractNum><w:abstractNum w:abstractNumId="1">${lvl('decimal', '%1.')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return writeZip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`],
    ['word/document.xml', document],
    ['word/styles.xml', styles],
    ['word/numbering.xml', numbering],
  ]);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'text') {
      if (!a || !existsSync(a)) throw new Error('give a .docx or .pptx file that exists');
      const ext = path.extname(a).toLowerCase();
      if (ext === '.pdf') throw new Error('PDFs: open them directly with the Read tool');
      if (ext === '.doc' || ext === '.ppt') throw new Error('old .doc/.ppt format: ask the person to save it as .docx/.pptx (File > Save As)');
      process.stdout.write((ext === '.pptx' ? pptxText : docxText)(readFileSync(a)) + '\n');
    } else if (cmd === 'changed') {
      // What changed between two saved text versions: only those paragraphs need a fresh review.
      if (!a || !b || !existsSync(a) || !existsSync(b)) throw new Error('usage: office.mjs changed <old.txt> <new.txt>');
      // Compare words only: paragraph labels, heading and list marks and spacing do not count as changes.
      const strip = (l) => l.replace(/^\s*\[(?:P|T)\d+\]\s*|^\s*\[Slide \d+\]\s*/, '').replace(/^(?:#{1,6}\s+|[-*]\s+|\d+[.)]\s+|\(caption\)\s*|>\s*)/, '').replace(/\*\*|\*/g, '').replace(/\s+/g, ' ').trim();
      const oldSet = new Set(readFileSync(a, 'utf8').split(/\r?\n/).map(strip).filter(Boolean));
      const lines = readFileSync(b, 'utf8').split(/\r?\n/).filter((l) => strip(l));
      const changed = lines.filter((l) => !oldSet.has(strip(l)));
      const newSet = new Set(lines.map(strip));
      const removed = [...oldSet].filter((l) => !newSet.has(l)).length;
      console.log(`${changed.length} new or changed paragraph(s) of ${lines.length}; ${removed} removed.`);
      for (const l of changed) console.log(l.length > 160 ? l.slice(0, 160) + '...' : l);
    } else if (cmd === 'docx') {
      if (!a || !b) throw new Error('usage: office.mjs docx <in.md> <out.docx> [--title "Title"]');
      const ti = rest.indexOf('--title');
      writeFileSync(b, markdownToDocx(readFileSync(a, 'utf8'), ti >= 0 ? rest[ti + 1] : ''));
      console.log(`saved ${b}`);
    } else { console.log('Commands: text <file.docx|.pptx>, docx <in.md> <out.docx> [--title "Title"], changed <old.txt> <new.txt>'); process.exitCode = 2; }
  } catch (e) { console.error('office.mjs: ' + (e instanceof Error ? e.message : e)); process.exitCode = 1; }
}
