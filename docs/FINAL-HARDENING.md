# Rayang Final Hardening

Recorded 10 September 2026, Asia/Kuala_Lumpur.

## Baseline

- Starting commit: `cf988d66df0f3a2530e3e5575d197531e55244a7`.
- Branch: `main`.
- Starting worktree: dirty only because `docs/FINAL-SECURITY-AUDIT.md` was untracked. That existing audit report was preserved unchanged as historical evidence.
- Scope: three small UI-copy edits, documentation status corrections, dependency reassessment and safe hosted verification. No features, protocol changes, prediction changes, database migrations, dependency upgrades, version changes, tags, commits, pushes or deployments.

## RAY-01

**Verified absent from the current hosted pages and fresh browser contexts.** The user reports disabling the Powered by Netlify badge, refreshing/redeploying the site, opening a fresh browser session and refreshing the installed PWA online. No account setting was changed by Codex.

Read-only HTTPS checks of `https://rayangtr.netlify.app/` and `/partner/setup` returned 200 HTML without `/.netlify/scripts/hud?variant=public`. The root had one script tag: `/assets/index-BX8y4_vw.js`, which returned 200, SHA-256 `6d5d9d3296bd997af87f161600a58636bf77a153909e3865787d079287296416`. This is the audited baseline deployment's asset name, not the new local privacy-copy build.

Fresh Chromium and WebKit each loaded the application and registered the worker. Neither requested HUD, created a badge/HUD frame, nor made an external-origin request. Cached app-shell HTML in these fresh contexts also contained no HUD reference. No real health information or production Partner Share was created, read, claimed, changed or deleted.

Hosted protections remained:

- CSP: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`.
- `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- HSTS: `max-age=31536000; includeSubDomains; preload`; HTTP root redirected 301 to HTTPS.
- `/sw.js`: 200 JavaScript, `Cache-Control: no-cache`.

**Closure boundary:** badge removal is independently verified for freshly fetched HTML/fresh contexts. Refresh of the user's existing installed PWA is user-reported, not independently inspected. Older installations may retain a previously cached shell until an update is accepted. These ordinary copy edits change the generated application asset hash and HTML/worker revision; after an explicitly authorized future deployment, the existing Update now/Later flow can deliver the new shell. No cache-busting workaround, storage reset, weaker caching or weaker CSP was introduced.

## RAY-02

**Deliberately deferred; development maintenance note retained.** Installed `vitest` and `@vitest/mocker` remain 3.2.7. A fresh npm version query lists 3.2.7 as the latest Vitest 3 release. There is no patched update within this major line.

The current [maintainer advisory GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9) identifies fixed versions starting with 4.1.11 and states that 3.x will not receive the fix. npm proposes a breaking upgrade to Vitest 5.0.0. A major migration is unnecessary for this controlled copy/documentation pass, so neither the manifest nor lockfile was changed. A future dedicated migration should validate the test runner, mock behavior and Vite integration together.

Rayang's configuration uses node/jsdom Vitest tests. It has no Vitest browser-mode configuration and no public `mockerPlugin` or `interceptorPlugin` integration. The vulnerable redirect-mock interface is therefore not configured/exposed here; these development packages are not imported by the production application or Functions. This is one upstream advisory represented by two package entries, not two remotely exploitable Rayang production findings.

## RAY-03

**Addressed in source and documentation; not yet deployed by this pass.**

- Onboarding: “Your information stays on this device unless you enable Partner Sharing.”
- Primary Settings: local history is distinguished from chosen cycle information shared as encrypted data. Diary, symptoms, moods and private notes remain local. Readable JSON backup and storage-eviction guidance is retained in a separate short paragraph.
- Sharing Settings, off state: “Sharing is off. No cycle updates are sent to a partner.” This does not imply that previously received copies were erased.
- Existing enable-consent and About wording already describe explicit grants, client-side encryption and excluded private fields accurately; they were reviewed and retained.
- README adds the same local/off versus encrypted/on distinction and links current review/status. Historical security, deployment, implementation, handoff and QA notes now distinguish their original state from later user-reported results.

With sharing off, original history, diary, observations and prediction calculations remain local. With sharing on, only the selected minimal cycle snapshot is encrypted on the client and transmitted. The backend receives ciphertext and operational/capability metadata, not the AES content key. Diary, symptoms, mood and private notes do not enter Partner Sharing. Explicit readable backup exports remain separate. No anonymity, secure-erasure or retroactive revocation claim was added.

## Physical iPhone verification

**User-reported physical iPhone verification, recorded 10 September 2026:** Safari invitation → setup code → Home Screen Rayang → setup-code import → Partner View activation → close/reopen persistence → primary cycle update synchronization → revocation → old-code rejection all passed.

This records when the report was received, not a separately established time of the physical test. Codex did not independently perform physical-device testing. Previous pending statements are marked superseded/completed later, while historical test counts and implementation results remain. Broader VoiceOver, keyboard, clipboard-denial, offline and edge-case checklist items are not silently marked as physically verified.

## Regression validation

| Command/check                | Final result                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run check`          | Exit 0: strict TypeScript, ESLint, 148 unit/integration tests across 11 files and production build passed           |
| `npm.cmd run test:timezones` | Exit 0: UTC 62/62, Asia/Kuala_Lumpur 62/62, America/New_York 62/62; 186 executions                                  |
| `npm.cmd run test:e2e`       | Exit 0: 26/26 in 1.5 minutes; Chromium 13/13, WebKit 13/13; no retries or timeout changes                           |
| `npm.cmd run build`          | Separate final build exit 0; 420 modules; main JS 372.02 kB raw / 117.86 kB gzip; 22 precache entries / 473.03 KiB  |
| `npm.cmd run format:check`   | Exit 0; all matched files use Prettier style                                                                        |
| Extra narrow-screen check    | Both engines: clarified onboarding sentence and primary action visible, no horizontal overflow at 320px or 390px    |
| Hosted browser check         | Both engines: app loads, HUD absent from scripts/frames/requests and newly cached HTML, no external-origin requests |

The tests were retained unchanged. Browser checks used isolated synthetic storage. Harmless NO_COLOR/FORCE_COLOR warnings were emitted; no assertion failed.

| Required regression                                   | Result and evidence                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Sharing OFF has no Partner API health synchronization | PASS — existing service and daily-journey network assertions                                        |
| Snapshot excludes diary                               | PASS — protocol throwing-getter/privacy and service tests                                           |
| Snapshot excludes symptoms                            | PASS — allowlisted DTO and protocol/service tests                                                   |
| Snapshot excludes mood/private notes                  | PASS — same unchanged serialization boundary and privacy tests                                      |
| Backend receives no AES content key                   | PASS — service/protocol and handoff network assertions                                              |
| Partner has no writer capability                      | PASS — unchanged operation-specific API authorization tests                                         |
| Setup code contains no primary writer                 | PASS — 26 setup-code cases and handoff assertions                                                   |
| Revocation blocks future reads                        | PASS — server/service and both browser journeys                                                     |
| Old setup code cannot restore revoked access          | PASS — both handoff browser journeys                                                                |
| Existing primary data remains untouched               | PASS — v1 preservation and explicit-acknowledgment browser checks; real user databases not accessed |
| Existing partner setup works                          | PASS — setup, persistence and direct-standalone journeys                                            |
| Onboarding works                                      | PASS — unit and both browser engines, plus narrow-copy check                                        |
| Primary Settings works                                | PASS — daily export/import, responsive and accessibility journeys                                   |
| Partner Settings works                                | PASS — read-only, return-to-primary and disconnect journeys                                         |
| PWA offline behavior works                            | PASS — actual local server shutdown, cached launch and offline editing/partner journeys             |

The unchanged security source and existing regression coverage preserve AES-256-GCM, independent 256-bit credentials, random 12-byte IVs, share-bound AAD, distinct capability roles, client-only setup key, server-enforced revocation and the minimal DTO. No IndexedDB schema or real user data was accessed or changed.

## Dependency audit

- `npm.cmd audit --omit=dev`: **found 0 vulnerabilities**.
- `npm.cmd audit`: **2 Moderate package entries**, both development-only, for GHSA-82fw-gwwq-j7x9. No Critical/High advisory was reported. The finding remains intentionally documented rather than falsely marked fixed.
- `npm.cmd view vitest@3 version`: latest listed release **3.2.7**.

Automatic approval review initially prevented the npm check because of an account usage limit. After the user's “continue,” the retried network checks executed successfully. No workaround or forced upgrade was used.

## Files and Git hygiene

Changed source: `src/features/Onboarding.tsx`, `src/features/Settings.tsx`, `src/partner/SharingSettings.tsx` — text and one explanatory paragraph only.

Changed documentation: `README.md`, `docs/PARTNER-SECURITY.md`, `docs/PARTNER-DEPLOYMENT.md`, `docs/PARTNER-HANDOFF-REPORT.md`, `docs/PARTNER-REPORT.md`, `docs/QA.md`; new `docs/FINAL-HARDENING.md`. The pre-existing untracked `docs/FINAL-SECURITY-AUDIT.md` is preserved, not rewritten to erase the original findings.

No existing test, dependency/lockfile, backend, cryptography, prediction, routing, worker configuration or database file was modified. Package version remains 1.0.0. Generated screenshots are restored after validation; temporary probes execute inline and retain no credentials or files. No commit, push, tag or deployment was made.

Final Git status: nine intentional tracked modifications and two untracked documents (the new hardening report and the preserved pre-existing audit). `git diff --stat` and the full tracked diff were reviewed; `git diff --check` passed. Six generated screenshots were restored to their baseline bytes. Generated `dist`, `test-results` and `playwright-report` directories were removed after validation; rebuild normally when preparing a future release.

## Residual risks

- The non-reachable development advisory still needs a planned major toolchain upgrade.
- The local wording edits require an explicitly authorized release/deployment before they appear on the live site. Installed clients must accept ordinary updates; no guarantee is made about every old offline installation.
- Device/extension/XSS or malicious hosting code can defeat endpoint confidentiality. Local primary history and exports are readable; browser storage can be evicted. Keep private backups and protect devices.
- Leaked pending codes can be claimed, reader credentials can be copied, metadata remains visible to the host, and revocation cannot erase prior copies or offline caches.
- Live storage CAS, cleanup execution, rate-limit enforcement and account log settings were not certified by safe page checks. Physical results are user-reported.

## Release recommendation

**READY WITH MAINTENANCE NOTE.** The repository is technically ready for a controlled personal-use release. RAY-01 is closed for current freshly served HTML and fresh browser contexts; RAY-03 is addressed in the local source/documentation; RAY-02 is deliberately deferred with no configured production exposure. No unresolved Critical/High/Medium finding was identified in the preceding audit or this narrow hardening review. The local changes have not been committed, pushed or deployed.

| Explicit question                                                | Answer                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Does Sharing OFF remain local-only?                              | YES — health data; normal app/update downloads still occur                                                         |
| Can the backend decrypt Partner health snapshots?                | NO — the normal backend has no AES content key; malicious replacement frontend code remains outside that guarantee |
| Can the partner modify primary records?                          | NO                                                                                                                 |
| Are diary entries transmitted?                                   | NO through Partner Sharing; explicit local backup export is separate                                               |
| Are symptom/mood/private notes transmitted?                      | NO through Partner Sharing                                                                                         |
| Does revocation still block future synchronization?              | YES after server confirmation; prior copies remain possible                                                        |
| Did existing IndexedDB schemas/data remain intact?               | YES — no migration, reset or real-data access                                                                      |
| Was the optional Netlify badge verified absent?                  | YES in current hosted HTML and fresh Chromium/WebKit contexts                                                      |
| Is any unresolved Critical/High/Medium security finding present? | NO                                                                                                                 |
