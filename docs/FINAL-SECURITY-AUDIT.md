# Rayang Final Security & Privacy Audit

## Audit metadata

- Date: 10 September 2026, Asia/Kuala_Lumpur.
- Branch: `main`.
- Exact audited commit: `cf988d66df0f3a2530e3e5575d197531e55244a7` — `Fix iOS partner setup handoff`.
- Initial worktree: clean, verified before security conclusions using Git branch, HEAD and status commands.
- Reviewer context: Codex / GPT-6 automated source review and adversarial testing, in the existing implementation conversation. This is a fresh evidence-based audit, not independent human certification. Earlier implementation reports were not treated as proof.
- Scope: current application, cryptography, setup and invitation protocol, authorization, Netlify Functions/Blobs adapter, local storage, import/export, rendered content, PWA worker, dependencies, both available Git commits, documentation and safe inspection of `https://rayangtr.netlify.app`.
- Exclusions: real user records, production mutations, account administration, actual Netlify logs/storage/backups, infrastructure penetration testing, distributed load testing, physical device testing by the reviewer and guarantees against compromised endpoints or hosting control planes.
- Production source, existing tests, dependencies and deployment settings were not modified. The only retained repository change is this document. Temporary probes used synthetic data and isolated storage and were removed; six test-regenerated tracked screenshots were restored to their original Git bytes.

## Executive summary

**PASS WITH LOW-RISK FINDINGS.** Counts: **0 CRITICAL, 0 HIGH, 0 MEDIUM, 1 LOW, 2 INFO**.

No demonstrated backend plaintext-health access, partner-to-writer escalation, future-data revocation bypass, content-key transmission, setup-code transmission, credential-stealing XSS, diary/symptom upload or cross-share authorization flaw was found in the reviewed paths.

The main finding is deployment-specific: Netlify adds an executable public badge script outside the repository build. Both browsers loaded it under Rayang's origin, and their service-worker caches contained the HTML referencing it. The inspected script did not read health records or pairing material or automatically transmit them. This is unnecessary executable surface and a deployment-review gap, not evidence of an existing confidentiality compromise. Disable the optional badge and refresh the cached app shell in a separate remediation run.

The full required validation passed: 148 unit/integration tests, 26 E2E tests, 62 checks in each of three timezones, TypeScript, ESLint and production builds. Additional probes passed 81 assertions and browser checks in Chromium and WebKit. One dependency advisory affects two development packages; its vulnerable server integration is not configured in Rayang.

**Recommendation:** suitable for personal real use within the documented endpoint, invitation-secrecy, backup and hosting trust boundaries. No confirmed security blocker requires a production-code patch first. Address the deployment hardening finding promptly. Hosted function implementation identity, log settings, cleanup execution and platform rate-limit enforcement were not independently certified.

## Architecture reviewed

The React/Vite application stores primary records in version-1 `rayang-private` IndexedDB. Pure local prediction functions derive cycle estimates. A separate `rayang-partner` database holds pairing credentials, role preference and encrypted partner cache.

Opt-in sharing constructs a small permission-controlled snapshot, encrypts it with AES-256-GCM, and sends an envelope to same-origin `/api/partner/<id>`. Netlify Functions authorize independent writer, invitation and reader capabilities. Site-scoped Blobs records contain hashes, ciphertext and operational metadata. Conditional writes arbitrate claims, publication and revocation.

An invitation fragment contains `{version,id,invitation,key}`. Safari previews without claiming and offers a portable setup code. Standalone setup validates it, previews/decrypts, persists a generated reader, claims, caches a valid decrypted result as ciphertext, then saves partner routing. Partner View cannot invoke remote primary-record editing because no such API exists.

## Verified security properties

- Independent Web Crypto randomness for all generated credentials; authenticated encryption with fresh random 12-byte IVs and share-bound AAD.
- Server operation-specific capabilities, including wrong-share denial; reader/invitation knowledge does not authorize publication or deletion.
- One successful reader claim, with idempotent recovery using that same reader hash.
- Revocation replaces ciphertext and reader/invitation hashes with a tombstone; stale conditional publication cannot restore them.
- Snapshot serialization does not access diary or observation collections. It has no free text, source identifiers or full settings.
- Pairing secrets are absent from normal health exports, URLs sent to the server, application logging and application Cache Storage entries.
- Imported markup renders as text after persistence/reload in both tested engines. No application HTML injection sink was found.
- API fetches omit cookies, reject redirects, bound responses and disable caching. Generated worker routing does not cache API responses.
- Reader authorization failure clears local credentials/cache; transient failures preserve the previous valid snapshot with its original date/time.
- Production app asset hashes matched the local build for all seven JavaScript assets. The extra hosted badge is documented separately below.

## Findings summary

| ID     | Severity | Finding                                                                  | Confidence | Fix required before real use? |
| ------ | -------- | ------------------------------------------------------------------------ | ---------- | ----------------------------- |
| RAY-01 | LOW      | Hosting injects optional executable badge code outside the audited build | High       | No; should remove promptly    |
| RAY-02 | INFO     | Development-only Vitest advisory; affected integration not configured    | High       | No; schedule toolchain update |
| RAY-03 | INFO     | Privacy wording and historical validation notes need clearer context     | High       | No                            |

## Detailed findings

### RAY-01 — Optional hosting script executes outside the repository build

**Severity:** LOW. **Confidence:** High for execution/cache behavior; no exfiltration exploit demonstrated.

**Affected surface:** deployed `/`, `/partner/setup` and app-shell HTML; public `/.netlify/scripts/hud?variant=public`; repository context `netlify.toml` global CSP and `vite.config.ts` precaching. There is no corresponding script in repository `index.html` or built `dist/index.html`.

**Evidence:** safe HTTPS inspection found an appended external script tag with `async`, public HUD variant and public site identifier. The fetched script was 33,507 characters, SHA-256 `9a2d804d43cd32183bd2b6d835edab14271cadcb5ad2d0b05c84196f55b81e8f`. Fresh Chromium and WebKit contexts each requested it, created `nl-badge-frame`, and cached `/index.html` containing the script reference. The HTML also contains Netlify promotional comments/meta elements; those inert elements are not themselves a data leak.

**Preconditions and path:** any ordinary online visitor receives the hosting-injected tag. `script-src 'self'` allows its top-level execution because the script is served from the Rayang origin. It can run alongside or before application startup; source-level fragment removal is therefore not a general guarantee against arbitrary hosting-injected scripts. Its inner `srcdoc` script/style was blocked by the existing CSP in both engines, but that does not prevent the outer script from executing.

**Actual impact:** the production executable surface differs from the reviewed build and can change independently of application asset hashes. Cached HTML preserves the reference. The current script reads/writes only its `nl-hud:public:v1` dismissal preference, creates badge UI, and exchanges viewport/state messages. Inspection found no IndexedDB, fragment, cookie or health-record read, nor fetch/beacon telemetry. Observed requests stayed on the Rayang origin and carried no synthetic invitation fragment. No current key leak, tracking payload or attacker-controlled script injection was demonstrated. Compromise of Netlify's ability to serve arbitrary app code is already an endpoint/hosting limitation; this finding does not reclassify that limitation as a new exploit.

**Existing coverage:** local E2E serves `dist` directly, so it cannot detect hosting HTML injection. The added hosted-browser probes detected it.

**Remediation, separate run:** turn off **Project configuration → General → Powered by Netlify badge**. Do not loosen CSP to make the badge work. Ensure installed clients obtain an updated app shell: disabling edge injection alone does not change the build's precache revision for an already cached `index.html`. Use a normal versioned app-shell/worker update rather than clearing users' IndexedDB.

**Validation:** GET deployed HTML and inspect script tags; verify no HUD request/frame in fresh and previously installed clients after accepting the update; inspect cached HTML; repeat pairing/offline/revocation checks without deleting health storage. Netlify documents the badge toggle in its [19 August 2026 release note](https://www.netlify.com/changelog/2026-08-19-pre-launch-toolbar-and-powered-by-netlify-badge/).

### RAY-02 — Development dependency advisory without a configured exposure path

**Severity:** INFO in Rayang's deployed configuration; upstream severity is Moderate. **Confidence:** High.

**Affected code:** `package.json` development dependencies and test scripts; `package-lock.json:3906` and `package-lock.json:9418` resolve `@vitest/mocker` and `vitest` to `3.2.7`.

`npm.cmd audit --json` reports two affected package entries for one advisory, [GHSA-82fw-gwwq-j7x9 / CVE-2026-84373](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). The vulnerable redirect-mock loader can read files outside an allowed directory when an attacker reaches the relevant mock-registration interface. The maintainer identifies exposed public `mockerPlugin`/`interceptorPlugin` integration as the unauthenticated path; Vitest browser RPC requires its token.

**Preconditions/exploit path:** a developer would need to configure/expose that server integration, or expose the authenticated browser interface and its token. Rayang uses `vitest run` with node/jsdom tests, no browser-mode configuration and no imports of those public plugins. These packages are not shipped as browser assets or imported by Functions. No exploitable path in the audited application was found. This is not two production vulnerabilities.

**Impact:** development-tool maintenance debt; possible workstation file disclosure if future tooling introduces the advisory's preconditions. Existing application tests do not prove advisory absence; configuration inspection establishes current non-reachability.

**Remediation:** separately upgrade and pin compatible maintained Vitest/mocker releases containing the fix, then review migration changes. The advisory lists 4.1.11 as patched; npm's suggested automatic major upgrade was not applied.

**Validation:** repeat full checks and both audit commands; confirm the affected dependency path is removed. `npm.cmd audit --omit=dev --json` currently reports zero vulnerabilities. The initial sandboxed audit could not reach npm; the successful network-enabled reruns supplied these results.

### RAY-03 — Context-sensitive privacy copy and stale audit history

**Severity:** INFO. **Confidence:** High.

**Affected code/docs:** `src/features/Onboarding.tsx:83`, `src/features/Settings.tsx:196`, `src/features/Settings.tsx:300`, `docs/PARTNER-SECURITY.md:21` and `:25`.

“Your information stays on this device” is accurate during ordinary fresh onboarding with sharing off, but reads as an unconditional product promise. The Data & backup section's “Stored only in this browser” describes source history, yet does not immediately distinguish optional encrypted snapshots. The consent sheet and About section correctly explain upload after explicit opt-in. Therefore no unconsented sharing or material privacy deception was demonstrated.

The security document also retains earlier statements about uncommitted implementation and pending physical testing. Git is now committed, and the user reports successful physical verification. These are historical notes, not evidence of current failures.

**Preconditions/path/impact:** users or reviewers reading the isolated short statements may infer a stronger local-only guarantee or an outdated verification state. No attacker capability or execution path results. Existing tests validate behavior rather than these contextual interpretations.

**Remediation:** qualify the short copy with “unless you enable Partner Sharing”; distinguish original local history from encrypted shared snapshots. Date historical baseline paragraphs and record physical results as user-reported, without representing them as reviewer-performed tests.

**Validation:** read onboarding, Data & backup, sharing consent and About together in sharing-off/on states; ensure they tell a consistent story.

## Cryptography review

| Area          | Evidence and verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RNG           | `crypto.ts:20`, `service.ts:48` and `:124`: independent `crypto.getRandomValues(new Uint8Array(32))` calls generate ID, key, writer, invitation and reader. No security-material `Math.random()` path. PASS.                                                                                                                                                                                                                                                                           |
| AES-GCM       | `crypto.ts:25–56`: 32-byte raw AES key, non-extractable imported handle, fixed AES-GCM, 128-bit tag included in ciphertext. Wrong key, altered IV/ciphertext and wrong-share AAD fail authenticated decryption. No plaintext/CBC fallback. PASS.                                                                                                                                                                                                                                       |
| IV handling   | `crypto.ts:36`: fresh 12-byte CSPRNG IV for each encryption, including repeated sync and retries. No saved nonce/counter/reset path. 512 additional encryptions under one key produced 512 distinct IVs; existing tests also pass. Random uniqueness is probabilistic, not proven by a sample: collision probability is approximately n(n−1)/2^97. No explicit lifetime encryption-count cap, but no practical collision concern for the intended personal volume. PASS at this scale. |
| AAD           | Literal `rayang-partner:1:<share-id>` binds protocol/version and relationship. Copying ciphertext to another ID does not decrypt under its context. PASS.                                                                                                                                                                                                                                                                                                                              |
| Key lifecycle | Raw key is retained in primary/partner IndexedDB and transient JS memory; imported CryptoKey is non-extractable, but that does not protect its separately stored raw source. Re-pairing creates new ID and all new secrets. Local disconnect/revocation cleanup deletes relevant live rows; no secure physical erasure claim. PASS within endpoint boundary.                                                                                                                           |
| Setup code    | Canonical unpadded base64url JSON plus unkeyed SHA-256 copying checksum; fixed prefix/version, 1,200-character bound and exact reconstruction. The checksum is not sender authentication. A well-shaped replacement with recomputed checksum parses, then server capability checks or AES-GCM reject the mismatch. PASS.                                                                                                                                                               |
| Key leakage   | Only invitation fragment, explicit clipboard/manual code, memory and local pairing DB contain the key in normal flows. It is not included in API request objects, logs, exported health backups or worker cache. Hosted badge caveat RAY-01 applies to the trusted execution surface. No actual key transmission found.                                                                                                                                                                |

The backend processes raw authorization capabilities in headers and hashes them; it does **not** process the content key. “Ciphertext-only backend” refers to health content, not an absence of raw request credentials or transport metadata. A malicious legitimate partner knows the AES key and can manufacture valid envelopes locally; AES-GCM does not establish which of the two key holders authored one. Server writer authorization prevents that partner from publishing it through the normal API.

### Setup-code adversarial results

Rejected before claim: malformed prefix/base64, missing/extra fields, duplicate JSON fields, reordered/noncanonical JSON, wrong types/version, invalid lengths/noncanonical secret encodings, Unicode substitutions, internal whitespace/newlines, repeated separators, trailing garbage, truncation and oversized input. Outer whitespace, including BOM/line endings removed by `trim`, is accepted intentionally.

The original fragment parser is less canonical than the portable parser: JSON duplicate keys take JavaScript's last value, and noncanonical encoding may decode. All resulting required fields still undergo schema/shape validation and capability/AES checks. No parser-differential authorization exploit was found. Portable codes reject those alternate serializations by reconstructing exact bytes.

Additional probes replaced each of ID, invitation and key with a fresh valid secret and recomputed the checksum against a synthetic pending share. Wrong ID/invitation returned 404; the unchanged invitation with a wrong key could fetch ciphertext but could not decrypt it. Replacing the entire code with an attacker's own valid invitation is social substitution, not a checksum failure: recipients must obtain the code from the intended person through a trusted channel.

## Capability / authorization review

Matrix is for an existing relationship with independently generated capabilities. “Anonymous” includes unknown/bogus tokens. Creating a previously unused random share is a separate public capability-bootstrap operation.

| Operation             | Anonymous | Invitation                                                 | Reader                       | Writer                                            |
| --------------------- | --------- | ---------------------------------------------------------- | ---------------------------- | ------------------------------------------------- |
| Read ciphertext       | No        | Pending preview only                                       | Active, unexpired share only | No; GET returns status/expiry only                |
| Write snapshot        | No        | No                                                         | No                           | Yes, pending/active and unexpired                 |
| Claim invitation      | No        | Pending only; same-reader retry after claim                | No                           | No                                                |
| Revoke relationship   | No        | No                                                         | No                           | Yes, including expired state/idempotent tombstone |
| Create/replace reader | No        | First claim supplies read hash; no replacement after claim | No                           | No direct API; stop and create a new share        |

`server/partner-api.ts:114–171` compares the relevant stored hash for each operation. A read hash chosen during claim does not disclose another token or its preimage. A reader cannot turn a known hash into a writer bearer. SHA-256 and constant-time equal-length comparison are appropriate for random 256-bit tokens; slow password hashing is unnecessary.

Additional two-share tests rejected Share B's reader/writer/invitation against Share A, including GET, publish, DELETE and claim. Existing tests cover operation separation and single-claim races. IDs are 256-bit random values; guessing is impractical.

An arbitrary correctly shaped bearer can create a new unused ID and becomes that new share's writer. DELETE of a missing ID creates a ciphertext-free cancellation tombstone. Neither grants rights over an existing share. Known-ID probing can distinguish a create collision (409) or missing-ID cancellation from an existing unauthorized record. Thus responses are not perfectly indistinguishable for every operation; this is not a practical enumeration or content-disclosure issue given the ID entropy.

## Backend review

- `partner-api.ts:61`: exact path and 43-character ID; queries and unsupported methods denied. Only GET, POST and DELETE. Alternate function routing is rejected by application path validation.
- Exact `Bearer ` transport and bounded token shape; missing, oversized, wrong casing and combined duplicate authorization values denied in focused tests. Header-name case itself is normalized by `Headers`.
- Origin must equal request origin when supplied. No cookie-based authorization, reflected CORS origin or credentialed CORS response. Cross-origin OPTIONS was denied on production. Conventional CSRF lacks an automatically attached credential and cannot supply the bearer without already knowing it.
- JSON content type and both advertised/streamed 48,000-byte limits; malformed JSON, arrays/null, schema confusion and extra operation fields rejected. Envelope bounds and client 32,000-byte plaintext/48,000-byte response limits prevent unbounded health payload processing. The server bounds ciphertext shape but cannot authenticate it without the client key.
- Hash-only persisted authorization; the stored record fields are `state`, `writeHash`, optional `invitationHash`, `readHash`, `envelope`, `expiresAt`, `updatedAt`. No plaintext-health or debug fields.
- Strong Blobs reads and ETag conditional writes. Installed SDK conditional-write behavior was inspected, including its `modified` response and the adapter's rejection of unexpected non-success HTTP statuses. Storage faults return generic 503 and cannot fall through to authorized plaintext.
- Generic application errors and no production application console logging or request-dump logging. Actual account log-drain/header-capture settings were unavailable; platform access logs can contain share paths/IPs. Any platform recording of Authorization headers would expose the respective bearer, but not a normally untransmitted AES key.
- Pending expiry: 10 minutes. Active expiry: 30 days after claim/latest publication. Reads reject expiry without waiting for cleanup. Daily cleanup conditionally removes expired ciphertext; seven-day tombstones are later deleted. Storage-provider backup retention remains outside application guarantees.
- `now` is captured at handler entry, so an operation begun before expiry can finish later. This does not bypass a concurrently committed revocation: writes still need current ETags and recheck state on retry. No unbounded post-expiry access path was demonstrated.
- The configured function rate limit is 60 requests per 60 seconds per domain/IP, consistent with the [Netlify API schema](https://docs.netlify.com/build/functions/api/#ratelimit). Enforcement was not load-tested against production. Random-share creation and cancellation can consume storage; distributed abuse and a very large cleanup backlog remain availability/cost risks. There is no account-wide spending quota in application code. These are documented personal-service limitations, not a demand for enterprise DDoS infrastructure.

## Revocation review

Client transition: `creating → pending → active`; `stopSharing` first stores `revoking`, then serially sends DELETE. Failed network deletion stays visibly pending and blocks publication/re-pairing. The UI does not announce completed revocation before acknowledgment.

Server transition: absent → pending (only-if-new), pending → active (CAS), pending/active → ciphertext-free revoked tombstone (CAS). Publish updates within the existing state; it cannot change revoked back to active. Cleanup tombstones expired records and eventually deletes old tombstones.

Additional interleaving probe paused a publish after its old version was read, committed DELETE, then released the publish: stale CAS failed and retry returned 404, with the record still revoked. Existing tests cover a cancellation arriving before creation and stale ETag restoration denial. A read already authorized against the old record may complete while revocation is in progress; it cannot contain a later, post-revocation publication.

Old reader/invitation/setup material cannot fetch future data or create a replacement reader in the revoked relationship. Re-pairing generates new ID/key/capabilities. An old ciphertext remains decryptable with its old key, as expected. After eventual tombstone deletion someone could create a different relationship at a known old ID, but cannot obtain the new primary relationship's fresh secrets or future data; this is not a future-data revocation bypass.

Local disconnect deletes the partner row and its encrypted cache/key/reader. The nonsensitive role preference intentionally remains until “Use Rayang for myself.” In-flight cache writes recheck identity inside a transaction. Other already open pages/copies may retain previously decrypted data; neither local disconnect nor remote revocation is secure erasure of every copy.

## PWA/service-worker review

The built worker has a static precache list (22 entries, 16 distinct cache requests in the local browser probe), cleanup of obsolete caches, and an app-shell navigation route excluding `/api/` and `/.netlify/`. There are no API runtime-cache rules. A GET fetch to the API does not match the navigation route; API navigations are denied fallback. Non-GET operations are not cached.

In each engine a service-worker-controlled page read an authorized synthetic ciphertext, the isolated backend revoked it, and the next browser read returned 404. Cache Storage held no API URL, authorization header, tested capability/key, ciphertext or imported private note. This directly rejects the stale-success-response revocation hypothesis.

Plaintext partner snapshots are transient React/service values. The persistent partner cache is an encrypted envelope in IndexedDB, accompanied by its key. App-shell caching is not a private-data vault. Hosted HTML additionally caches the badge reference (RAY-01); its script response was not an application precache entry.

UpdateNotice checks on focus, offers an explicit update and suppresses prompts while forms/setup are open. Users may postpone updates or remain offline; security fixes are not force-installed. An old valid worker can persist until a successful update. Cached assets cannot provide authorization to a server that rejects the capability.

## Safari/standalone handoff review

`main.tsx:11–14` captures recognized `/partner#invite=` material and replaces history with `/` before asynchronous app startup. The browser setup effect also normalizes the manual setup route. The clipboard copy requires an explicit click; it does not read or clear the clipboard automatically. The readable fallback is deliberate secret disclosure to the person operating the device.

Browser preview decrypts selected categories without claiming or persisting a reader. Standalone detection is a presentation hint, not authentication. The acceptance path validates/decrypts before a first claim, then stores reader/key/invitation in an `accepting` record before the request. A lost acknowledgment can retry the same read hash after restart. Active routing is persisted only after successful authenticated decryption/cache write. Another claimant cannot substitute a different read hash after the winner.

An existing different partner relationship requires disconnecting first. Read-only primary-table counts drive explicit acknowledgment before the normal mode switch. Partner setup does not write primary tables. The count and mode preference are not cross-tab security locks: another local tab can change data or routing while setup is open, but no remote primary-write authority results.

`/#primary` deliberately opens local primary mode; it cannot access the remote primary user's IndexedDB. Root, `/partner`, `/partner/setup`, direct standalone invitation and malformed fragments follow the observed routing rules. Unrecognized routes/fragments do not confer credentials. Only recognized invitation fragments are scrubbed automatically; manually placing secrets in arbitrary queries/paths is outside the generated flow and would leak them to the host.

Clipboard managers, extensions, screenshots, browser history synchronization before replacement and back/forward memory can retain invitation material. Replacement removes the current visible history entry, not copies held by other software. A leaked unclaimed invitation enables preview and first claim; an already claimed code is not a new-reader credential.

## XSS/content-security review

Application searches found no `dangerouslySetInnerHTML`, direct HTML insertion, eval/new Function, markdown execution or attacker-controlled dynamic script URL. Diary/observation notes render through React text/controlled fields. Backup download creates a local JSON Blob URL with a fixed date-derived filename, not an attacker script URL. Protocol text is enumerated/date-validated before rendering. Setup errors are fixed messages rather than echoed secrets.

Temporary tests imported a diary containing an image `onerror` payload and a script tag, then reloaded and verified literal text, no execution marker and no payload-resource request in Chromium and WebKit. This was tested on the local production build without relying on hosted CSP to make unsafe rendering appear safe. No credential-stealing XSS was found.

Live HTML headers matched the configured restrictive policy: self-only scripts/styles/connect/worker, no unsafe-inline/eval or broad remote origins, images self/data, object none, form-action none, frame-ancestors none. `X-Frame-Options: DENY`, nosniff, no-referrer and camera/microphone/geolocation denial were present. Cross-origin framing of sensitive app screens is blocked. Data-image allowance supports local QR; it is not script permission. RAY-01 shows that self-only scripts still include host-injected same-origin code.

Live API JSON had no-store/private, no-referrer, nosniff and the application marker. Global HTML CSP/frame headers were not present on the observed function response, but it is non-HTML JSON and no executable rendering path was found. Absence there is not a demonstrated clickjacking/XSS issue.

## Import/export review

`validation.ts` bounds backup text to 10 MiB, validates version/timestamps/dates/tags/record consistency and reconstructs allowlisted records, stripping unexpected fields. The file UI checks byte size before reading. `database.ts` validates before mutation and writes atomically, retaining a recovery backup. Invalid import cannot partially overwrite history in the existing database and E2E tests.

The additional import probe preserved a script-like note as text while removing synthetic writer/key/HTML extra properties. Normal exports are constructed from primary `readData`, not from the separate pairing database. They include profile, periods, diary, observations and bleeding, but no pairing capabilities or content keys. Backups are intentionally readable plaintext and must be kept private.

Import/delete guards require sharing to stop. The guard and primary write occur across separate databases and are not a global cross-tab transaction. A local concurrent enable/import can therefore change which local data a newly enabled share sees; this needs local actions and is not remote partner access or a validation bypass. Normal consent and serialization limits still apply. Browser data clearing outside Rayang can orphan remote ciphertext until expiry.

## Dependency review

Installed production build used Vite 6.4.3 and PWA plugin 1.3.0; tests used Vitest 3.2.7. Runtime dependency paths are React/React DOM, Dexie, date-fns and local QR generation; Blobs is server-side and Functions supplies server integration/types. No remote QR, analytics or error SDK is imported by application code.

`npm.cmd audit --omit=dev --json`: **0 vulnerabilities**, exit 0. Full audit: **2 Moderate package entries, one unique advisory**, exit 1; both are development-only and described in RAY-02. No dependencies were upgraded or lockfile changed. Advisory absence is a time-limited registry result, not proof that every dependency is defect-free or immune to supply-chain compromise.

Both available Git commits were searched: 136 text-file revisions, excluding the lockfile from secret-pattern scanning. No concrete private key, recognized API credential, literal full bearer or full setup-code match was found. No tracked environment files or local `.env` were found; application code has no custom server master secret. Production uses platform-injected storage authorization, whose actual values were not inspected.

All seven built JS assets were scanned for concrete setup/bearer values, private-key markers, demo-handler names and recognizable test strings; no matches. Fixture values are synthetic. `import.meta.env.DEV` excludes both demo entry paths and fixture modules from production. Development demos retain in-memory state and suppress synchronization. This is a bounded review of the two-commit history, not a forensic guarantee against unknown secret formats or data outside the repository.

## Privacy-data-flow review

### PRIMARY SHARING OFF

Health data stays in `rayang-private`; prediction and UI rendering are local. `PrimarySync` checks for a connection before loading/calling the service, and `syncPrimary` returns when none exists. Source/private-note creation and import/reload tests generated no sharing API calls. Network traffic consists of app assets, manifest/worker/update requests and, on the current hosted deployment, the extra badge script. The hosting provider still sees ordinary access metadata. Explicitly opening someone else's invitation is a separate user-initiated preview flow.

### PRIMARY SHARING ON

An explicit category grant creates independent credentials. Only the snapshot below is encrypted and uploaded. Create sends invitation hash plus envelope using writer Authorization; later writer status/publish/revoke calls carry the writer token. The server sees raw capabilities while authenticating and only their hashes at rest. No content key or complete setup code is in a request. Snapshot fingerprinting suppresses diary-only change uploads; foreground/manual refresh can publish an otherwise unchanged snapshot without transmitting the diary.

### PARTNER

Preview and claim use invitation Authorization; claim supplies a generated reader hash. Active reads use reader Authorization. Ciphertext is downloaded and decrypted on-device. The partner's ordinary UI cannot edit the remote primary database. Its cache/key and role are separate from any local primary history. Decrypted dates/categories remain available from a previously authorized offline cache until cleared locally or the app learns of denial.

### Complete encrypted DTO and source-field trace

`src/partner/snapshot.ts:7–73` is the serialization boundary. Its calculation input is a newly constructed object containing only `profile`, `periods`, `bleeding`, and empty other tables. Prediction uses cycle/period priors and actual period start/end/status or bleeding dates; identifiers, notes and timestamps are not copied into the output. Week preference is not serialized; shared range alignment is explicitly fixed.

| Serialized field                                   | Source/meaning                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `schemaVersion`                                    | Constant 1                                                                                       |
| `generatedAt`                                      | Snapshot-generation ISO timestamp                                                                |
| `date`                                             | Primary local calendar date                                                                      |
| `permissions.current`, `.period`, `.fertility`     | Explicit primary grant booleans                                                                  |
| `current.phase`                                    | Derived cycle phase; fertility/ovulation labels masked when fertility grant is off               |
| `current.cycleDay`                                 | Derived day count, or null                                                                       |
| `current.isActualPeriod`                           | Derived actual-period flag                                                                       |
| `period.start`, `.end`, `.rangeStart`, `.rangeEnd` | Predicted period dates/range from period history and priors                                      |
| `fertility.start`, `.end`, `.ovulation`            | Predicted fertile/ovulation dates                                                                |
| `calendar[].date`                                  | At most 42 consecutive dates, six Monday-aligned weeks starting one week before the current week |
| `calendar[].period`                                | Granted actual/estimated/none period flag                                                        |
| `calendar[].fertile`, `.ovulation`                 | Granted boolean prediction flags                                                                 |

Optional blocks/flags appear only with their grants; no predicted block is fabricated when prediction is unavailable. `parseSnapshot` checks the allowlist before encryption and after decryption. There are no diary entries, symptoms, mood, private notes, observation values, recovery copies, source IDs, full settings or database exports. Existing privacy tests install throwing getters on diary/observations and still construct the snapshot successfully. Selected timing can support inference about unshared timing categories; permission controls cannot prevent inference from voluntarily shared dates or current phase.

## Metadata visible to backend

Plaintext operational metadata includes share ID in the path/store key, request method/operation, raw request bearer, stored capability hashes, pending/active/revoked state, envelope algorithm/version/IV, ciphertext length, expiry/update times and traffic frequency. Generation time and health dates are encrypted, but size and publishing patterns may allow coarse inferences. Netlify/network infrastructure sees IP, TLS endpoint, access time and usual HTTP metadata; the encrypted-content design does not provide anonymity or conceal usage of a cycle-tracking site.

A database-only disclosure gives ciphertext/hashes/metadata, not AES keys or feasibly invertible random tokens. A compromised serverless runtime can observe arriving bearer tokens, alter authorization and replay/deny ciphertext, but does not gain the normally absent AES key just by reading request bodies. A hosting controller serving malicious frontend code can steal local data/keys on execution; that is a stronger, explicitly excluded endpoint-compromise condition.

## Documentation/privacy-claim review

The central consent and README claims match implemented local/off versus encrypted/on behavior. Revocation is described as future synchronization control, not remote erasure. “One partner device” is clarified in the security document as one issued reader credential; cloning is possible after credential theft. The checksum is explicitly not authentication. Primary history/exports and same-browser keys are correctly described as not protected by an app-level hardware keychain.

RAY-01 corrects the assumption that the production executable page contains only the repository build. RAY-03 covers contextual wording and dated verification notes. Threat-model coverage should explicitly retain clipboard snooping, runtime-versus-database compromise, hosting injection, extensions, logs and dependencies alongside its existing attacker descriptions.

Partner labels use estimated phase, estimated period, predicted ovulation and possible fertile window. Partner Settings and primary About say predictions are not contraception/diagnosis and days outside the window are not guaranteed pregnancy-safe. No medically confirmed ovulation or guaranteed infertility assertion was found. This was a wording-boundary review, not clinical validation of the prediction model.

## Automated validation

Final `npm.cmd run format:check` also passed (exit 0); all matched files use Prettier style.

| Command/check                   | Exact result                                                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run check`             | Exit 0: TypeScript, ESLint, 11 Vitest files / 148 tests, production build passed                                                                                                                                        |
| `npm.cmd run test:timezones`    | Exit 0: UTC 62/62; Asia/Kuala_Lumpur 62/62; America/New_York 62/62; 186 executions total                                                                                                                                |
| `npm.cmd run test:e2e`          | Exit 0: 26/26 in 1.8 minutes; Chromium 13, WebKit 13; no retries needed                                                                                                                                                 |
| `npm.cmd run build`             | Separate requested build exit 0; 420 modules; generated worker with 22 precache entries / 472.80 KiB                                                                                                                    |
| Temporary source/API probes     | Exit 0: 81 assertions; two-share misuse, capability confusion, malformed authorization/JSON, revocation, stale-write race, recomputed checksums, duplicate/Unicode setup input, import allowlist; 512 unique IV samples |
| Temporary local browser probes  | Both engines passed: imported stored-XSS text inert after reload, no off-state API calls, fragment replacement, post-revocation 404 under worker control, cache secret exclusion, empty app local/session storage       |
| Temporary hosted-browser probes | Both engines confirmed normalized invalid-invitation URL, injected HUD execution and cached HTML reference; observed inner-script/style CSP rejection; no API request for invalid code or fragment-bearing request      |
| Production dependency audit     | Exit 0; zero advisory entries                                                                                                                                                                                           |
| Full dependency audit           | Exit 1; two Moderate development-package entries for the one advisory in RAY-02                                                                                                                                         |
| Repository/bundle secret scan   | Two commits / 136 text revisions; no identified secrets. Seven JS assets scanned and byte-matched to deployed assets                                                                                                    |

Required commands were run after the initial static/protocol analysis; discovery of hosted HTML injection prompted the additional deployment investigation. Test output included harmless `NO_COLOR`/`FORCE_COLOR` warnings. No tests were changed to obtain passes.

Representative temporary proof sequences, using only generated credentials and `MemoryShareStore`:

```text
create A and B; claim each with its own reader
GET A using B.reader -> 404
publish/delete A using A.reader, A.invitation or B.writer -> 404
pause A.publish at conditional write; DELETE A -> 200
release paused write -> CAS fails, retry -> 404; state remains revoked
read A after revoke -> 404; decrypt previously received A envelope locally -> succeeds
recompute valid setup checksum after changing key -> parser accepts, AES decrypt rejects
```

### Safe production observations

- HTTPS `/` and `/partner/setup`: 200 HTML with the security headers described above.
- `/sw.js`: 200 JavaScript, `Cache-Control: no-cache`; API-denying navigation rules matched the generated worker semantics.
- Synthetic 43-character ID, missing token and bogus correctly shaped token: 404 JSON `{"error":"Unavailable"}`, `Cache-Control: no-store,private`, `X-Rayang-Partner: 1`.
- Cross-origin preflight at that synthetic path: 404 with no Access-Control-Allow-Origin.
- `/.netlify/functions/partner`: SPA HTML 200 on this deployment, not a successful alternate API. Application code also rejects alternate API paths.
- HTTP `/`: 301 to HTTPS. HTTPS responses included HSTS `max-age=31536000; includeSubDomains; preload`. No production flow intentionally downgrades transport.
- All seven JS asset responses exactly matched local file SHA-256 hashes. The deployed worker has equivalent entries with ordering differences; HTML differs through platform additions. These checks do not establish a cryptographic identity for the private deployed function bundle.

No live create/claim/publish/delete or load test was performed. Observed unauthenticated responses cannot verify live storage CAS behavior, scheduled cleanup completion or operational log policy. Netlify platform TLS implementation was not independently audited.

## Physical verification acknowledged

The user reports that, before this audit, a physical iPhone successfully completed Safari invitation → setup code → installed Home Screen app → import/accept → close/reopen persistence → primary synchronization → revocation → old-code rejection. These are **user-reported passing results**. The reviewer did not perform those physical tests. Automated WebKit plus separate browser contexts is additional evidence, not a substitute for iOS OS integration testing.

## Residual risks

| Attacker/condition                                         | Boundary and remaining risk                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Random internet attacker / ID guesser                      | No known practical access path; 256-bit IDs/capabilities and operation authorization. Can consume public endpoint resources within platform limits.                                                                                              |
| Stolen reader capability                                   | Can download that active share's ciphertext; needs its AES key to read content. Cannot publish/revoke or access another share.                                                                                                                   |
| Stolen setup code / invitation link                        | Includes key and invitation: pending preview and first claim are possible. A claimed/revoked invitation cannot issue a new reader.                                                                                                               |
| Malicious legitimate partner                               | Can copy data/key/reader, infer timing, fabricate local views and keep old snapshots; cannot publish through writer-protected API.                                                                                                               |
| Revoked partner                                            | May retain all previously received information. No normal future-data synchronization under old credentials.                                                                                                                                     |
| Database compromise                                        | Ciphertext/hashes/metadata disclosure, tampering and availability risks; no standalone AES key recovery.                                                                                                                                         |
| Serverless runtime compromise                              | Can observe request bearer tokens and change server state; ciphertext confidentiality still requires an endpoint key. Not the same as a trusted-host/frontend compromise.                                                                        |
| XSS, extension, dependency or malicious served JavaScript  | Could read same-origin storage and keys. No application XSS was demonstrated; endpoint code integrity remains essential. RAY-01 reduces avoidable extra code.                                                                                    |
| Unlocked primary/partner device                            | Local history, pairing keys and decrypted views may be accessible. No application PIN, hardware keychain or secure-erasure guarantee.                                                                                                            |
| Clipboard/history/screenshot access                        | Setup material can escape through user/device software. Explicit copying and short pending expiry reduce but do not eliminate that risk.                                                                                                         |
| Network observer / hosting logs                            | TLS protects contents in transit against ordinary passive observers; host sees metadata and request bearer credentials. No log-account access was available.                                                                                     |
| Storage eviction or user-cleared site data                 | Can lose local history and revoke credentials; encrypted remote records may outlive lost local credentials until expiry/cleanup. Maintain private backups.                                                                                       |
| Malicious backend rollback / concurrent authorized writers | Cached generation time blocks older snapshots locally, but timestamps rely on primary clocks; a fresh client lacks a previous monotonic baseline. Cross-tab publication can reorder snapshots. No complete server rollback guarantee is claimed. |
| Delayed update / distributed abuse                         | Old code may remain offline; billing/cleanup volume is not globally capped. Platform operational monitoring is still necessary.                                                                                                                  |

## Remediation priority

### MUST FIX BEFORE REAL DATA

None established by this audit. No unresolved CRITICAL/HIGH/MEDIUM finding.

### SHOULD FIX

1. RAY-01: disable optional Netlify badge injection and deliver a cache-safe app-shell update; keep health IndexedDB intact and preserve CSP.
2. RAY-02: schedule a compatible maintained test-toolchain upgrade and re-audit dependencies.
3. RAY-03: clarify local/off versus encrypted/on copy and date historical validation notes.

### OPTIONAL HARDENING

Add a deployed HTML/script inventory check so hosting injection is detected alongside source changes. Record account-side rate limiting, cleanup success, storage error and log-retention checks without capturing bearer tokens or health payloads. Consider stronger monotonic snapshot sequencing only if the threat model expands beyond the currently documented rollback limits.

## Final verdict

**PASS WITH LOW-RISK FINDINGS — 0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 2 INFO.** The tested application satisfies its core confidentiality, capability separation, minimized sharing and server-enforced future-access revocation goals within the stated threat model. The hosted page has additional optional executable code that should be removed. No health-data compromise was demonstrated, and no production code was modified during this audit.
