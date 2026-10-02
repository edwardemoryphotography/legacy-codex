import { readFile, writeFile, access } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = name => readFile(resolve(root,name),'utf8');
const data = JSON.parse(await read('evidence.json'));
const allowedDomains = new Set(['codex','foundry','control','doctrine','agents','evidence','neuro','artful','missions','reasoning']);
const ids = new Set();
if (!data.milestones?.length || !data.coverage?.limits || !data.repositories?.length) throw new Error('Missing evidence or coverage');
let previous = '';
for (const m of data.milestones) {
  if (!m.id || ids.has(m.id)) throw new Error(`Missing or duplicated milestone id: ${m.id}`);
  ids.add(m.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date) || Number.isNaN(Date.parse(m.date)) || m.date < previous) throw new Error(`Unordered/invalid date: ${m.id}`);
  previous = m.date;
  if (!['documented','implemented','branch'].includes(m.kind)) throw new Error(`Invalid evidence class: ${m.id}`);
  for (const field of ['era','title','summary','meaning']) if (typeof m[field] !== 'string' || !m[field].trim()) throw new Error(`Missing ${field}: ${m.id}`);
  if (!m.sources?.length || !m.domains?.length) throw new Error(`Unsupported chapter: ${m.id}`);
  for (const d of m.domains) if (!allowedDomains.has(d)) throw new Error(`Unknown domain: ${d}`);
  for (const source of m.sources) {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || !source.label) throw new Error(`Unsafe or missing source: ${m.id}`);
  }
}
let styles = await read('style.css');
for (const font of ['instrument-serif','instrument-sans']) {
  const bytes = await readFile(resolve(root,`assets/${font}.woff2`));
  styles = styles.replace(`url(assets/${font}.woff2)`,`url(data:font/woff2;base64,${bytes.toString('base64')})`);
}
const architecture = process.argv[2] || '';
if (architecture) {
  const path = resolve(root,architecture);
  if (relative(root,path).startsWith('..') || !path.endsWith('.html')) throw new Error('Architecture must be an HTML file inside the artifact folder');
  await access(path);
}
let html = await read('index.template.html');
if (!architecture) html = html.replace(/<a id="architecture-link"[\s\S]*?<\/a>/,'');
else html = html.replace('__ARCHITECTURE_PATH__',architecture.replaceAll('&','&amp;').replaceAll('"','&quot;'));
const replacements = {
  '/*__STYLES__*/':styles,
  '/*__EVIDENCE__*/':JSON.stringify(data).replaceAll('<','\\u003c'),
  '/*__MODEL__*/':(await read('model.mjs')).replace(/^export /gm,''),
  '/*__APP__*/':await read('app.js'),
};
for (const [placeholder,content] of Object.entries(replacements)) html = html.replace(placeholder,() => content);
if (/\/\*__[A-Z]+__\*\//.test(html)) throw new Error('Unresolved build placeholder');
await writeFile(resolve(root,'index.html'),html);
const manifest = {
  title:'Legacy Codex — The Origin Atlas',
  asOf:data.asOf,
  chapters:data.milestones.length,
  repositories:data.repositories.length,
  firstChapter:data.milestones[0].date,
  lastChapter:data.milestones.at(-1).date,
  domains:[...new Set(data.milestones.flatMap(m => m.domains))],
  sourceReferences:data.milestones.reduce((count,m) => count + m.sources.length,0),
  uniqueSourceUrls:new Set(data.milestones.flatMap(m => m.sources.map(s => s.url))).size,
  architecture:architecture || null,
  htmlBytes:Buffer.byteLength(html),
  offline:true,
};
await writeFile(resolve(root,'build-manifest.json'),JSON.stringify(manifest,null,2) + '\n');
console.log(JSON.stringify(manifest,null,2));
