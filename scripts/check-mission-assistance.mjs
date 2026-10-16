import assert from 'node:assert/strict'
import { assistanceQuestion, parseAssistanceNote, draftStartingPoint } from '../src/lib/missionAssistance.ts'

assert.match(assistanceQuestion('Psych research paper'), /assignment|topic/)
assert.equal(parseAssistanceNote({ contextNote: '   ', requestId: 'bad' }), null)
assert.equal(parseAssistanceNote({ contextNote: 'x'.repeat(6001), requestId: 'bad' }), null)
assert.equal(parseAssistanceNote({}), undefined)
assert.equal(parseAssistanceNote({ contextNote: 'When it is 8 pages ling', requestId: 'f3b892da-11dd-467b-a438-b334893d1d82' })?.note, 'When it is 8 pages ling')
assert.equal(draftStartingPoint(null), null)
assert.match(draftStartingPoint({ workDraft: 'When it is 8 pages ling', finishWhen: 'Check the assignment requirements' }), /Model-generated draft/)
console.log('Mission assistance contracts passed')
