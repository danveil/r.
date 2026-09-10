import { StrictMode, Component, lazy, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import type { AppData } from './types';
import type { Snapshot } from './partner/protocol';
import { partnerDB } from './partner/storage';
const PartnerView = lazy(() => import('./partner/PartnerView'));
const PartnerSetup = lazy(() => import('./partner/PartnerSetup'));
// Fragment material is captured in memory and removed before asynchronous work or rendering.
const invitationFragment =
  location.pathname === '/partner' && location.hash.startsWith('#invite=') ? location.hash : undefined;
// Keep the fragment in this mount's memory so a usable code remains available, but install from the stable root.
if (invitationFragment) history.replaceState(null, '', '/');
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="recovery-page stack">
        <h1>Let’s try that again.</h1>
        <p>Something interrupted the app. Your saved history has not been deleted.</p>
        <button className="primary" onClick={() => location.reload()}>
          Reopen Rayang
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
async function start() {
  let partnerRole = location.pathname === '/partner';
  try {
    partnerRole ||= location.hash !== '#primary' && !!(await partnerDB.preferences.get('role'));
  } catch {
    /* The primary app presents its own storage recovery screen. */
  }
  let demoData: AppData | undefined;
  let demoSnapshot: Snapshot | undefined;
  let demoStatus: string | undefined;
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { demoFixture } = await import('./test/fixtures');
    demoData = demoFixture(new URLSearchParams(location.search).get('demo') ?? 'fertile');
  }
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('partner-demo')) {
    demoStatus = new URLSearchParams(location.search).get('partner-demo') || 'fertile';
    const { partnerFixture } = await import('./test/partner-fixtures');
    demoSnapshot = partnerFixture(demoStatus);
    partnerRole = true;
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        {(invitationFragment || location.pathname === '/partner/setup') && !demoData && !demoStatus ? (
          <Suspense fallback={<main className="loading-page">Opening Partner Setup…</main>}>
            <PartnerSetup fragment={invitationFragment} />
          </Suspense>
        ) : partnerRole && !demoData ? (
          <Suspense fallback={<main className="loading-page">Opening Partner View…</main>}>
            <PartnerView demoSnapshot={demoSnapshot} demoStatus={demoStatus} />
          </Suspense>
        ) : (
          <App demoData={demoData} />
        )}
      </ErrorBoundary>
    </StrictMode>,
  );
}
void start();
