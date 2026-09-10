import { useEffect, useState } from 'react';
import { db } from '../db/database';
import { ErrorMessage } from '../components/Sheet';
import { UpdateNotice } from '../components/UpdateNotice';
import { parseInvitation } from './crypto';
import { isStandalone } from './display-mode';
import { INVALID_SETUP, parseSetupCode } from './setup-code';
import { SetupCodeCopy } from './SetupCodeCopy';
import { acceptInvitation, previewInvitation, refreshPartner } from './service';
import { partnerDB } from './storage';
import { PartnerError } from './api';
import { PERMISSION_LABELS, type Invitation, type Snapshot } from './protocol';
import './partner.css';

function setupError(error: unknown) {
  if (error instanceof PartnerError) {
    if (error.reason === 'unavailable') return 'This partner connection is no longer available.';
    if (error.reason === 'invalid')
      return "We couldn't open this shared cycle. Ask your partner to create a new invitation.";
    return "Couldn't connect. Connect to the internet to finish Partner View setup.";
  }
  return 'Couldn’t finish setup. Your existing data is unchanged. Try again.';
}
export default function PartnerSetup({ fragment }: { fragment?: string }) {
  const [standalone] = useState(isStandalone);
  const [invite, setInvite] = useState<Invitation | null>(() => {
    try {
      return fragment ? parseInvitation(fragment) : null;
    } catch {
      return null;
    }
  });
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<Snapshot | null>(null);
  const [error, setError] = useState(fragment && !invite ? INVALID_SETUP : '');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasPrimary, setHasPrimary] = useState(false);
  const [ack, setAck] = useState(false);
  const [existing, setExisting] = useState(false);
  useEffect(() => {
    // Browser setup is also an installation page: keep its visible URL at the stable manifest root.
    if (!standalone && location.pathname !== '/') history.replaceState(null, '', '/');
  }, [standalone]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const primary = await db.transaction('r', db.tables, async () =>
        (await Promise.all(db.tables.map((t) => t.count()))).some(Boolean),
      );
      const partner = !!(await partnerDB.partner.get('partner'));
      if (alive) {
        setHasPrimary(primary);
        setExisting(partner);
        setReady(true);
      }
    })().catch(() => {
      if (alive)
        setError('Device storage could not be opened. Check browser storage permissions and try again.');
    });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!invite) return;
    let alive = true;
    // Preview never claims or persists a relationship. Browser mode only offers the portable code.
    void (async () => {
      // A locally saved claimant can resume after an acknowledgment was lost. Its invitation may already be used.
      if (standalone && (await partnerDB.partner.get('partner'))?.id === invite.id) return null;
      return previewInvitation(invite);
    })()
      .then((value) => {
        if (alive) setPreview(value);
      })
      .catch((err) => {
        if (alive) setError(setupError(err));
      });
    return () => {
      alive = false;
    };
  }, [invite, standalone]);
  async function accept() {
    if (!invite || !ready || (hasPrimary && !ack)) return;
    setBusy(true);
    setError('');
    try {
      if (!navigator.onLine) {
        setError("You're offline. Connect to the internet to finish Partner View setup.");
        return;
      }
      const current = await partnerDB.partner.get('partner');
      if (current && current.id !== invite.id) {
        setError(
          'This device already has Partner View. Open it and disconnect before using another invitation.',
        );
        return;
      }
      // Validate/decrypt before a first claim. A persisted claimant retries directly after a lost response.
      if (!current) await previewInvitation(invite);
      if (current) await refreshPartner();
      else await acceptInvitation(invite);
      await partnerDB.preferences.put({ id: 'role', value: 'partner' });
      setCode('');
      setInvite(null);
      setPreview(null);
      location.replace('/partner');
    } catch (err) {
      setError(setupError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell partner-shell">
      <main className="page stack partner-setup">
        <header className="brand">
          <span className="brand-mark" aria-hidden="true">
            r.
          </span>
          rayang
        </header>
        <p className="eyebrow">Partner setup</p>
        <h1>{!standalone ? 'Rayang works best from your Home Screen.' : 'Continue Partner Setup'}</h1>
        {!standalone && (
          <>
            <p>To keep Partner View available from your Home Screen, finish setup inside the Rayang app.</p>
            <ol className="setup-steps">
              <li>Add Rayang if you haven’t already: in Safari, tap Share → Add to Home Screen → Add.</li>
              <li>Copy your secure setup code below.</li>
              <li>Open Rayang from your Home Screen.</li>
              <li>Choose “I have a partner setup code” and paste it.</li>
            </ol>
            <p className="small">
              You’re at the root Rayang app. Adding it does not save an invitation bookmark. If Rayang is
              already installed, open that app; no reinstall is needed.
            </p>
          </>
        )}
        {preview && (
          <section>
            <h2>Shared with you</h2>
            <ul>
              {(Object.keys(PERMISSION_LABELS) as (keyof typeof PERMISSION_LABELS)[])
                .filter((k) => preview.permissions[k])
                .map((k) => (
                  <li key={k}>{PERMISSION_LABELS[k]}</li>
                ))}
            </ul>
            <p className="small">Read only. Diary, symptoms and private notes are not shared.</p>
          </section>
        )}
        {hasPrimary && (standalone || existing) && (
          <div className="soft-note">
            <p>
              Your own cycle history is already on this device. Partner View uses a separate local context.
              Your history will stay unchanged; you can return to it from Partner Settings.
            </p>
            <label className="radio-choice">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              Keep my history and open Partner View
            </label>
          </div>
        )}
        {!invite ? (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setBusy(true);
              try {
                setInvite(await parseSetupCode(code));
              } catch {
                setError(INVALID_SETUP);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="partner-setup-input">Partner setup code</label>
            <textarea
              id="partner-setup-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={4}
              maxLength={1200}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <button className="primary" disabled={busy || !code.trim()}>
              Continue
            </button>
          </form>
        ) : !standalone ? (
          <SetupCodeCopy invite={invite} />
        ) : (
          <>
            <button
              className="primary"
              disabled={busy || !ready || (hasPrimary && !ack)}
              onClick={() => void accept()}
            >
              {busy ? 'Connecting…' : 'Accept Partner View'}
            </button>
            <p className="small">
              After setup, delete any saved copy of the code and replace it in your clipboard. Rayang won’t
              clear your clipboard automatically.
            </p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setInvite(null);
                setCode('');
                setPreview(null);
                setError('');
              }}
            >
              Use a different code
            </button>
          </>
        )}
        <ErrorMessage message={error} />
        {existing && (
          <button
            className="secondary"
            disabled={hasPrimary && !ack}
            onClick={() => location.assign('/partner')}
          >
            Open existing Partner View
          </button>
        )}
        <button
          className="text-button"
          disabled={busy}
          onClick={() => {
            location.replace('/#primary');
            location.reload();
          }}
        >
          Back to Rayang
        </button>
        {!standalone && (
          <p className="small">
            Keep this page open until you’ve copied the code. If it reloads, reopen your original invitation.
            Opening here does not use up the invitation.
          </p>
        )}
      </main>
      <UpdateNotice formOpen />
    </div>
  );
}
