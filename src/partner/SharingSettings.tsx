import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import QRCode from 'qrcode';
import { ErrorMessage, Sheet } from '../components/Sheet';
import { PERMISSION_LABELS, type Permissions } from './protocol';
import { partnerDB, type PrimaryConnection } from './storage';
import { enableSharing, stopSharing, syncPrimary } from './service';
import { invitationLink } from './crypto';
import './partner.css';
import { SetupCodeCopy } from './SetupCodeCopy';
import { parseInvitation } from './crypto';

export default function SharingSettings({ demo = false }: { demo?: boolean }) {
  const [connection, setConnection] = useState<PrimaryConnection | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({
    current: false,
    period: false,
    fertility: false,
  });
  const [sheet, setSheet] = useState<'enable' | 'invite' | 'stop' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (demo) return;
    const sub = liveQuery(() => partnerDB.primary.get('primary')).subscribe({
      next: (c) => setConnection(c ?? null),
      error: () => setError('Sharing settings could not be opened. Please try again.'),
    });
    return () => sub.unsubscribe();
  }, [demo]);
  const link = connection
    ? invitationLink({
        version: 1,
        id: connection.id,
        invitation: connection.invitation,
        key: connection.key,
      })
    : '';
  useEffect(() => {
    let live = true;
    if (sheet === 'invite' && link)
      void QRCode.toDataURL(link, {
        errorCorrectionLevel: 'M',
        width: 360,
        margin: 3,
        color: { dark: '#342f35', light: '#ffffff' },
      })
        .then((url) => {
          if (live) setQr(url);
        })
        .catch(() => setError('Couldn’t draw the code. You can still copy the invitation link.'));
    return () => {
      live = false;
      setQr('');
    };
  }, [sheet, link]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const categories = (p: Permissions) => (
    <ul className="shared-categories">
      {(Object.keys(PERMISSION_LABELS) as (keyof Permissions)[])
        .filter((k) => p[k])
        .map((k) => (
          <li key={k}>{PERMISSION_LABELS[k]}</li>
        ))}
    </ul>
  );
  return (
    <section className="settings-section partner-sharing">
      <h2>Partner sharing</h2>
      {!demo && (
        <button className="text-button" onClick={() => location.assign('/partner/setup')}>
          Set up Partner View on this device
        </button>
      )}
      {demo ? (
        <p>Off in this demo. Sample information is never uploaded.</p>
      ) : !connection ? (
        <>
          <p>Sharing is off. No cycle updates are sent to a partner.</p>
          <p>Share selected cycle information with someone you trust. You stay in control.</p>
          <button className="secondary" onClick={() => setSheet('enable')}>
            Enable Partner Sharing
          </button>
        </>
      ) : (
        <>
          <strong>
            {connection.state === 'revoking'
              ? 'Stopping · waiting for confirmation'
              : connection.state === 'active'
                ? 'Active · Partner device'
                : 'Invitation pending'}
          </strong>
          {categories(connection.permissions)}
          <p className="small">
            {connection.lastSync
              ? `Last synced ${new Date(connection.lastSync).toLocaleString()}`
              : 'No successful sync yet.'}
          </p>
          {connection.error && (
            <p className="small" role="status">
              {connection.error}
            </p>
          )}
          <div className="sharing-buttons">
            <button
              className="secondary"
              disabled={busy || connection.state === 'revoking'}
              onClick={() => void action(() => syncPrimary(true))}
            >
              Sync now
            </button>
            {connection.state === 'pending' && (
              <button className="secondary" onClick={() => setSheet('invite')}>
                Add partner · Show invitation
              </button>
            )}
            <button className="text-button" disabled={busy} onClick={() => setSheet('stop')}>
              {connection.state === 'revoking' ? 'Retry stopping' : 'Stop sharing'}
            </button>
          </div>
          <p className="small">To change categories, stop sharing and create a new invitation.</p>
        </>
      )}
      {!sheet && <ErrorMessage message={error} />}
      <p role="status" className="small">
        {message}
      </p>
      {sheet === 'enable' && (
        <Sheet title="Share on your terms" onClose={() => !busy && setSheet(null)}>
          <div className="stack">
            <p>
              Selected information will be encrypted on this phone before the remote service stores it. Your
              partner can only read it. Your diary, symptoms, moods and ovulation notes are never shared.
            </p>
            <fieldset className="choice-list">
              <legend>Choose what to share</legend>
              {(Object.keys(PERMISSION_LABELS) as (keyof Permissions)[]).map((k) => (
                <label className="radio-choice" key={k}>
                  <input
                    type="checkbox"
                    checked={permissions[k]}
                    onChange={(e) => setPermissions((p) => ({ ...p, [k]: e.target.checked }))}
                  />
                  {PERMISSION_LABELS[k]}
                </label>
              ))}
            </fieldset>
            <p className="small">
              You can revoke future access. Information already received, copied or screenshotted cannot
              necessarily be erased from someone else’s device.
            </p>
            <ErrorMessage message={error} />
            <button
              className="primary"
              disabled={busy || !Object.values(permissions).some(Boolean)}
              onClick={() =>
                void action(async () => {
                  await enableSharing(permissions);
                  setSheet('invite');
                })
              }
            >
              {busy ? 'Preparing…' : 'Confirm and create invitation'}
            </button>
          </div>
        </Sheet>
      )}
      {sheet === 'invite' && connection && (
        <Sheet title="Share Rayang" onClose={() => setSheet(null)}>
          <div className="stack">
            <p>
              Scan this code with the person you trust. Keep this invitation private: the first person to
              accept receives access.
            </p>
            {qr && (
              <img
                className="pairing-qr"
                src={qr}
                alt="Partner invitation QR code. Use Copy pairing link as an alternative."
              />
            )}
            <p className="small">
              Invitation expires{' '}
              {connection.invitationExpiresAt
                ? new Date(connection.invitationExpiresAt).toLocaleTimeString()
                : 'in ten minutes'}
              . It can pair one partner device.
            </p>
            <div>
              <strong>Only these categories are shared</strong>
              {categories(connection.permissions)}
            </div>
            <button
              className="primary"
              onClick={() =>
                void action(async () => {
                  await navigator.clipboard.writeText(link);
                  setMessage('Pairing link copied. Share it privately.');
                })
              }
            >
              Copy pairing link
            </button>
            <details>
              <summary>Show equivalent pairing link</summary>
              <label htmlFor="private-pairing-link">Private pairing link</label>
              <textarea
                id="private-pairing-link"
                readOnly
                value={link}
                rows={3}
                onFocus={(e) => e.target.select()}
              />
            </details>
            <p className="small">
              Send the invitation link to your partner. They can use the setup code to finish inside Rayang
              from their Home Screen.
            </p>
            <SetupCodeCopy invite={parseInvitation(new URL(link).hash)} />
            <ErrorMessage message={error} />
            <p role="status" className="small">
              {message}
            </p>
          </div>
        </Sheet>
      )}
      {sheet === 'stop' && (
        <Sheet title="Stop Partner Sharing?" onClose={() => !busy && setSheet(null)}>
          <div className="stack">
            <p>
              This stops future synchronization after the service confirms revocation. It cannot erase
              information already received or copied. If you’re offline, stopping will remain pending until
              you reconnect.
            </p>
            <ErrorMessage message={error} />
            <button
              className="danger-button"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await stopSharing();
                  setSheet(null);
                  setMessage('Partner access has stopped.');
                })
              }
            >
              {busy ? 'Stopping…' : 'Confirm stop sharing'}
            </button>
            <button className="secondary" disabled={busy} onClick={() => setSheet(null)}>
              {connection?.state === 'revoking' ? 'Close this message' : 'Keep sharing'}
            </button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
