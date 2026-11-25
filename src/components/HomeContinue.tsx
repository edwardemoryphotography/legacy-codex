import type { HomeContinueView } from '@/lib/homeContinue'
import styles from './HomeContinue.module.css'
import { savedActionDisplay } from '@/lib/savedActionDisplay'
import SafeMarkdown from '@/components/SafeMarkdown'

/** Home's Strategic Delta card: compact mission identity above a prominent
 *  recommended next move, concise why-now, observable finish condition, one
 *  unmistakable primary action, and progressively disclosed evidence/provenance.
 *  Every line is a saved value or an explicit statement; status words never
 *  upgrade a suggestion into a commitment or a commitment into finished work. */
export default function HomeContinue({ view, name, missionCount, onOpenMission, children, why, finishWhen, provenance, isProposal }: {
  why?: string
  finishWhen?: string | null
  provenance?: React.ReactNode
  isProposal?: boolean
  children?: React.ReactNode
  view: HomeContinueView
  name?: string
  missionCount: number
  onOpenMission: () => void
}) {
  if (view.status === 'loading') {
    return <section className={styles.card} aria-label="What matters now"><p className={styles.quiet} role="status">Reading your saved work…</p></section>
  }
  if (view.status === 'error') {
    return (
      <section className={styles.card} aria-label="What matters now">
        <p className={styles.kicker}>What matters now</p>
        <p className={styles.quiet} role="status">Your saved work could not be read. Nothing has been changed.</p>
        <button type="button" className={styles.secondary} onClick={onOpenMission}>Open Mission</button>
      </section>
    )
  }
  if (view.status === 'no_missions' || view.status === 'no_primary') {
    const first = view.status === 'no_missions'
    return (
      <section className={styles.card} aria-label="What matters now">
        <p className={styles.kicker}>{first ? (name ? `Hi ${name}` : 'Legacy Codex · start here') : 'What matters now'}</p>
        <h2 className={styles.emptyTitle}>{first ? 'Name the one thing that matters.' : 'Nothing is marked as what matters now.'}</h2>
        <p className={styles.quiet}>
          {first
            ? 'Codex keeps your finish line and your next step, so you can come back and continue without rebuilding the context.'
            : `You have ${missionCount === 1 ? 'one saved mission' : `${missionCount} saved missions`}. Choose the one to focus on.`}
        </p>
        <button type="button" className={`glass-continuity-button ${styles.primary}`} onClick={onOpenMission}>{view.cta}</button>
      </section>
    )
  }

  const readableStep = view.stepTitle && view.missionTitle && (view.status === 'saved' || view.status === 'in_progress')
    ? savedActionDisplay(view.stepTitle, view.missionTitle)
    : null
  const badgeTone = isProposal ? 'proposal' : view.status

  return (
    <section className={styles.card} aria-label="What matters now" data-step={view.status} data-proposal={isProposal ? 'true' : undefined}>
      <header className={styles.missionBar}>
        <p className={styles.kicker}>What matters now</p>
        <h2 className={styles.missionTitle}>{view.missionTitle}</h2>
      </header>

      <div className={styles.moveStage}>
        <p className={styles.stepBadge} data-tone={badgeTone}>{view.stepLabel ?? 'Next step'}</p>
        <p className={styles.moveHeadline}>
          <SafeMarkdown inline>
            {readableStep?.heading ?? view.stepTitle ?? (view.status === 'step_unknown'
              ? 'No saved step was found. Whether you accepted a suggestion could not be checked.'
              : 'No next step is saved for this mission yet.')}
          </SafeMarkdown>
        </p>
        {readableStep?.fromNote && <p className={styles.stepNote}>From your note: <SafeMarkdown inline>{readableStep.fromNote}</SafeMarkdown></p>}
        {view.blocker && <p className={styles.blocker}><span>Blocked by</span> <SafeMarkdown inline>{view.blocker}</SafeMarkdown></p>}
      </div>

      {why && (
        <p className={styles.whyNow}>
          <span className={styles.whyNowLabel}>Why now</span> {why}
        </p>
      )}

      {finishWhen && (
        <p className={styles.finishCondition}>
          <span className={styles.finishLabel}>Finish when</span> {finishWhen}
        </p>
      )}

      <div className={styles.ctaGroup}>
        <button type="button" className={`glass-continuity-button ${styles.primary}`} onClick={onOpenMission}>{view.cta}</button>
        {children}
      </div>

      {(view.reasons.length > 0 || provenance) && (
        <details className={styles.why}>
          <summary>{why ? 'Evidence and alternatives' : 'What Codex has from you'}</summary>
          <div className={styles.disclosureBody}>
            {provenance}
            {view.reasons.length > 0 && (
              <dl>
                {readableStep?.original && <div><dt>Original saved wording</dt><dd><SafeMarkdown className={styles.reasonMarkdown}>{readableStep.original}</SafeMarkdown></dd></div>}
                {view.reasons.map((reason, index) => (
                  <div key={`${index}-${reason.label}`}><dt>{reason.label}</dt><dd><SafeMarkdown className={styles.reasonMarkdown}>{reason.text}</SafeMarkdown></dd></div>
                ))}
              </dl>
            )}
          </div>
        </details>
      )}
    </section>
  )
}
