# Partner View deployment and device checks

The original implementation run did not create a hosted site, Netlify account, paid service, repository push or production relationship. A deployment now exists at `https://rayangtr.netlify.app`; see [FINAL-HARDENING.md](FINAL-HARDENING.md) for safe hosted checks and remaining operational verification.

## Configuration

- Node 22.12+; `npm ci`, then `npm run check` and `npm run test:e2e`.
- Git-connected Netlify build: `npm run build`; publish `dist`; functions directory `netlify/functions`, esbuild bundler. Deploy the functions together with the frontend. A static drag-and-drop `dist` deployment alone cannot provide sharing.
- `partner.ts`: `/api/partner/:id`, same-origin capability API. Alternate/default function paths are rejected by the handler to prevent bypassing the configured rate-limit route.
- `partner-cleanup.ts`: daily scheduled cleanup. Expired records cannot be read even before cleanup runs. Scheduling must be checked on the published site's Functions page.
- Durable store: site-scoped `rayang-partner-v1`, strong reads and conditional writes. It persists across builds. Use a **separate staging site** for synthetic tests, because site-scoped data can be shared by deployments of the same site. Do not give untrusted branch deployments production storage access. [Netlify Blobs reference](https://docs.netlify.com/build/data-and-storage/netlify-blobs/)
- No new custom environment variables, `.env` secrets, database password or server encryption master key. The Netlify runtime supplies Blobs authorization to functions. Never expose platform credentials with a `VITE_` prefix or put endpoint pairing keys into environment variables.

The configured rate limit is 60 requests per 60 seconds per IP/domain. Netlify processes the exported function config during deployment; **check the deploy log explicitly**, because an invalid rate-limit rule need not fail a deployment. Enforcement can lag counting, so this is abuse mitigation, not an exact spending cap. The local test server does not emulate the edge rate limiter. [Netlify rate-limiting reference](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)

This small design uses one platform rather than an extra database/auth provider. Function calls, storage and bandwidth remain subject to the selected Netlify plan. Inspect usage limits, set available spending controls, and review current pricing in the account; no free-tier or unlimited-cost promise is made.

## Local work

`npm run dev` serves the primary application and synthetic fixtures through Vite. It has no sharing API.

`npm run dev:partner` builds the PWA and starts an ephemeral local API at `http://127.0.0.1:8888`. Use two browser profiles for two devices. The store lives only in the helper process; restarting it invalidates its test relationships. Never use real health information in this helper or publish it.

For platform integration, install Netlify CLI, authenticate, link the staging site and run `netlify dev`. This workflow is documented but was not exercised against an account here. Use HTTPS staging for actual phone pairing; Web Crypto requires a secure context (localhost is a development exception). Keep the final production origin stable.

## Staging acceptance — still required

1. Deploy from Git. Verify both function bundles and the daily schedule are recognized. Confirm the platform rate-limit rule appears in the deploy log. Test rate limiting using synthetic requests only, allowing for enforcement delay.
2. Verify `/api/partner/<random 43-character ID>` returns a JSON denial with `X-Rayang-Partner: 1` and `Cache-Control: no-store, private`, never the SPA HTML fallback. Check CSP, no-referrer, anti-framing, MIME and cache headers on the deployed app. API responses must not enter CDN/browser/service-worker caches.
3. In two clean profiles, create a synthetic primary history, grant categories, open the QR/link, accept, update a period, sync and refresh. Inspect only this synthetic traffic: envelope body contains version/algorithm/IV/ciphertext; create/claim adds hashed authorization metadata. The raw encryption key must never appear in any request, request URL, server log or store record. Authorization bearer values are sensitive; never paste real ones into logs or issue reports.
4. Verify one claimant, expired invitation rejection, wrong reader/writer rejection, and old invitation rejection after acceptance. Confirm writer/read capabilities cannot substitute for one another.
5. Test revocation while another client publishes, then confirm the revoked record has no ciphertext and subsequent reads/publishes fail. Test offline stopping remains pending and retries successfully. Staging is needed to verify actual Blobs conditional-write behavior, platform errors and CDN behavior; the local CAS test store does not prove the hosted service integration.
6. Confirm scheduled expiry cleanup and tombstone retention using synthetic records. Reads deny immediately at expiry; daily cleanup is best effort and platform backups may retain deleted storage for the platform's own retention period.
7. Turn sharing off and verify ordinary tracking makes no sharing API requests. Verify original data survives a deployed update, export/import still works, and backups contain no sharing credentials.

## Physical iPhones — reported results and remaining checklist

Status recorded 10 September 2026: **user-reported physical iPhone verification passed** for Safari invitation → setup code → Home Screen Rayang → import/accept → close/reopen persistence → primary cycle update synchronization → revocation → old-code rejection. Codex did not independently perform physical-device testing. This supersedes the earlier pending handoff status. The detailed list below remains a reusable regression checklist; the report does not establish every accessibility, fallback, offline or edge-case item as physically tested.

**Primary phone**

- [ ] Safari installation, app icon, standalone launch, safe areas, date picker, keyboard, sheet scrolling, VoiceOver and enlarged text.
- [ ] Existing real data backed up before upgrade; update with Later/Update now and verify periods, diary, symptoms, observations and settings survive.
- [ ] Onboarding, phase/cycle-day display, period start/end, history corrections, diary edits, JSON download to Files and restore with synthetic data.
- [ ] Airplane Mode launch and local editing; return online; no sharing requests while off.
- [ ] Enable consent, individual unchecked permissions, QR display and equivalent link copy, sync status, category change by stop/re-pair, online stop and pending offline stop.

**Partner phone**

- [ ] Scan/open the private invitation in Safari. Confirm **Partner Setup** appears, selected categories are shown, and there is no browser-mode Accept button. The visible URL should become the root app, with no secret fragment.
- [ ] If needed, tap Safari Share → Add to Home Screen → Add Rayang. Return to the still-open setup page and explicitly tap **Copy setup code**. If clipboard permission is denied, use **Show setup code** and native manual copy. Keep the code private. Complete these steps within the invitation's ten-minute lifetime.
- [ ] Open Rayang **from Home Screen**, not from the invitation link. On a fresh installation choose **I have a partner setup code**. On an existing primary installation choose Settings → **Set up Partner View on this device**. No reinstall or primary menstrual onboarding should be required.
- [ ] Paste the code, Continue, review shared categories, then Accept Partner View. If primary history exists, verify the explicit acknowledgment and confirm all history remains unchanged. Delete saved code copies and replace the clipboard after setup; the app does not clear it automatically.
- [ ] Close the installed app completely and reopen from Home Screen. Pairing must persist in that installation. Test this with Safari and Home Screen storage isolated; successful Safari pairing is not a substitute for this step.
- [ ] Change synthetic period information on the primary phone, Sync now, then refresh the installed Partner View and verify the updated date/cycle day. Stop sharing on the primary, refresh the installed partner, and verify inactive state. Attempt to paste the old code again: it must not restore access.
- [ ] Test an expired code, a used code on a second clean context, invalid/truncated code, offline setup and direct invitation opening inside standalone mode where the OS permits it. Direct standalone setup should not require copy/paste.
- [ ] Launch from Home Screen into Partner View. Check the correct snapshot date, phase and cycle day, shared calendar colors/markers, freshness text, and absence of edit/diary/export controls.
- [ ] Turn on Airplane Mode, close and reopen, inspect cached Home/Calendar/Settings. Ensure old dates remain marked as snapshots. Resume online and refresh.
- [ ] Revoke on the primary phone, then refresh on the partner phone: neutral disconnected state and no cached health display. While offline, previously received data may remain until the partner reconnects or disconnects locally.
- [ ] Local disconnect clears credentials/cache. Check VoiceOver, dynamic text, tap targets, safe areas and standalone update delivery.

## Operational limits

Losing the primary browser's write capability means it cannot revoke the old share through the app. Its last snapshot expires after 30 days without publication; the site operator can remove the opaque record in an emergency. Clearing site data is not confirmed revocation. There is no account-based recovery and backups intentionally do not restore pairing credentials.

Do not enable analytics, injected scripts, request-body logging or external error collection. The hosting operator still sees IP addresses, timing, opaque paths, request sizes and ciphertext. An operator serving malicious replacement JavaScript could steal endpoint keys; client-side encryption does not remove that endpoint trust boundary.

The v0.2.1 fix adds only client assets and the non-secret `/partner/setup` route. The existing Netlify SPA fallback handles refreshes; local test helpers now serve it too. Manifest `id`, `start_url`, and `scope` remain `/`, display remains standalone, and no per-invitation manifest or custom URL scheme exists. No new environment variables, database migration or backend deployment configuration are required. Deploy frontend assets together and test installed-worker update delivery. Existing pairings remain valid in their original storage context; already consumed Safari-only v0.2 pairings require a fresh invitation once to establish a new installed-context pairing.
