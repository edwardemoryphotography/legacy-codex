import type { HomeContinueView } from '@/lib/homeContinue'
import styles from './HomeContinue.module.css'

/** Home's answer to three questions before anything is typed: what matters,
 *  what is next, and why. Every line is a saved value or an explicit statement
 *  that nothing is saved; the status words never upgrade a suggestion into a
 *  commitment or a commitment into finished work. */
export default function HomeContinue({ view, name, missionCount, onOpenMission }: {
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
        <h2 className={styles.title}>{first ? 'Name the one thing that matters.' : 'Nothing is marked as what matters now.'}</h2>
        <p className={styles.quiet}>
          {first
            ? 'Codex keeps your finish line and your next step, so you can come back and continue without rebuilding the context.'
            : `You have ${missionCount === 1 ? 'one saved mission' : `${missionCount} saved missions`}. Choose the one to focus on.`}
        </p>
        <button type="button" className={styles.primary} onClick={onOpenMission}>{view.cta}</button>
      </section>
    )
  }

  return (
    <section className={styles.card} aria-label="What matters now" data-step={view.status}>
      <p className={styles.kicker}>What matters now</p>
      <h2 className={styles.title}>{view.missionTitle}</h2>
      <div className={styles.step}>
        <p className={styles.stepLabel} data-step={view.status}>{view.stepLabel ?? 'Next step'}</p>
        <p className={styles.stepTitle}>{view.stepTitle ?? 'No next step is saved for this mission yet.'}</p>
        {view.blocker && <p className={styles.blocker}><span>Blocked by</span> {view.blocker}</p>}
      </div>
      <button type="button" className={styles.primary} onClick={onOpenMission}>{view.cta}</button>
      {view.reasons.length > 0 && (
        <details className={styles.why}>
          <summary>Why this?</summary>
          <dl>
            {view.reasons.map(reason => (
              <div key={reason.label}><dt>{reason.label}</dt><dd>{reason.text}</dd></div>
            ))}
          </dl>
        </details>
      )}
    </section>
  )
}
