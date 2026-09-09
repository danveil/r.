# Validation report

Validated on 9 September 2026 in Windows with Node 24.15, Vite 6.4.3, Chromium and Playwright WebKit 26.6. All browser data was synthetic and isolated from the development preview and any real user database.

## Automated results

| Check                                                | Result                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| TypeScript strict check                              | Passed                                                                                              |
| ESLint, including React hook rules                   | Passed                                                                                              |
| Prettier formatting                                  | Passed                                                                                              |
| Vitest unit, interaction, crypto, API and sync tests | **117 passed** across nine files                                                                    |
| UTC date/prediction/snapshot matrix                  | **62 passed**                                                                                       |
| Asia/Kuala_Lumpur date/prediction/snapshot matrix    | **62 passed**                                                                                       |
| America/New_York date/prediction/snapshot matrix     | **62 passed**, including DST boundaries                                                             |
| Playwright production browser tests                  | **20 passed**: ten in Chromium, ten in WebKit                                                       |
| axe WCAG A/AA automated checks                       | Zero reported violations on Home, Calendar, Insights, Settings and the diary sheet in both browsers |
| Production build                                     | Passed; installable manifest, icons and generated service worker                                    |
| Production dependency audit                          | Zero reported vulnerabilities (`npm audit --omit=dev`)                                              |
| Network observation with sharing off                 | No third-party requests and no non-GET requests                                                     |
| Netlify function entry-point bundling                | Both API and cleanup functions bundle for Node 22                                                   |

The production app entry is **117.68 kB gzipped** (previously 116.85), plus unchanged **4.84 kB gzipped CSS** and the Workbox registration chunk. Lazy sharing modules add **3.62 kB** Partner View, **4.08 kB** service, **12.15 kB** Settings/QR, and **0.57 kB** CSS, all gzip. Workbox precaches **20 entries / 464.81 KiB uncompressed** (previously 16 / approximately 410 KiB). These are app-code assets, never health API responses. Development fixtures are absent from production.

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
