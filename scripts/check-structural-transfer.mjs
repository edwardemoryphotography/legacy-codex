// Contract checks against real repository artifacts, not a mission simulation.
// No production records, invented lessons, provider answers or success metrics.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseStructuralBridge, selectInvestigationProjects, measureTransfer } from '../src/lib/structuralTransfer.ts'

const instructions = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')
assert.ok(instructions.includes('A Delta is a prediction, never automatically an Action.'))
assert.equal(parseStructuralBridge({}, [], 'unavailable'), null)
assert.deepEqual(selectInvestigationProjects([], [], []), [])
const observed = measureTransfer({ baseline: null, after: null, sources: [], lessons: [], missionId: '', requestContextAdded: false, reviewedAt: new Date().toISOString() })
assert.equal(observed.inheritance, 'Unknown')
assert.equal(observed.outcome, 'no_confirmed_lesson')
assert.equal(observed.human_intervention_required, false)
assert.deepEqual(observed.changedFields, [])
console.log('Empty-history truth and bridge rejection contracts passed; no model or transfer outcome evaluated.')
