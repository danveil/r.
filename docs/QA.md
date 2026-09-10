# Validation report

Validated on 10 September 2026 in Windows with Node 24.15, Vite 6.4.3, Chromium and Playwright WebKit 26.6. All browser data was synthetic and isolated from the development preview and any real user database.

## Automated results

| Check                                                | Result                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| TypeScript strict check                              | Passed                                                                                              |
| ESLint, including React hook rules                   | Passed                                                                                              |
| Prettier formatting                                  | Passed                                                                                              |
| Vitest unit, interaction, crypto, API and sync tests | **148 passed** across 11 files                                                                      |
| UTC date/prediction/snapshot matrix                  | **62 passed**                                                                                       |
| Asia/Kuala_Lumpur date/prediction/snapshot matrix    | **62 passed**                                                                                       |
| America/New_York date/prediction/snapshot matrix     | **62 passed**, including DST boundaries                                                             |
| Playwright production browser tests                  | **26 passed**: thirteen in Chromium, thirteen in WebKit                                             |
| axe WCAG A/AA automated checks                       | Zero reported violations on Home, Calendar, Insights, Settings and the diary sheet in both browsers |
| Production build                                     | Passed; installable manifest, icons and generated service worker                                    |
| Production dependency audit                          | Zero reported vulnerabilities (`npm audit --omit=dev`)                                              |
| Network observation with sharing off                 | No third-party requests and no non-GET requests                                                     |
| Netlify function entry-point bundling                | Both API and cleanup functions bundle for Node 22                                                   |

The production app entry is **117.82 kB gzipped** (v0.2 baseline 117.68), plus unchanged **4.84 kB gzipped CSS**. Lazy additions include Setup **2.36 kB** and CodeCopy **1.11 kB** gzip. Partner View is **3.35 kB**, service **4.09 kB**, Settings/QR **12.31 kB**, and partner CSS **0.68 kB** gzip. Workbox precaches **22 entries / 472.80 KiB uncompressed**, previously 20 / 464.81 KiB. These are app-code assets, never health API responses. Development fixtures are absent from production.

## Functional coverage

- Explicit onboarding with known/unknown cycle length and period-end choices.
- First, second and established cycles; average/median calculations; unusual and irregular history; personal period durations; history edits/deletions; no fabricated cycle reset after an overdue prediction.
- Logged bleeding overrides the phase display without erasing overlapping fertility flags.
- Month/year boundaries, leap years, DST, date-only round trips, local midnight and resume. Existing recorded dates also survive moving the local calendar backwards through a timezone/clock change.
- Real IndexedDB behavior in browsers; fake-indexeddb transaction tests include rollback on simulated quota failure and concurrent independent edits.
- Period start/end, date selection, history correction/deletion, ovulation observations, diary creation/editing, unsaved-change protection and explicit data deletion.
- Complete active-data JSON export, validated import, pre-import recovery, rejection of malformed dates/timestamps/records, and preservation after a failed transaction.
- Manifest/icon checks, reduced motion, initial dialog focus and restoration to the opening button.
- Update-notice tests ensure no user-triggered reload without confirmation, deferral and suppression during an open form.

## Browser and visual checks

All four screens were checked for horizontal overflow at **320, 375, 390, 430 and 1280 CSS pixels**. At 390 × 844, the home note action also clears the fixed bottom navigation. Shorter screens scroll normally; there is bottom padding for content to clear navigation. The diary sheet scrolls independently and has a reachable sticky save control.

Synthetic screenshots were rendered and visually inspected for Home, Calendar and Diary. Calendar text retains contrast on adjacent-month dates; month labels distinguish those dates. Actual bleeding has a solid treatment; predicted bleeding is patterned/dashed; ovulation has a ring. Today, notes and observed signs also have non-color markers and accessible text.

For the offline test, each browser first installed the production service worker. The isolated static test server was then **shut down completely**, and the app successfully reloaded, saved a diary entry, used Calendar and Settings, downloaded an export and reloaded Settings again. This verifies cached operation under actual server unavailability. Playwright WebKit’s `context.setOffline()` initially produced a browser internal error; the real-server-loss test passed and is the retained test.

Automated WebKit is not physical iPhone Safari. Passing axe checks is not a complete accessibility certification.

## Partner View coverage

### v0.2.1 browser-to-PWA handoff

The v0.2 baseline of 117 unit/integration and 20 browser tests is retained. New coverage adds 26 setup-code cases, four centralized display-mode cases, one claim/role-persistence integration case, and three journeys in each browser. The critical journey uses **three separate contexts**: primary, ordinary Safari-like browser A, and clean standalone-like context B. A derives/copies the code but has zero partner records. B starts with empty partner records, localStorage and sessionStorage, imports only the code, decrypts the snapshot, closes/reopens, receives a cycle update, and loses access after revocation. Reusing that revoked code fails. Both contexts' requests are inspected for the key, complete setup code and fragment; none appear. Only B issues the single successful claim.

Other new journeys verify invalid code fails before API access, proper input labels and axe results, direct standalone invitations, the existing Settings entry, mandatory acknowledgment on a device with primary data, exact primary-record preservation, and return to the primary cycle. Existing reader/cached-view and server-loss journeys still pass; the main handoff requires no Safari storage migration. Mode is simulated through the platform hint in isolated test contexts, not through a real iOS installation. Clipboard writes are mocked in the critical test to confirm that only an explicit click triggers copying; actual iPhone clipboard permission/manual fallback remains a physical check.

Browser handoff and standalone setup have zero axe violations in both engines. The handoff screenshot was visually inspected and spacing kept within the existing design. Setup assets are statically precached, while secrets remain only in transient UI/clipboard and destination credential storage; no new service-worker cache rule was added.

One initial original diary journey failed across the real September 9/10 midnight boundary: the note remained attached to September 9, while the assertion looked for it on September 10's home screen. The persistence journey now uses a fixed browser time. No production date calculation or assertion was changed; separate rollover/resume tests remain. The complete 26-test rerun passed, followed by all 12 Partner journeys after final setup wording/layout/routing changes. No context-close errors were hidden or timeouts increased.

The exact physical sequence is in [PARTNER-DEPLOYMENT.md](PARTNER-DEPLOYMENT.md): Safari → Copy setup code → root Add to Home Screen → installed app → paste/accept → close/reopen → update → revoke. **Not yet physically verified.** See [the 28-point report](PARTNER-HANDOFF-REPORT.md) for format, lifecycle and explicit privacy answers.

### Preserved v0.2 coverage

The original 72 tests remain. Added tests cover strict independent permission combinations, exclusion of diary and observations even as calculation inputs, ciphertext-only bodies, AES-GCM round trips and tampering/wrong-key/AAD rejection, malformed inputs, 100 fresh IV samples, invitation fragments, hashed capabilities, authorization separation, one concurrent claimant, idempotent retries, expiry/cleanup, revocation CAS races, alternate-route rejection, failed storage, client timeout and malformed response handling, lost create/claim acknowledgments, rollback refusal, encrypted offline cache, disconnect races, default-off zero requests, diary-only no-upload, export exclusions, and v1 data preservation with sharing enabled. The IV sample test is a regression check, not a proof of randomness.

Browser journeys use separate primary and partner contexts with synthetic records. Both engines pass opt-in permissions, local QR/link, fragment stripping, acceptance, private-field exclusion from outbound payloads, read-only controls and calendar, cycle publication, primary stop, partner cache clearing, pending offline stop and local disconnect. Partner Home has zero axe violations in both engines; the existing primary screens and diary axe checks still pass. Partner Calendar was checked at 320, 390 and 768 pixels without horizontal overflow. Home/calendar screenshots were visually inspected.

Both engines also accept a share on an isolated server, install the worker, then **stop the entire server** and navigate to the manifest's root start URL. Partner role, snapshot, calendar and clear connection-failure message survive offline. Cache Storage contains no API URL or invitation. This complements the original offline primary diary/export journey.

Local API tests use an in-memory CAS adapter. Netlify's actual strong-consistency service, rate-limit enforcement, production header routing, cleanup scheduler and Safari/Home Screen storage transfer are **not validated by these local checks**. Follow [the separate staging and physical-phone checklist](PARTNER-DEPLOYMENT.md).

## Manual release checklist — still required

- [ ] Connect GitHub to Netlify and deploy the frontend plus both Functions over HTTPS. Verify Blobs, scheduling, capability API, rate limiting and security/cache headers using `docs/PARTNER-DEPLOYMENT.md`. No account or deployment was created by this task.
- [ ] Replace the source-repository placeholder in Settings with your chosen public repository link. Confirm MIT is the license you want before publishing.
- [ ] On her iPhone, use Safari → Share → Add to Home Screen. Check the icon, standalone launch, status bar, notch and home-indicator spacing.
- [ ] Wait for the offline-ready notice. Close the app, enable Airplane Mode and reopen it from Home Screen. Log/edit a synthetic period and note, then check persistence after reopening.
- [ ] Check the native date picker, keyboard opening/closing, sheet scrolling, save-button reachability, text enlargement and VoiceOver. Browser automation does not emulate the actual iOS keyboard or safe-area hardware.
- [ ] Export a synthetic backup to Files, import it, export the pre-import recovery copy, and verify both. Download location and opening behavior depend on Safari/iOS.
- [ ] Deploy a small update and test **Later** and **Update now** in the installed PWA. Confirm saved IndexedDB history survives. Keep a backup before a real update. Actual deployed update delivery and multiple simultaneously open app windows were not end-to-end tested here.
- [ ] Use the final intended domain consistently. A new origin does not inherit the old origin’s IndexedDB data.

## Known boundaries

Predictions are transparent statistical heuristics, not clinically validated estimates or contraception. Subjective ovulation observations do not adjust dates. There are no generated symptom correlations yet. Missing period starts can look like unusually long cycles; the app preserves the entered history rather than silently inferring missing events. Active periods are treated as ongoing until explicitly ended. Unknown-ended periods only have an actual start.

Primary storage and backups remain local and unencrypted. Partner snapshots are encrypted remotely and in the local cache, with endpoint keys in browser storage. Device/browser clearing or eviction can remove history and credentials; local recovery copies cannot protect against losing the browser. Keep downloads private. Before-unload warnings and discard confirmation reduce accidental form loss, but unsaved edits cannot survive an operating-system force-close. Confirmed revocation blocks future synchronization; offline caches and copies already held by a partner cannot be guaranteed erased.
