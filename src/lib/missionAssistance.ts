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
}): DeterministicAssistance {
  const title = input.title.trim()
  const finishLine = input.finishLine.trim()
  const note = input.contextNote.trim()
  const shortNote = summarizeNote(note)
  const combined = `${title} ${finishLine} ${note}`
  const isWritingOrResearch = /paper|essay|research|thesis|article|report|literature|outline|draft|study|psych/i.test(combined)
  const needsTopicSelection = /no topic|haven'?t picked|need a topic|choose a topic|not sure what topic|pick a topic|undecided/i.test(note)
  const pageMatch = /(\d+)\s*(?:-\s*\d+\s*)?pages?\b/i.exec(`${finishLine} ${note}`)
  const pageCount = pageMatch ? Number.parseInt(pageMatch[1], 10) : null

  if (isWritingOrResearch && needsTopicSelection) {
    const step = `Write down 2–3 candidate research questions from your note (${shortNote}) and lock one working thesis for “${title}”.`
    const finishWhen = `One bounded research question and a one-sentence working thesis are chosen toward “${finishLine}”.`
    const why = `Structured directly from your note (“${shortNote}”) — narrowing one research question first gives every section of “${title}” a clear target.`
    const workDraft = [
      `## Topic & Thesis Narrowing — ${title}`,
      `- **Stated finish line:** ${finishLine}`,
      `- **Your note:** ${note}`,
      '',
      '### 1. Candidate angles from your assignment note',
      '- **Option A:** *(Name one specific phenomenon, population, or question from your prompt)*',
      '- **Option B:** *(Name a second angle that has accessible course readings or studies)*',
      '',
      '### 2. Lock your working thesis',
      '- **Research question:** ',
      '- **One-sentence working claim:** ',
      ...(pageCount && pageCount > 1
        ? [
            '',
            `### 3. Section budget toward your ${pageCount}-page target (${finishLine})`,
            `- **Introduction & thesis (~1 page):** Frame the question and state the core claim.`,
            `- **Background & key findings (~${Math.max(1, Math.round(pageCount * 0.35))} pages):** Summarize the main concepts from your course/assignment materials.`,
            `- **Analysis & discussion (~${Math.max(1, Math.round(pageCount * 0.4))} pages):** Compare evidence, limitations, and implications.`,
            `- **Conclusion (~1 page):** Synthesize how the evidence answers your research question.`,
          ]
        : []),
    ].join('\n')
    return { step, finishWhen, why, workDraft }
  }

  if (isWritingOrResearch) {
    const step = `Draft the working thesis and section-by-section outline for “${title}” using your note: ${shortNote}`
    const finishWhen = `Each section of the outline has a heading, a one-sentence claim, and a target length toward “${finishLine}”.`
    const why = `Structured directly from what you shared (“${shortNote}”) so you can build toward “${finishLine}” one section at a time without guessing.`
    const pageBreakdown = pageCount && pageCount >= 3
      ? [
          `1. **Introduction & Working Thesis (~1 page)** — State the focus from your note (*${shortNote}*) and the central question you are answering.`,
          `2. **Background & Context (~${Math.max(1, Math.floor(pageCount * 0.25))} pages)** — Define the key terms and scope from your assignment instructions.`,
          `3. **Core Analysis / Evidence Sections (~${Math.max(1, Math.ceil(pageCount * 0.45))} pages)** — Break your argument into 2–3 sub-sections, one main point per section.`,
          `4. **Discussion, Limitations & Conclusion (~${Math.max(1, pageCount - 1 - Math.floor(pageCount * 0.25) - Math.ceil(pageCount * 0.45))} page${pageCount - 1 - Math.floor(pageCount * 0.25) - Math.ceil(pageCount * 0.45) === 1 ? '' : 's'})** — Tie the sections back to your thesis and check against your finish line (*${finishLine}*).`,
        ]
      : [
          `1. **Opening & Working Thesis** — State the central question or claim from your note (*${shortNote}*).`,
          `2. **Key Points & Supporting Material** — List the 2–3 main sections needed to satisfy your assignment instructions.`,
          `3. **Synthesis & Closing** — Connect the sections back to your finish line (*${finishLine}*).`,
        ]
    const workDraft = [
      `## Working Outline — ${title}`,
      `- **Finish condition:** ${finishLine}`,
      `- **From your note:** ${note}`,
      ...(input.priorNotes && input.priorNotes.length > 0
        ? [`- **Earlier notes on record:** ${input.priorNotes.length}`]
        : []),
      '',
      '### Section Plan',
      ...pageBreakdown,
      '',
      '### Immediate 20-Minute Slice',
      '- [ ] Write the one-sentence working thesis at the top of your document.',
      '- [ ] Paste the section headings above into your draft and add one bullet under each from your own course notes.',
    ].join('\n')
    return { step, finishWhen, why, workDraft }
  }

  const step = `Outline the first concrete work block for “${title}” based on your note: ${shortNote}`
  const finishWhen = `The first work block from your note is drafted and checked against “${finishLine}”.`
  const why = `Structured directly from the project context you shared (“${shortNote}”) to turn “${finishLine}” into an immediate starting step.`
  const workDraft = [
    `## Starting Plan — ${title}`,
    `- **Finish condition:** ${finishLine}`,
    `- **From your note:** ${note}`,
    '',
    '### Next Steps from Your Context',
    `1. **Define the first slice:** Use your note (*${shortNote}*) to list the 2–3 concrete parts required for *${finishLine}*.`,
    `2. **Draft the opening part:** Complete the first part before expanding the rest.`,
    `3. **Check against finish line:** Verify what remains to reach *${finishLine}*.`,
  ].join('\n')
  return { step, finishWhen, why, workDraft }
}

