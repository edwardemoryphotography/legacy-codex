import { describe, it, expect } from 'vitest'
import {
  EMPTY_BOARD,
  captureIdea,
  setFinishLine,
  promoteToPrimary,
  promoteToSecondary,
  reportBlocker,
  unblock,
  reportCapacityMismatch,
  requestPriorityChallenge,
  applyPriorityChallenge,
  completeMission,
  pauseMission,
  abandonMission,
  findByState,
  type MissionBoard,
} from './missionLoop'

const T0 = '2026-07-15T00:00:00.000Z'
const T1 = '2026-07-15T01:00:00.000Z'
const T2 = '2026-07-15T02:00:00.000Z'

function captured(board: MissionBoard, id: string, title: string, now = T0) {
  const result = captureIdea(board, { id, title, now })
  if (result.error) throw new Error(result.error)
  return result.board
}

describe('captureIdea', () => {
  it('a new idea enters Parked by default', () => {
    const { board, error } = captureIdea(EMPTY_BOARD, { id: 'm1', title: 'Ship the thing', now: T0 })
    expect(error).toBeNull()
    expect(board.missions.m1.state).toBe('parked')
    expect(board.missions.m1.finishLine).toBeNull()
  })

  it('rejects an empty title', () => {
    const { error } = captureIdea(EMPTY_BOARD, { id: 'm1', title: '   ', now: T0 })
    expect(error).not.toBeNull()
  })
})

describe('promotion requires a finish line', () => {
  it('rejects promotion to Primary without a finish line', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Ship the thing')
    const { error } = promoteToPrimary(board, 'm1', T1)
    expect(error).toMatch(/finish line/i)
  })

  it('allows promotion once a finish line is set', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Ship the thing')
    board = setFinishLine(board, 'm1', 'PR merged with passing checks', T1).board
    const { board: next, error } = promoteToPrimary(board, 'm1', T2)
    expect(error).toBeNull()
    expect(next.missions.m1.state).toBe('primary')
  })
})

describe('mission capacity enforcement — one Primary, one Secondary', () => {
  function boardWithPrimary() {
    let board = captured(EMPTY_BOARD, 'm1', 'Primary mission')
    board = setFinishLine(board, 'm1', 'Deploy v1', T0).board
    board = promoteToPrimary(board, 'm1', T0).board
    return board
  }

  it('rejects a second Primary while one is active', () => {
    let board = boardWithPrimary()
    board = captured(board, 'm2', 'Another idea', T0)
    board = setFinishLine(board, 'm2', 'Deploy v2', T0).board
    const { error } = promoteToPrimary(board, 'm2', T1)
    expect(error).toMatch(/already active/i)
  })

  it('rejects Secondary when Primary is neither Blocked nor capacity-mismatched', () => {
    let board = boardWithPrimary()
    board = captured(board, 'm2', 'Candidate secondary', T0)
    board = setFinishLine(board, 'm2', 'Deploy v2', T0).board
    const { error } = promoteToSecondary(board, 'm2', 'primary_blocked', T1)
    expect(error).toMatch(/not Blocked/i)
  })

  it('allows Secondary once Primary is genuinely Blocked', () => {
    let board = boardWithPrimary()
    board = reportBlocker(board, 'm1', 'Waiting on API access', T1).board
    board = captured(board, 'm2', 'Candidate secondary', T1)
    board = setFinishLine(board, 'm2', 'Deploy v2', T1).board
    const result = promoteToSecondary(board, 'm2', 'primary_blocked', T2)
    expect(result.error).toBeNull()
    expect(result.board.missions.m2.state).toBe('secondary')
  })

  it('allows Secondary once an explicit capacity mismatch is reported against Primary', () => {
    let board = boardWithPrimary()
    board = reportCapacityMismatch(board, 'm1', 'low', T1).board
    board = captured(board, 'm2', 'Candidate secondary', T1)
    board = setFinishLine(board, 'm2', 'Deploy v2', T1).board
    const result = promoteToSecondary(board, 'm2', 'capacity_mismatch', T2)
    expect(result.error).toBeNull()
    expect(result.board.missions.m2.state).toBe('secondary')
  })

  it('rejects a second Secondary while one is active', () => {
    let board = boardWithPrimary()
    board = reportCapacityMismatch(board, 'm1', 'low', T1).board
    board = captured(board, 'm2', 'First secondary', T1)
    board = setFinishLine(board, 'm2', 'Deploy v2', T1).board
    board = promoteToSecondary(board, 'm2', 'capacity_mismatch', T2).board
    board = captured(board, 'm3', 'Second secondary', T2)
    board = setFinishLine(board, 'm3', 'Deploy v3', T2).board
    const { error } = promoteToSecondary(board, 'm3', 'capacity_mismatch', T2)
    expect(error).toMatch(/already active/i)
  })
})

describe('blocked missions keep their role; unblock clears the flag', () => {
  it('rejects unblocking a mission that is not Blocked', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Mission')
    board = setFinishLine(board, 'm1', 'Ship it', T0).board
    board = promoteToPrimary(board, 'm1', T0).board
    const { error } = unblock(board, 'm1', T1)
    expect(error).toMatch(/not Blocked/i)
  })

  it('a Blocked Primary stays Primary — being Blocked is not an exit from the role', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Mission')
    board = setFinishLine(board, 'm1', 'Ship it', T0).board
    board = promoteToPrimary(board, 'm1', T0).board
    const blocked = reportBlocker(board, 'm1', 'Waiting on review', T1)
    expect(blocked.error).toBeNull()
    expect(blocked.board.missions.m1.state).toBe('primary')
    expect(blocked.board.missions.m1.blocker).toBe('Waiting on review')

    const { board: next, error } = unblock(blocked.board, 'm1', T2)
    expect(error).toBeNull()
    expect(next.missions.m1.state).toBe('primary')
    expect(next.missions.m1.blocker).toBeNull()
  })

  it('a blocked Candidate/Parked mission moves to the literal Blocked state, and unblocks to Parked', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Idle idea')
    const blocked = reportBlocker(board, 'm1', 'Needs a decision from Edward first', T1)
    expect(blocked.error).toBeNull()
    expect(blocked.board.missions.m1.state).toBe('blocked')

    const { board: next, error } = unblock(blocked.board, 'm1', T2)
    expect(error).toBeNull()
    expect(next.missions.m1.state).toBe('parked')
  })
})

describe('priority challenge does not silently switch the Primary', () => {
  function boardWithPrimaryAndCandidate() {
    let board = captured(EMPTY_BOARD, 'm1', 'Current Primary')
    board = setFinishLine(board, 'm1', 'Ship v1', T0).board
    board = promoteToPrimary(board, 'm1', T0).board
    board = captured(board, 'm2', 'Urgent candidate', T0)
    board = setFinishLine(board, 'm2', 'Ship v2 urgently', T0).board
    return board
  }

  it('requesting a challenge never mutates the board', () => {
    const board = boardWithPrimaryAndCandidate()
    const { challenge, error } = requestPriorityChallenge(board, {
      candidateMissionId: 'm2',
      displacedMissionId: 'm1',
      what: 'Swap Primary to m2',
      why: 'Client deadline moved up',
    })
    expect(error).toBeNull()
    expect(challenge).not.toBeNull()
    expect(board.missions.m1.state).toBe('primary')
    expect(board.missions.m2.state).toBe('parked')
  })

  it('rejects a challenge missing what or why', () => {
    const board = boardWithPrimaryAndCandidate()
    const { error } = requestPriorityChallenge(board, {
      candidateMissionId: 'm2',
      displacedMissionId: 'm1',
      what: '',
      why: 'Client deadline moved up',
    })
    expect(error).toMatch(/what changes/i)
  })

  it('applying an accepted challenge swaps roles and records the displaced mission\'s new state', () => {
    const board = boardWithPrimaryAndCandidate()
    const { challenge } = requestPriorityChallenge(board, {
      candidateMissionId: 'm2',
      displacedMissionId: 'm1',
      what: 'Swap Primary to m2',
      why: 'Client deadline moved up',
    })
    const { board: next, event, error } = applyPriorityChallenge(board, challenge!, 'parked', T1)
    expect(error).toBeNull()
    expect(next.missions.m2.state).toBe('primary')
    expect(next.missions.m1.state).toBe('parked')
    expect(event?.detail).toContain('Client deadline moved up')
  })
})

describe('evidence-gated completion', () => {
  it('rejects completion without confirmed evidence', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Mission')
    board = setFinishLine(board, 'm1', 'Ship it', T0).board
    board = promoteToPrimary(board, 'm1', T0).board
    const { error } = completeMission(board, 'm1', { evidenceConfirmed: false, evidenceDetail: '' }, T1)
    expect(error).toMatch(/without confirmed evidence/i)
  })

  it('completes once evidence is confirmed', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Mission')
    board = setFinishLine(board, 'm1', 'Ship it', T0).board
    board = promoteToPrimary(board, 'm1', T0).board
    const { board: next, error } = completeMission(
      board,
      'm1',
      { evidenceConfirmed: true, evidenceDetail: 'PR #42 merged, checks green' },
      T1,
    )
    expect(error).toBeNull()
    expect(next.missions.m1.state).toBe('completed')
  })
})

describe('pause / abandon', () => {
  it('pauses an active mission', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Mission')
    board = setFinishLine(board, 'm1', 'Ship it', T0).board
    board = promoteToPrimary(board, 'm1', T0).board
    const { board: next } = pauseMission(board, 'm1', 'Deliberately paused for the season', T1)
    expect(next.missions.m1.state).toBe('paused')
  })

  it('abandons a mission and frees the Primary slot for the next promotion', () => {
    let board = captured(EMPTY_BOARD, 'm1', 'Mission')
    board = setFinishLine(board, 'm1', 'Ship it', T0).board
    board = promoteToPrimary(board, 'm1', T0).board
    board = abandonMission(board, 'm1', 'No longer relevant', T1).board
    expect(findByState(board, 'primary')).toBeNull()

    board = captured(board, 'm2', 'Next mission', T1)
    board = setFinishLine(board, 'm2', 'Ship the next thing', T1).board
    const { error } = promoteToPrimary(board, 'm2', T2)
    expect(error).toBeNull()
  })
})
