# Partner View security design

## Baseline and decision

Rayang is a React/TypeScript/Vite PWA. Its existing `rayang-private` Dexie database and version-1 JSON backups remain the source of truth. Predictions are pure local functions. Existing validation baseline: 72 unit/interaction tests, 14 browser tests, and three timezone runs. The working tree contains the initial implementation as uncommitted files; it will be preserved.

Options considered: Netlify Functions + strongly consistent Blobs adds one platform-native store and no database account; a managed SQL service offers transactions but adds provisioning, credentials and another operator; an external real-time/auth platform is unnecessarily large. Choose Functions + Blobs with conditional ETag writes for race-safe state transitions. Storage is durable and site-scoped, not deploy-scoped. Usage incurs the site's normal function/storage charges; a small personal relationship is modest usage, but no free-tier or unlimited-cost guarantee is made. Local development uses an isolated test store; production uses Netlify's injected Blobs credentials. Source-code secrecy is irrelevant.

## Protocol before implementation

- One active relationship. The primary explicitly grants individual categories, all initially unchecked: current cycle/phase, period calendar, fertility estimates.
- Generate independent 256-bit random share identifier, encryption key, write token and invitation token using Web Crypto. No accounts.
- Derive an allowlisted snapshot: version, generation time, granted categories, optional current status, optional period/fertility estimates, and at most 42 calendar-day cells. Never serialize the source database, diary, symptoms, moods, observations, IDs, notes, preferences or recovery copies.
- Encrypt with AES-256-GCM and a fresh random 96-bit IV. Authenticate a fixed protocol/version/share-ID context as additional authenticated data. Outer envelope contains only version, algorithm, IV and ciphertext. Health dates and generation time are inside the encryption.
- Create a pending share with ciphertext and SHA-256 capability hashes. The server sees authorization tokens when authenticating requests, but stores only hashes. It never receives the content key.
- Pairing link: `/partner#invite=<base64url JSON>` containing share ID, invitation token and content key. No query secrets. Read the fragment and remove it via `history.replaceState` before rendering or making requests. QR is generated locally. No external QR service.
- Invitation preview is encrypted and requires the invitation token. The partner decrypts it locally and reviews the actual granted categories. On explicit acceptance, generate a separate read token locally, persist it before claiming, and atomically exchange the invitation for its hash. Claim is single-use; retries with the same read hash are idempotent, a different read hash is rejected. Invitations expire after ten minutes.
- The partner receives no writer token. Server routes separately authorize writer mutations, invitation preview/claim, and reader downloads. Ciphertext possession and knowledge of its key do not grant write authorization.
- All mutation state transitions use ETag compare-and-swap. Revocation replaces the whole record with a ciphertext-free tombstone. An in-flight stale writer cannot revive it. Fresh reads use strong consistency and no HTTP/service-worker caching. Requests authorized before revocation may already be in flight.
- Re-pairing creates all-new material. Changing categories requires stopping the existing relationship and explicitly pairing again, so a removed permission cannot persist silently under old keys.

## Storage, synchronization and retention

Sharing credentials and encrypted partner cache live in a separate `rayang-partner` IndexedDB database, never in ordinary exports. The original database schema stays unchanged. Existing primary data is not migrated, rewritten or reset. Partner cached plaintext exists only in memory after decryption. Browser-held keys are not hardware-backed keychain secrets.

With sharing off, no sharing API is contacted. With it enabled, sync after changes to the allowlisted snapshot, on foreground resume, and manually. Diary-only changes do not trigger uploads. No background polling, push, or WebSockets. Partner refreshes on foreground/manual action, showing snapshot date/time and stale/offline status instead of recalculating it as fresh data.

Stop sharing must receive server acknowledgment before the UI claims revocation is complete. Offline revocation remains visibly pending, keeps the write capability solely to retry deletion, and stops uploads. Importing or deleting primary data first requires stopping sharing, avoiding orphaned access. Reader authorization failure clears pairing and cache. Previously viewed or copied information, including an offline cache on another person's device, cannot be remotely guaranteed erased.

Active snapshots expire after 30 days without publication. Pending invitations expire after ten minutes. Reads reject expired records immediately. Scheduled cleanup removes expired ciphertext and deletes old ciphertext-free tombstones. Netlify/platform backups and internal storage deletion timing are outside the application's guarantees.

## Threat model

Assets: cycle snapshot, encryption key, reader/writer capabilities, invitation and local caches. Adversaries: random internet users guessing identifiers, a leaked invite recipient, a malicious legitimate partner, compromised storage/backend, and someone using an unlocked device.

Goals: stored backend contents cannot decrypt cycle information without an endpoint key; outsiders cannot download ciphertext; readers cannot mutate source data or server snapshots; revocation blocks future authorized synchronization; excluded private fields never enter serialization. High-entropy capabilities resist guessing, SHA-256 protects tokens at rest, AES-GCM detects tampering, bounded JSON and rate limits resist ordinary abuse. Uniform unauthorized responses reduce enumeration.

Limits: anyone holding a pending invitation can preview its initial snapshot; the first claimant receives future read access; the UI must advise sharing it privately. A legitimate reader can copy data or capabilities. Device compromise, XSS, privileged extensions, unlocked-device access and maliciously replaced application JavaScript defeat endpoint secrecy. A compromised hosting operator could serve code that steals keys, deny service or replay ciphertext; the client rejects snapshots older than its cached generation time but this is not complete server rollback protection. Transport/size/timing/IP metadata remains visible. This design is not described as perfect anonymity or “zero knowledge.”

## Implementation and validation sequence

1. Protocol types, strict DTO/envelope validation, Web Crypto and privacy tests.
2. Capability API with a store interface, strong-consistency Blobs adapter, conditional mutations, expiry/cleanup and adversarial tests.
3. Separate local sharing state, bounded fetch/timeouts, foreground sync and offline/revocation handling.
4. Lazy-loaded Primary Settings controls, local QR and invitation acceptance; separate read-only partner screens using existing tokens and safe calendar styling.
5. Preserve primary export/import and guard active sharing; deny service-worker interception of API navigations. Existing CSP/referrer protection stays restrictive.
6. Existing checks plus two-browser pairing/update/revocation journeys, crypto tamper/replay tests, migration, payload exclusion, timezone and accessibility tests. Document actual results and physical-iPhone/deployment checks.

## Implemented protocol details

The allowlist is defined by `src/partner/protocol.ts` and constructed/validated in `snapshot.ts` before encryption and after decryption. `schemaVersion: 1`, `generatedAt`, `date`, three permission booleans and a bounded calendar are required. Optional `current` holds phase, cycle day and actual-period flag; optional `period` holds estimated start/end and start range; optional `fertility` holds fertile start/end and ovulation date. Calendar cells contain only date and independently granted period/fertility flags. There are no free-text fields, source-record IDs or full history. The range is six Monday-aligned weeks beginning one week before the snapshot's current week. Current fertile/ovulation phase labels are masked when fertility estimates are not granted. Other cycle timing can still support inferences; permission controls cannot prevent inference from information voluntarily shared.

The encrypted envelope is `{version:1, algorithm:'AES-256-GCM', iv, ciphertext}`. The 128-bit authentication tag is included in ciphertext. AAD is `rayang-partner:1:<share-id>`, binding ciphertext to its relationship and protocol version. Keys and capabilities are 32 independent random bytes, encoded as 43-character base64url strings. API bodies are limited to 48,000 bytes; plaintext to 32,000 bytes, calendar to 42 cells. Client fetch times out after ten seconds, refuses redirects, omits cookies/referrer and requests no-store. Server checks route, method, origin when present, bearer shape, operation shape, authorization and record state. The route is exact, including rejection of default Functions aliases.

Primary IndexedDB holds write/key/invitation capability material, permission choices, sync state and a local snapshot fingerprint. Partner IndexedDB holds key/read capability and the encrypted envelope. Successful acceptance removes the local invitation capability from the partner record. Raw keys are imported into non-extractable Web Crypto handles for cryptographic operations; storing the source key locally enables later offline decryption, but is not hardware-backed protection. Neither database is encrypted against an attacker executing same-origin JavaScript.

Claim persists the newly generated reader capability before the request. A lost acknowledgment can retry with the same hash; it cannot substitute a second reader. The server retains the invitation hash for this idempotent retry, but preview is denied after acceptance. Reopening a claimed invitation in a fresh device is denied. The server cannot distinguish a physical device from a copied read capability; “one partner device” means one issued reader capability, not cryptographic prevention of cloning.

Revocation is a conditional replacement removing ciphertext, invitation hash and reader hash. A delete arriving before creation also inserts a tombstone to fence cross-tab cancellation races. Missing/expired/revoked reads fail; an authenticated repeat delete acknowledges the existing tombstone. Tombstones are retained for seven days, then daily cleanup removes them. Revoked capabilities do not authorize future snapshots, and re-pairing generates a new share ID and every secret. A request already authorized before revocation can finish; previously downloaded copies cannot be recalled. Pending local revocation retains its writer secret and blocks publication and re-pairing until resolved.

Partner cache writes check the connection identity and latest cached generation timestamp inside an IndexedDB transaction. A refresh finishing after local disconnect cannot restore the cache. Invalid ciphertext, malformed data, timeouts and transient server failures retain the last valid snapshot; confirmed authorization failure clears it. Clearing browser storage without a confirmed stop can orphan remote ciphertext until the 30-day expiry. Device clocks are trusted for snapshot freshness, not used to weaken server capability expiry. A primary clock moving backward can cause newer publications to be rejected as rollback until its clock is corrected; cached information remains visible with its original timestamp.

The Blobs adapter uses strong reads plus `onlyIfNew`/`onlyIfMatch` and fails closed on unexpected HTTP storage errors. Production integration, edge rate-limit enforcement, hosted headers and scheduled cleanup still require the staging checklist in [PARTNER-DEPLOYMENT.md](PARTNER-DEPLOYMENT.md). Local tests exercise the same API with a deterministic CAS store; they do not claim to certify Netlify's infrastructure. A daily cleanup over a very large abused store can exceed function time limits; reads still deny expired access, but ciphertext deletion may be delayed. There is no distributed spending cap.

See [PARTNER-REPORT.md](PARTNER-REPORT.md) for exact results and the six privacy assertions.
