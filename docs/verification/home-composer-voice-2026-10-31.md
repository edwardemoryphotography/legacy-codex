# Home composer and microphone correction — October 31, 2026

Source: Edward's Browser Comment 1 on `https://legacy-codex.vercel.app/`, including his supplied screenshot and existing typed draft. He reported that Enter did nothing and the microphone turned on without producing words. Production was serving merge `7722738` from PR #139. Pressing Enter in that actual empty-account Home preserved the text but produced no request or visible response. A microphone start changed the accessibility status to listening while Home still displayed only its generic mission hint.

## Causes and focused correction

- Home's ready condition required at least one saved mission, so its send handler silently returned for a first-time account. Questions now submit through the existing `/api/brief` route with an honestly empty mission roster. The empty-roster directive and reviewed route prompt now retain and answer the supplied question. Daily Brief/Triage still require saved missions; their blocked state is explicit beside the composer.
- Send and microphone were mutually exclusive. They are now separate 44px controls. Enter and the submit button share the same guarded path; repeated submissions cannot duplicate an in-flight call.
- The generic no-mission/configuration note took precedence over voice errors and listening state. Separate voice and send status regions now sit beside the input. Active recording uses a visible Stop symbol. An engine that starts but supplies no words for 15 seconds is released; a permission/start attempt still has its 30-second cancellation budget. No transcript or audio levels are simulated.
- Home cleared its text before the request finished. The shared runner now reports success/failure; failed, denied, stale, empty-answer or unavailable requests preserve the draft. A later successful response cannot erase new words entered while it was pending. Successful output is brought into view. The voice hook uses Home's actual 400-character limit and reports that boundary.

The owner gate, model permissions, providers, secrets, Supabase settings, dependencies and data ownership are unchanged. A real permission denial remains a denial; Home shows the existing-account sign-in action rather than treating it as a delivered answer. Browser visits establish normal anonymous sessions, but no mission/action/lesson records or fabricated project content were submitted for verification. The canonical checkout's unrelated changes were preserved in a separate worktree.

## Evidence and acceptance boundary

Before implementation, the focused suite failed on the actual regressions: empty-account Enter, discarded question, hidden voice feedback, disappearing mic/Send, failed-draft loss and an unbounded listening engine. The amended tests cover these boundaries plus denied/failed/empty server answers, repeated sends and concurrent typing. Browser/audio callbacks and HTTP failures in unit tests are mocked contracts, never real speech or model-output proof.

Local verification: 54 test files / 535 tests passed; lint had zero errors and nine existing warnings; TypeScript, the Next.js 16.3.0 production build, builder regression check and `git diff --check` passed. No dependency versions changed. These checks establish the named code contracts, not successful live AI or dictation.

Automated review found one timer race: a final result arriving after Stop could replace its five-second deadline with the listening watchdog. The added regression failed before correction. A synchronous stopping guard now prevents that restart and clears the old listening timer before stopping; the full suite and build passed again after the fix.

Local production-build checks used only existing public Supabase client settings, without copying provider secrets. Enter on an unconfigured local server produced the explicit configuration error and retained the text. A microphone start attempt timed out with a visible failure message instead of remaining invisible. At 390×664, Send and microphone measured 44×44, both inside the viewport, with no horizontal overflow.

Release proof belongs in the PR's current status and exact Vercel deployment metadata. Verify canonical production with Edward's existing draft preserved: Enter must produce a real response or explicit request/auth/provider error, failed text must remain, and microphone start/result/error/stop status must remain visible beside the input. Actual spoken-word transcription and an authenticated successful model answer require their own observed results; UI changes, mocked callbacks, and green builds cannot establish them.

Durable lesson: a Home → Mission navigation check did not exercise the front door's composer. Future verification must press Enter with no missions, exercise real failure feedback without losing the draft, and inspect microphone results or failure state. The regression tests run in the existing CI suite.
