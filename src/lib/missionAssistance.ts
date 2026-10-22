// Input contracts are shared with the server; no model or account data here.
export function assistanceQuestion(title: string): string {
  return /paper|essay|research/i.test(title)
    ? 'What is the assignment or topic, and what have you written so far?'
    : 'What do you have so far, and what would you like help with next?'
}

export function parseAssistanceNote(body: { contextNote?: unknown; requestId?: unknown }): { note: string; requestId: string } | null | undefined {
  if (body.contextNote === undefined && body.requestId === undefined) return undefined
  if (typeof body.contextNote !== 'string' || !body.contextNote.trim() || body.contextNote.length > 6_000 ||
      typeof body.requestId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(body.requestId)) return null
  return { note: body.contextNote.trim(), requestId: body.requestId }
}

export function draftStartingPoint(
  review: { workDraft?: string | null; finishWhen?: string | null; source?: 'model' | 'supplied' } | null,
): string | null {
  if (!review?.workDraft) return null
  const header = review.source === 'supplied'
    ? 'Structured from your project notes — check before using.'
    : 'Model-generated draft — check before using.'
  return `${header}\n\n${review.workDraft}${review.finishWhen ? `\n\nNext step finishes when: ${review.finishWhen}` : ''}`
}

export interface DeterministicAssistance {
  step: string
  finishWhen: string
  why: string
  workDraft: string
  constraintCheck: ConstraintCheck
}

/**
 * Stored with the delta_assistance_generated event. `declared` lists units the
 * person stated; `compared` lists only units the generated plan budgeted and
 * that were actually checked against them. A declared unit absent from
 * `compared` was not validated, because the plan made no claim about it.
 */
export interface ConstraintCheck {
  source: 'deterministic_quantity_guard'
  declared: string[]
  compared: string[]
  conflicts: QuantityConflict[]
  /** Set when a contradicting budget was removed; `notice` is shown to the person. */
  correction: { action: 'removed_budget'; notice: string } | null
}

/**
 * Units a person can declare in a finish line or note. The constraint check is
 * unit-generic: any unit listed here that appears both as a declared target
 * and as a "~N unit" budget in a plan is compared. Today the template only
 * budgets pages; a new budgeted unit needs a row here, not a new check.
 */
const QUANTITY_UNITS: Record<string, RegExp> = {
  pages: /pages?/,
  words: /words?/,
  slides: /slides?/,
  minutes: /min(?:ute)?s?/,
  hours: /h(?:ou)?rs?/,
}

export interface DeclaredQuantity { unit: string; min: number; max: number }
export interface QuantityConflict { unit: string; declared: string; planned: number }

/** First declared amount per unit, e.g. "3 pages" or "3-5 pages". Earlier text wins. */
export function declaredQuantities(...texts: string[]): DeclaredQuantity[] {
  const found = new Map<string, DeclaredQuantity>()
  for (const text of texts) {
    for (const [unit, pattern] of Object.entries(QUANTITY_UNITS)) {
      if (found.has(unit)) continue
      const match = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:(?:-|–|to)\\s*(\\d+(?:\\.\\d+)?)\\s*)?(?:${pattern.source})\\b`, 'i').exec(text)
      if (!match) continue
      const min = Number(match[1])
      const max = match[2] ? Number(match[2]) : min
      found.set(unit, { unit, min: Math.min(min, max), max: Math.max(min, max) })
    }
  }
  return [...found.values()]
}

/** Sums every "~N unit" budget in a plan per unit (N may be "½" or "1½"). */
export function plannedQuantities(draft: string): Map<string, number> {
  const totals = new Map<string, number>()
  const budget = /~\s*(\d+(?:\.\d+)?)?\s*(½)?\s*([a-z]+)/gi
  for (const match of draft.matchAll(budget)) {
    if (!match[1] && !match[2]) continue
    const amount = (match[1] ? Number(match[1]) : 0) + (match[2] ? 0.5 : 0)
    const unit = Object.entries(QUANTITY_UNITS).find(([, pattern]) => new RegExp(`^(?:${pattern.source})$`, 'i').test(match[3]))?.[0]
    if (unit) totals.set(unit, (totals.get(unit) ?? 0) + amount)
  }
  return totals
}

/** Every unit where the plan's total disagrees with what the person declared. */
export function quantityConflicts(draft: string, declared: DeclaredQuantity[]): QuantityConflict[] {
  const planned = plannedQuantities(draft)
  const conflicts: QuantityConflict[] = []
  for (const target of declared) {
    const total = planned.get(target.unit)
    if (total === undefined) continue
    if (total < target.min - 1e-9 || total > target.max + 1e-9) {
      conflicts.push({ unit: target.unit, declared: target.min === target.max ? `${target.min}` : `${target.min}-${target.max}`, planned: total })
    }
  }
  return conflicts
}

/** Splits a page total into half-page budgets that add up exactly to the total. */
export function splitPages(total: number, weights: number[]): number[] {
  const halves = Math.round(total * 2)
  const sum = weights.reduce((a, b) => a + b, 0)
  const raw = weights.map(w => (w / sum) * halves)
  const parts = raw.map(r => Math.max(1, Math.floor(r)))
  let remaining = halves - parts.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || b.i - a.i)
  for (let k = 0; remaining > 0; k = (k + 1) % order.length, remaining--) parts[order[k].i] += 1
  for (let i = parts.length - 1; remaining < 0 && i >= 0; i--) {
    while (remaining < 0 && parts[i] > 1) { parts[i] -= 1; remaining++ }
  }
  return parts.map(p => p / 2)
}

function pageLabel(pages: number): string {
  const whole = Math.floor(pages)
  const text = `${whole > 0 ? whole : ''}${pages % 1 ? '½' : ''}`
  return `~${text} page${pages > 1 ? 's' : ''}`
}

/**
 * Pulls a stated deadline ("due in 3 days", "deadline Friday") out of a
 * priority-challenge detail. The detail ends with a generated
 * " — displaced <title> to <state>" suffix (missionLoop.applyPriorityChallenge);
 * that suffix names another project, so only the person's own words are read.
 */
export function extractDeadline(text: string): string | null {
  const suffix = text.lastIndexOf(' — displaced ')
  const ownWords = suffix >= 0 ? text.slice(0, suffix) : text
  const match = /\b((?:due|deadline)\b[^—\n.;]*)/i.exec(ownWords)
  return match ? match[1].trim() : null
}

function deadlineLine(deadline?: { text: string; saidAt: string } | null): string[] {
  if (!deadline) return []
  const said = new Date(deadline.saidAt)
  const when = Number.isNaN(said.getTime()) ? '' : ` (you said this on ${said.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
  return [`- **Deadline you mentioned:** ${deadline.text}${when}`]
}

function amountText(amount: number): string {
  return Number.isInteger(amount) ? `${amount}` : `${Math.floor(amount) || ''}½`
}

/**
 * Verifies a finished draft against the person's declared numbers. A plan
 * whose budgets disagree is never shown as-is: the caller's unbudgeted plan
 * replaces it, a correction notice telling the person what was removed and
 * why is placed at the top of the draft, and the conflict is returned for the
 * event record.
 */
export function applyQuantityGuard(
  generatedBudget: string,
  draft: string,
  unbudgeted: () => string,
  declared: DeclaredQuantity[],
): { workDraft: string; constraintCheck: ConstraintCheck } {
  // Only the generated budget labels are checked: the draft also echoes the
  // person's own finish line and note, which may contain "~N unit" text.
  const planned = plannedQuantities(generatedBudget)
  const conflicts = quantityConflicts(generatedBudget, declared)
  const base = {
    source: 'deterministic_quantity_guard' as const,
    declared: declared.map(q => q.unit),
    compared: declared.filter(q => planned.has(q.unit)).map(q => q.unit),
    conflicts,
  }
  if (conflicts.length === 0) return { workDraft: draft, constraintCheck: { ...base, correction: null } }
  const reasons = conflicts.map(c => `it added up to ${amountText(c.planned)} ${c.unit} but you said ${c.declared} ${c.unit}`)
  const notice = `**Correction:** I removed the section budget because ${reasons.join(', and ')}. The sections below have no length targets — split your ${conflicts.map(c => `${c.declared} ${c.unit}`).join(' and ')} across them yourself.`
  return {
    workDraft: `${notice}\n\n${unbudgeted()}`,
    constraintCheck: { ...base, correction: { action: 'removed_budget', notice } },
  }
}

function summarizeNote(note: string, maxLen = 72): string {
  const singleLine = note.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= maxLen) return singleLine
  return `${singleLine.slice(0, maxLen - 1).trimEnd()}…`
}

/**
 * Builds an honest, deterministic starting step and working outline strictly
 * from the user's own mission title, finish line, and supplied note when
 * model-assisted review is unavailable or restricted. Never invents topics,
 * rubrics, deadlines, or citations.
 */
export function buildDeterministicAssistance(input: {
  title: string
  finishLine: string
  contextNote: string
  priorNotes?: string[]
  /** A deadline the person stated elsewhere (e.g. when changing priority). */
  deadline?: { text: string; saidAt: string } | null
}): DeterministicAssistance {
  const title = input.title.trim()
  const finishLine = input.finishLine.trim()
  const note = input.contextNote.trim()
  const shortNote = summarizeNote(note)
  const combined = `${title} ${finishLine} ${note}`
  const isWritingOrResearch = /paper|essay|research|thesis|article|report|literature|outline|draft|study|psych/i.test(combined)
  const needsTopicSelection = /no topic|haven'?t picked|need a topic|choose a topic|not sure what topic|pick a topic|undecided/i.test(note)
  const declared = declaredQuantities(finishLine, note)
  const pageTarget = declared.find(q => q.unit === 'pages')
  const pageCount = pageTarget ? pageTarget.max : null
  const deadline = deadlineLine(input.deadline)

  if (isWritingOrResearch && needsTopicSelection) {
    const step = `Write down 2–3 candidate research questions from your note (${shortNote}) and lock one working thesis for “${title}”.`
    const finishWhen = `One bounded research question and a one-sentence working thesis are chosen toward “${finishLine}”.`
    const why = `Structured directly from your note (“${shortNote}”) — narrowing one research question first gives every section of “${title}” a clear target.`
    const head = [
      `## Topic & Thesis Narrowing — ${title}`,
      `- **Stated finish line:** ${finishLine}`,
      `- **Your note:** ${note}`,
      ...deadline,
      '',
      '### 1. Candidate angles from your assignment note',
      '- **Option A:** *(Name one specific phenomenon, population, or question from your prompt)*',
      '- **Option B:** *(Name a second angle that has accessible course readings or studies)*',
      '',
      '### 2. Lock your working thesis',
      '- **Research question:** ',
      '- **One-sentence working claim:** ',
    ]
    const budget = pageCount && pageCount >= 2 ? splitPages(pageCount, [0.15, 0.35, 0.35, 0.15]) : null
    const budgetLines = budget
      ? [
          `- **Introduction & thesis (${pageLabel(budget[0])}):** Frame the question and state the core claim.`,
          `- **Background & key findings (${pageLabel(budget[1])}):** Summarize the main concepts from your course/assignment materials.`,
          `- **Analysis & discussion (${pageLabel(budget[2])}):** Compare evidence, limitations, and implications.`,
          `- **Conclusion (${pageLabel(budget[3])}):** Synthesize how the evidence answers your research question.`,
        ]
      : []
    const draft = [
      ...head,
      ...(budget
        ? [
            '',
            `### 3. Section budget toward your ${pageTarget!.min === pageTarget!.max ? pageCount : `${pageTarget!.min}-${pageTarget!.max}`}-page target (${finishLine})`,
            ...budgetLines,
          ]
        : []),
    ].join('\n')
    return { step, finishWhen, why, ...applyQuantityGuard(budget ? budget.map(pageLabel).join(' ') : '', draft, () => head.join('\n'), declared) }
  }

  if (isWritingOrResearch) {
    const step = `Draft the working thesis and section-by-section outline for “${title}” using your note: ${shortNote}`
    const finishWhen = `Each section of the outline has a heading, a one-sentence claim, and a target length toward “${finishLine}”.`
    const why = `Structured directly from what you shared (“${shortNote}”) so you can build toward “${finishLine}” one section at a time without guessing.`
    const unbudgetedPlan = [
      `1. **Opening & Working Thesis** — State the central question or claim from your note (*${shortNote}*).`,
      `2. **Key Points & Supporting Material** — List the 2–3 main sections needed to satisfy your assignment instructions.`,
      `3. **Synthesis & Closing** — Connect the sections back to your finish line (*${finishLine}*).`,
    ]
    const budget = pageCount && pageCount >= 2 ? splitPages(pageCount, [0.2, 0.2, 0.4, 0.2]) : null
    const budgetedPlan = budget
      ? [
          `1. **Introduction & Working Thesis (${pageLabel(budget[0])})** — State the focus from your note (*${shortNote}*) and the central question you are answering.`,
          `2. **Background & Context (${pageLabel(budget[1])})** — Define the key terms and scope from your assignment instructions.`,
          `3. **Core Analysis / Evidence Sections (${pageLabel(budget[2])})** — Break your argument into 2–3 sub-sections, one main point per section.`,
          `4. **Discussion, Limitations & Conclusion (${pageLabel(budget[3])})** — Tie the sections back to your thesis and check against your finish line (*${finishLine}*).`,
        ]
      : unbudgetedPlan
    const outline = (plan: string[]) => [
      `## Working Outline — ${title}`,
      `- **Finish condition:** ${finishLine}`,
      `- **From your note:** ${note}`,
      ...deadline,
      ...(input.priorNotes && input.priorNotes.length > 0
        ? [`- **Earlier notes on record:** ${input.priorNotes.length}`]
        : []),
      '',
      '### Section Plan',
      ...plan,
      '',
      '### Immediate 20-Minute Slice',
      '- [ ] Write the one-sentence working thesis at the top of your document.',
      '- [ ] Paste the section headings above into your draft and add one bullet under each from your own course notes.',
    ].join('\n')
    return { step, finishWhen, why, ...applyQuantityGuard(budget ? budget.map(pageLabel).join(' ') : '', outline(budgetedPlan), () => outline(unbudgetedPlan), declared) }
  }

  const step = `Outline the first concrete work block for “${title}” based on your note: ${shortNote}`
  const finishWhen = `The first work block from your note is drafted and checked against “${finishLine}”.`
  const why = `Structured directly from the project context you shared (“${shortNote}”) to turn “${finishLine}” into an immediate starting step.`
  const workDraft = [
    `## Starting Plan — ${title}`,
    `- **Finish condition:** ${finishLine}`,
    `- **From your note:** ${note}`,
    ...deadline,
    '',
    '### Next Steps from Your Context',
    `1. **Define the first slice:** Use your note (*${shortNote}*) to list the 2–3 concrete parts required for *${finishLine}*.`,
    `2. **Draft the opening part:** Complete the first part before expanding the rest.`,
    `3. **Check against finish line:** Verify what remains to reach *${finishLine}*.`,
  ].join('\n')
  return { step, finishWhen, why, ...applyQuantityGuard('', workDraft, () => workDraft, declared) }
}

