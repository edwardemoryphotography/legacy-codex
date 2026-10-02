import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import http from 'node:http';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Pass the path to playwright's installed package; it is a QA tool, not a runtime dependency.
const { chromium } = await import(pathToFileURL(resolve(process.argv[2],'index.mjs')).href);
const root = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(await readFile(resolve(root,'evidence.json'),'utf8'));
const artifacts = resolve(root,'verification');
await mkdir(artifacts,{recursive:true});
const checks = [];
const errors = [];
const server = http.createServer(async (req,res) => {
  try {
    const path = resolve(root,`.${decodeURIComponent(new URL(req.url,'http://localhost').pathname)}`);
    if (path !== root && !path.startsWith(root + '/')) {res.writeHead(403).end();return;}
    const file = path === root ? resolve(root,'index.html') : path;
    const mime = {'.html':'text/html','.json':'application/json','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2'}[extname(file)] || 'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime});res.end(await readFile(file));
  } catch {res.writeHead(404).end('Not found');}
});
await new Promise(resolveReady => server.listen(0,'127.0.0.1',resolveReady));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page = await context.newPage();
  page.on('pageerror',error => errors.push(error.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#chapter-title').textContent(),data.milestones.at(-1).title);
  assert.equal(await page.locator('#chapter-rail button').count(),data.milestones.length);
  checks.push('Latest chapter and complete chapter rail rendered from evidence');
  assert.equal(await page.locator('#motion-button').getAttribute('aria-pressed'),'false');
  checks.push('Reduced-motion preference honored on initial load');
  await page.screenshot({path:resolve(artifacts,'desktop.png'),fullPage:true});
  for (let i = 0; i < data.milestones.length; i++) {
    await page.locator('#timeline').fill(String(i));
    assert.equal(await page.locator('#chapter-title').textContent(),data.milestones[i].title);
    assert.equal(await page.locator('#chapter-sources a').count(),data.milestones[i].sources.length);
    const available = new Set(data.milestones.slice(0,i + 1).flatMap(m => m.domains));
    assert.equal(await page.locator('.node.visible').count(),available.size);
  }
  checks.push(`Every chapter (${data.milestones.length}) renders its own sources and excludes future domains`);
  await page.locator('#timeline').fill('0');
  assert.equal(await page.locator('#previous').isDisabled(),true);
  await page.locator('#next').click();
  assert.equal(await page.locator('#timeline').inputValue(),'1');
  await page.locator('#previous').click();
  assert.equal(await page.locator('#timeline').inputValue(),'0');
  checks.push('Previous/next navigation and lower bound');
  await page.locator('#latest').click();
  assert.equal(await page.locator('#next').isDisabled(),true);
  await page.locator('#node-codex').click();
  assert.equal(await page.locator('#inspector').evaluate(d => d.open),true);
  assert.equal(await page.locator('#inspector-title').textContent(),'Legacy Codex');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#inspector').evaluate(d => d.open),false);
  checks.push('Constellation domain opens real historical index; Escape closes it');
  await page.locator('#archive-button').click();
  await page.locator('#archive-search').fill('no-such-record-xyz');
  assert.equal(await page.locator('.no-results').count(),1);
  await page.locator('#archive-search').fill(data.milestones[0].title);
  await page.locator('.archive-item').first().click();
  assert.equal(await page.locator('#chapter-title').textContent(),data.milestones[0].title);
  checks.push('Archive search, honest empty result, and selection navigation');
  await page.locator('#latest').click();
  await page.locator('#play').click();
  assert.equal(await page.locator('#timeline').inputValue(),'0');
  await page.waitForTimeout(6800);
  assert.equal(await page.locator('#timeline').inputValue(),'1');
  await page.locator('#play').click();
  assert.equal(await page.locator('#play').getAttribute('aria-pressed'),'false');
  checks.push('Playback restarts at origin, advances, and pauses');
  await page.goto(`${url}#chapter=${data.milestones[2].id}`);
  assert.equal(await page.locator('#chapter-title').textContent(),data.milestones[2].title);
  await page.locator('h1').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#chapter-title').textContent(),data.milestones[3].title);
  checks.push('Stable deep links and keyboard chapter navigation');
  await page.locator('#about-button').click();
  assert.ok((await page.locator('#inspector-content').textContent()).includes(data.coverage.limits[0]));
  await page.locator('#close-dialog').click();
  checks.push('Coverage limitations and source repositories accessible');
  const architecture = page.locator('#architecture-link');
  if (await architecture.count()) {
    const target = new URL(await architecture.getAttribute('href'),url).href;
    const response = await context.request.get(target);
    assert.equal(response.status(),200);
    assert.ok((await response.text()).includes('<html'));
    checks.push('Archify companion link resolves to an actual HTML artifact');
  }
  for (const width of [390,430,768,1440]) {
    await page.setViewportSize({width,height:width < 500 ? 739 : 1000});
    await page.locator('#latest').click();
    await page.evaluate(() => window.scrollTo(0,0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true,`horizontal overflow at ${width}`);
    if (width === 390) {
      await page.screenshot({path:resolve(artifacts,'mobile.png'),fullPage:true});
      await page.locator('#mobile-domains button').first().click();
      assert.equal(await page.locator('#inspector').evaluate(d => d.open),true);
      await page.locator('#close-dialog').click();
    }
  }
  checks.push('390, 430, 768, 1440px layouts have no horizontal overflow; mobile domain control works');
  await page.goto(pathToFileURL(resolve(root,'index.html')).href,{waitUntil:'load'});
  await page.locator('#previous').click();
  assert.equal(await page.locator('#chapter-title').textContent(),data.milestones.at(-2).title);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /^https?:/.test(r.name)).length),0);
  checks.push('file:// directly opens and navigates with no HTTP resource dependencies');
  assert.deepEqual(errors,[]);
  checks.push('No browser JavaScript errors');
  await writeFile(resolve(artifacts,'verification.json'),JSON.stringify({passed:true,browser:await browser.version(),checks,errors,viewports:[390,430,768,1440],screenshots:['desktop.png','mobile.png'],visualInspection:'pending-human-or-agent-image-review'},null,2) + '\n');
  console.log(JSON.stringify({passed:true,checks,errors},null,2));
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
