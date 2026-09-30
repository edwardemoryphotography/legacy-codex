// Return-to-Action walkthrough in a real, persistent WebKit session at iPhone
// sizes, against the local stack from scripts/local-supabase/start.sh and a
// production build on http://localhost:3000. Every record is created through
// the UI; the database is only read, except one privilege revoke/grant that
// injects a failed actions read. Never point this at a preview or production:
// both write to project pkydkbuodikttfeawqsw.
//
//   npm i --prefix /tmp/pw playwright@1.63.0 && npx --prefix /tmp/pw playwright install --with-deps webkit
//   NODE_PATH=/tmp/pw/node_modules [RECORD_VIDEO=1] node scripts/local-supabase/walkthrough-return-to-action.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

// Playwright is not a repo dependency; NODE_PATH points at a scratch install.
const { webkit, devices } = createRequire(import.meta.url)('playwright')

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const git = (...args) => execFileSync('git', ['-C', REPO, ...args]).toString().trim()
const COMMIT = git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain') ? ' + uncommitted changes' : '')

const ART = process.env.ARTIFACTS_DIR || '/tmp/return-to-action-walkthrough'
const SHOTS = `${ART}/screenshots`
const VIDEO = process.env.RECORD_VIDEO ? { recordVideo: { dir: `${ART}/video`, size: { width: 390, height: 664 } }, slowMo: 350 } : {}
const PROFILE = `${ART}/profile-returning`
const FRESH = `${ART}/profile-first-time`
const URL = 'http://localhost:3000/'
const LOG = `${ART}/walkthrough.log`
fs.rmSync(PROFILE, { recursive: true, force: true })
fs.rmSync(FRESH, { recursive: true, force: true })
fs.mkdirSync(SHOTS, { recursive: true })
fs.writeFileSync(LOG, '')

const log = (...parts) => { const line = parts.join(' '); console.log(line); fs.appendFileSync(LOG, line + '\n') }
const sql = q => execSync(`sudo -u postgres psql -At -F ' | ' -c ${JSON.stringify(q)}`).toString().trim()
const check = (ok, label) => { log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) process.exitCode = 1 }
const iphone = devices['iPhone 13']

async function open(profile, extra = {}) {
  return webkit.launchPersistentContext(profile, {
    ...iphone,
    ...VIDEO,
    ...extra,
  })
}

async function fit(page, buttonName) {
  return page.evaluate(name => {
    const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(name))
    const bar = document.querySelector('.codex-tablist')
    const r = button?.getBoundingClientRect()
    return {
      viewport: `${innerWidth}x${innerHeight}`,
      buttonBottom: r ? Math.round(r.bottom) : null,
      buttonHeight: r ? Math.round(r.height) : null,
      tabBarTop: bar ? Math.round(bar.getBoundingClientRect().top) : null,
      noHorizontalScroll: document.documentElement.scrollWidth === document.documentElement.clientWidth,
    }
  }, buttonName)
}

async function contrast(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const px = (...fills) => { ctx.clearRect(0, 0, 1, 1); for (const f of fills) { ctx.fillStyle = f; ctx.fillRect(0, 0, 1, 1) } return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3) }
    const lum = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100 }
    const card = document.querySelector('.resume-card')
    const bg = px(getComputedStyle(document.body).backgroundColor, getComputedStyle(card).backgroundColor)
    const out = {}
    for (const sel of ['.resume-title', '.resume-meta', '.resume-meta-label', '.resume-note blockquote', '.resume-note figcaption', '.commitment-kicker', '.resume-go button']) {
      const el = card.querySelector(sel); if (!el) continue
      out[sel] = ratio(px(getComputedStyle(el).color), bg)
    }
    return out
  })
}

;(async () => {
  log(`Return-to-Action walkthrough — ${new Date().toISOString()}`)
  log(`Commit under test: ${COMMIT} (${REPO}) · app http://localhost:3000 (next start) · data: local Supabase stack`)

  // ── First-time visitor ────────────────────────────────────────────────
  let ctx = await open(FRESH)
  let page = ctx.pages()[0] ?? await ctx.newPage()
  await page.goto(URL)
  await page.getByLabel('Your idea or project').waitFor()
  check(await page.getByText('Where you left off').count() === 0, 'first-time: idea capture shown, no resume card')
  check(await page.getByRole('region', { name: 'Strategic Delta' }).isVisible(), 'first-time: Strategic Delta shown')
  await page.screenshot({ path: `${SHOTS}/01-first-time-iphone-390.png` })
  await ctx.close()

  // ── Returning person: create a real mission and save exactly one action ─
  ctx = await open(PROFILE)
  page = ctx.pages()[0] ?? await ctx.newPage()
  await page.goto(URL)
  await page.getByLabel('Your idea or project').fill('Publish the studio lighting reference')
  await page.getByLabel('How you will know it is done').fill('The lighting reference page is live and linked from the studio handbook')
  await page.getByRole('button', { name: 'This is what matters' }).click()
  await page.getByRole('region', { name: 'Strategic Delta' }).getByRole('button').first().waitFor()
  const userId = sql(`select user_id from missions order by created_at desc limit 1`)
  const missionId = sql(`select id from missions where user_id = '${userId}' and state = 'primary'`)
  log(`session user ${userId} · Primary mission ${missionId}`)

  const accept = page.getByRole('button', { name: 'Accept this move' })
  if (await accept.count()) {
    await accept.click()
    await page.getByText(/still a prediction until there's evidence/).waitFor()
    check(sql(`select count(*) from actions where mission_id = '${missionId}'`) === '0', 'accepting a recommendation records intent only — no action row')
  }
  const composer = page.locator('#saved-action-title')
  await composer.fill('Draft the key-light section of the lighting reference')
  await page.getByRole('button', { name: 'Save next action' }).click()

  // ── After save: the commitment moves to the front door, no reload ────
  const savedCard = page.getByRole('region', { name: 'Draft the key-light section of the lighting reference' })
  await savedCard.waitFor()
  const actionId = sql(`select id from actions where mission_id = '${missionId}'`)
  check(sql(`select count(*) from actions where mission_id = '${missionId}'`) === '1', `exactly one mission-linked action saved (${actionId})`)
  check((await savedCard.textContent()).includes('Saved — it will be here when you return'), 'after save: the front-door card shows it at once, without a reload')
  check(await page.locator('#saved-action-title').count() === 0 && await page.locator('#saved-action').count() === 0, 'after save: the lower panel hands off (no second card or composer)')
  await page.waitForTimeout(900)
  const handoff = await page.evaluate(() => {
    const r = document.getElementById('resume-action').getBoundingClientRect()
    const bar = document.querySelector('.codex-tablist').getBoundingClientRect().top
    const resume = [...document.querySelectorAll('#resume-action button')].find(b => b.textContent.trim() === 'Resume').getBoundingClientRect()
    return { cardTop: Math.round(r.top), resumeBottom: Math.round(resume.bottom), tabBarTop: Math.round(bar), focused: document.activeElement?.id }
  })
  log(`after-save handoff @ 390x664: ${JSON.stringify(handoff)}`)
  check(handoff.cardTop >= 0 && handoff.resumeBottom < handoff.tabBarTop, 'after save: the card and its Resume are scrolled into view above the tab bar')
  check(handoff.focused === 'resume-action-title', 'after save: focus moves to the saved action heading')
  await page.screenshot({ path: `${SHOTS}/00-after-save-handoff-iphone-390.png` })

  await page.getByRole('button', { name: 'Resume: Draft the key-light section of the lighting reference' }).click()
  await page.getByRole('button', { name: 'Save & pause' }).waitFor()
  check(sql(`select status from actions where id = '${actionId}'`) === 'IN_PROGRESS', 'action started from the card (same row, IN_PROGRESS)')
  check(sql(`select count(*) from actions where mission_id = '${missionId}'`) === '1', 'starting created nothing')
  const firstNote = 'Stopped after the softbox diagram. Next: write the fill-light paragraph and caption the bounce-card photo.'
  await page.getByLabel('Starting point').fill(firstNote)
  await page.getByRole('button', { name: 'Save & pause' }).click()
  await page.getByRole('button', { name: /^Resume/ }).waitFor()
  log(`after pause: ${sql(`select id, status, resume_note from actions where id = '${actionId}'`)}`)
  check(sql(`select status from actions where id = '${actionId}'`) === 'TODO', 'paused (TODO) with the note saved')
  const acceptedBefore = sql(`select count(*) from mission_events where mission_id = '${missionId}' and type = 'delta_accepted'`)

  // ── Reload ────────────────────────────────────────────────────────────
  await page.reload()
  const card = page.getByRole('region', { name: 'Draft the key-light section of the lighting reference' })
  await card.waitFor()
  const cardText = await card.innerText()
  check(cardText.includes(firstNote), 'after reload: same note on the resume card')
  check(cardText.includes('Publish the studio lighting reference'), 'after reload: associated mission shown')
  check(cardText.includes('Paused'), 'after reload: status shown as Paused')
  const resume = page.getByRole('button', { name: 'Resume: Draft the key-light section of the lighting reference' })
  check(await resume.isVisible(), 'after reload: Resume button present')
  check(await page.getByText('Draft the key-light section of the lighting reference', { exact: true }).count() === 1, 'one card for the one action (no duplicate controls)')
  check(await page.locator('#saved-action-title').count() === 0, 'no "save a new action" composer while one is unfinished')
  const phone = await fit(page, 'Resume')
  log(`fit @ iPhone 13 WebKit: ${JSON.stringify(phone)}`)
  check(phone.buttonBottom < phone.tabBarTop, 'Resume is on the first screen, above the tab bar, without scrolling')
  check(phone.noHorizontalScroll, 'no horizontal scroll at 390px')
  check(phone.buttonHeight >= 44, `Resume touch target ${phone.buttonHeight}px ≥ 44px`)
  await page.screenshot({ path: `${SHOTS}/02-returning-iphone-390-dark.png` })
  log(`contrast (dark): ${JSON.stringify(await contrast(page))}`)
  log('aria snapshot of the resume card:\n' + await card.ariaSnapshot())

  // ── Leave (another tab) and come back ─────────────────────────────────
  await page.getByRole('tab', { name: 'Codex' }).click()
  await page.waitForTimeout(600)
  check(await page.getByText('Where you left off').count() === 0, 'left Mission for Codex')
  await page.getByRole('tab', { name: 'Mission' }).click()
  await card.waitFor()
  check((await card.innerText()).includes(firstNote), 'back on Mission: same action and note')
  await ctx.close()

  // ── Close the browser entirely and return ─────────────────────────────
  ctx = await open(PROFILE)
  page = ctx.pages()[0] ?? await ctx.newPage()
  await page.goto(URL)
  await card.waitFor().catch(() => {})
  const returned = page.getByRole('region', { name: 'Draft the key-light section of the lighting reference' })
  await returned.waitFor()
  check(sql(`select user_id from missions where id = '${missionId}'`) === userId, 'returned with the same anonymous identity (no replacement account)')
  check((await returned.innerText()).includes(firstNote), 'after closing and reopening: same action and note')
  await page.screenshot({ path: `${SHOTS}/03-return-after-close-iphone-390.png` })

  // ── Resume the same action ────────────────────────────────────────────
  const before = sql(`select updated_at from actions where id = '${actionId}'`)
  await page.getByRole('button', { name: 'Resume: Draft the key-light section of the lighting reference' }).click()
  await page.getByRole('button', { name: 'Save & pause' }).waitFor()
  const focused = await page.evaluate(() => document.activeElement?.id)
  check(focused === 'resume-action-title', `focus moved to the action heading (${focused})`)
  await page.keyboard.press('Tab')
  const nextFocus = await page.evaluate(() => document.activeElement?.id)
  check(nextFocus === `resume-${actionId}`, `Tab from the heading reaches the note field (${nextFocus})`)
  check(await page.getByLabel('Starting point').inputValue() === firstNote, 'resumed view holds the saved note')
  log(`after resume: ${sql(`select id, status, updated_at from actions where mission_id = '${missionId}'`)}`)
  check(sql(`select count(*) from actions where mission_id = '${missionId}'`) === '1', 'still exactly one action — Resume created nothing')
  check(sql(`select id from actions where mission_id = '${missionId}'`) === actionId, 'same action id and mission after Resume')
  check(sql(`select status from actions where id = '${actionId}'`) === 'IN_PROGRESS', 'Resume set the same row IN_PROGRESS')
  check(sql(`select updated_at from actions where id = '${actionId}'`) !== before, 'row updated in place (updated_at advanced)')
  check(sql(`select count(*) from mission_events where mission_id = '${missionId}' and type = 'delta_accepted'`) === acceptedBefore, 'Resume wrote no acceptance')
  const buttons = await page.locator('#resume-action button').evaluateAll(els => els.map(e => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]))
  log(`resumed controls (label, height px): ${JSON.stringify(buttons)}`)
  check(buttons.every(([, h]) => h >= 44), 'every resumed control is ≥ 44px tall')
  await page.screenshot({ path: `${SHOTS}/04-resumed-iphone-390.png` })

  // ── Update the note, pause, reload ────────────────────────────────────
  const secondNote = 'Fill-light paragraph drafted. Next: caption the bounce-card photo, then link the page from the handbook.'
  await page.getByLabel('Starting point').fill(secondNote)
  await page.getByRole('button', { name: 'Save note' }).click()
  await page.waitForFunction(n => [...document.querySelectorAll('textarea')].some(t => t.value === n), secondNote)
  await page.getByRole('button', { name: 'Save & pause' }).click()
  await page.getByRole('button', { name: /^Resume/ }).waitFor()
  check((await page.locator('#resume-action').innerText()).includes(secondNote), 'paused: summary shows the updated note')
  await page.reload()
  await page.getByRole('button', { name: /^Resume/ }).waitFor()
  check((await page.locator('#resume-action').innerText()).includes(secondNote), 'after reload: updated note persisted')
  log(`final row: ${sql(`select id, mission_id, status, resume_note from actions where mission_id = '${missionId}'`)}`)
  check(sql(`select count(*) from actions where mission_id = '${missionId}'`) === '1' && sql(`select id from actions where mission_id = '${missionId}'`) === actionId, 'identity preserved through update → pause → reload')
  await page.screenshot({ path: `${SHOTS}/05-returning-updated-note-iphone-390.png` })

  // ── Light theme (review-only) contrast at phone width ─────────────────
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/06-returning-iphone-390-light.png` })
  log(`contrast (light): ${JSON.stringify(await contrast(page))}`)
  await ctx.close()

  // ── Larger phone and reduced motion ───────────────────────────────────
  ctx = await open(PROFILE, { viewport: { width: 430, height: 739 }, reducedMotion: 'reduce' })
  page = ctx.pages()[0] ?? await ctx.newPage()
  await page.goto(URL)
  await page.getByRole('button', { name: /^Resume/ }).waitFor()
  const big = await fit(page, 'Resume')
  log(`fit @ 430x739 WebKit: ${JSON.stringify(big)}`)
  check(big.buttonBottom < big.tabBarTop && big.noHorizontalScroll, 'Resume on the first screen at 430×739, no horizontal scroll')
  await page.screenshot({ path: `${SHOTS}/07-returning-iphone-430.png` })
  await page.getByRole('button', { name: /^Resume/ }).click()
  await page.locator('.resume-work').waitFor()
  const anim = await page.locator('.resume-work').evaluate(el => getComputedStyle(el).animationName)
  check(anim === 'none', `reduced motion: no reveal animation (animation-name: ${anim})`)
  await page.getByRole('button', { name: 'Save & pause' }).click()
  await page.getByRole('button', { name: /^Resume/ }).waitFor()

  // ── Failed read (actions only), then recovery ─────────────────────────
  sql('revoke select on table actions from authenticated')
  await page.reload()
  await page.getByText(/Could not read your saved actions/).waitFor()
  check(await page.getByRole('button', { name: /^Resume/ }).count() === 0, 'failed read: no resume card claimed')
  check(await page.locator('#saved-action-title').count() === 0, 'failed read: not presented as an empty account (no composer)')
  check(await page.getByRole('button', { name: 'Read saved actions again' }).isVisible(), 'failed read: recovery control shown')
  await page.screenshot({ path: `${SHOTS}/08-failed-read-iphone-430.png` })
  sql('grant select on table actions to authenticated')
  await page.getByRole('button', { name: 'Read saved actions again' }).click()
  await page.getByRole('button', { name: /^Resume/ }).waitFor()
  check((await page.locator('#resume-action').innerText()).includes(secondNote), 'recovered: same action and note after retry')
  await ctx.close()

  // ── Strategic Delta below the commitment ──────────────────────────────
  ctx = await open(PROFILE)
  page = ctx.pages()[0] ?? await ctx.newPage()
  await page.goto(URL)
  await page.getByRole('button', { name: /^Resume/ }).waitFor()
  const row = () => sql(`select id, status, resume_note, updated_at from actions where mission_id = '${missionId}'`)
  const rowBefore = row()
  const acceptedCount = () => sql(`select count(*) from mission_events where mission_id = '${missionId}' and type = 'delta_accepted'`)
  const acceptedAtStart = acceptedCount()

  const delta = page.getByRole('region', { name: 'Strategic Delta' })
  const reconsider = await delta.getByText('Reconsider your next move').waitFor({ timeout: 5000 }).then(() => true, () => false)
  check(reconsider, 'Delta below the saved action reads "Reconsider your next move"')
  await page.locator('section.sd[aria-label="Strategic Delta"][aria-busy="false"]').waitFor()
  const nameStep = delta.getByRole('button', { name: 'Name the concrete step' })
  await nameStep.click()
  if (!await page.locator('#sd-correction').waitFor({ timeout: 4000 }).then(() => true, () => false)) {
    log('note: the step panel did not open on the first click; clicked again')
    await nameStep.click()
  }
  await page.locator('#sd-correction').fill('Write the key-light paragraph in the reference draft')
  await page.getByRole('button', { name: 'Record this step' }).click()
  const acceptMove = delta.getByRole('button', { name: 'Accept this move' })
  await acceptMove.waitFor()
  await acceptMove.scrollIntoViewIfNeeded()
  const styles = await page.evaluate(() => {
    const border = name => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith(name)); return b && getComputedStyle(b).borderTopColor }
    return { resume: border('Resume'), accept: border('Accept this move') }
  })
  log(`button borders: ${JSON.stringify(styles)}`)
  check(styles.resume !== styles.accept, 'Accept is the secondary style; Resume stays the one teal primary')
  check((await delta.innerText()).includes('does not replace your saved action'), 'Accept copy says it does not replace the saved action')
  await page.screenshot({ path: `${SHOTS}/09-delta-below-commitment-iphone-390.png` })

  await acceptMove.click()
  await delta.getByText('Your saved action is unchanged').waitFor()
  check(await delta.getByText('Save it as one action you can return to').count() === 0, 'no "save it as an action" link while one is unfinished')
  check(acceptedCount() === String(Number(acceptedAtStart) + 1), 'accepting wrote one delta_accepted row')
  check(row() === rowBefore, 'the saved action row is byte-for-byte unchanged by accepting')
  check(sql(`select count(*) from actions where mission_id = '${missionId}'`) === '1', 'still exactly one action')
  await page.screenshot({ path: `${SHOTS}/10-delta-accepted-commitment-unchanged-iphone-390.png` })

  await page.reload()
  await page.getByRole('button', { name: /^Resume/ }).waitFor()
  check((await page.locator('#resume-action').innerText()).includes(rowBefore.split(' | ')[2]), 'after reload the resume card still leads with the same note')
  await ctx.close()

  log(`actions rows for this user: ${sql(`select count(*) from actions a join missions m on m.id = a.mission_id where m.user_id = '${userId}'`)}`)
  log(`mission_events for this mission: ${sql(`select string_agg(type, ', ' order by created_at) from mission_events where mission_id = '${missionId}'`)}`)
  log(process.exitCode ? 'WALKTHROUGH FAILED' : 'WALKTHROUGH PASSED')
})().catch(error => { log('ERROR', error.stack || String(error)); sql('grant select on table actions to authenticated'); process.exit(1) })
