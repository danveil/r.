# Implementation plan

This file records the original local-only release. The subsequent Partner View architecture, implementation report and current validation are in `docs/PARTNER-SECURITY.md`, `docs/PARTNER-REPORT.md` and `docs/QA.md`. The source database and original behavior remain intact.

The baseline is an empty Git repository. The product is **Rayang**, a personal local-first menstrual tracker, built with React, TypeScript, Vite, Dexie and date-fns. Deployment target: static Netlify hosting. No backend or third-party runtime services.

1. Foundation: toolchain, PWA manifest, local database, date-only data model.
2. Pure prediction engine, validation, and unit tests before UI integration.
3. Short onboarding and home with a soft phase-colored cycle dial, week strip and one contextual action.
4. Calendar sheets, history correction, period/ovulation and diary editing.
5. Small insights view and settings with transactional backup/restore and explicit deletion confirmation.
6. Offline and update behavior, accessibility, mobile layout, integration/E2E tests, build and documentation.

## Design

Warm ivory, rich ink, restrained coral/peach/green/mauve. System typography, generous whitespace, a quiet circular cycle-day motif, compact bottom navigation, and native scrolling bottom-sheet forms. Color is reinforced with labels, shapes and actual/predicted treatments. First launch uses real onboarding; development fixtures never write demo data to IndexedDB.

## Validation

Run TypeScript, lint, focused tests and build at working milestones. Final pass includes production-browser interaction, offline launch, viewport checks and a documented manual iPhone Safari checklist.

## Completed

All six implementation stages are complete. TypeScript, lint, formatting, 72 unit/interaction tests, the three-timezone date matrix, 14 Chromium/WebKit browser tests and the production build pass. Actual offline server loss and automated accessibility checks pass in both browsers. Full results and the remaining physical-device/deployment checklist are in `docs/QA.md`. No deployment was created; the requested Git-connected Netlify configuration is ready.
