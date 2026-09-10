import { useEffect, useState } from 'react';
import { createSetupCode } from './setup-code';
import type { Invitation } from './protocol';
export function SetupCodeCopy({ invite }: { invite: Invitation }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    void createSetupCode(invite)
      .then((value) => {
        if (alive) setCode(value);
      })
      .catch(() => {
        if (alive) setMessage('Couldn’t prepare this setup code. Reopen the invitation and try again.');
      });
    return () => {
      alive = false;
    };
  }, [invite]);
  return (
    <div className="stack">
      <button
        className="primary"
        disabled={!code}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setMessage('Setup code copied. Keep it private until pairing is complete.');
          } catch {
            setMessage('Copy isn’t available here. Open “Show setup code” below and copy it manually.');
          }
        }}
      >
        Copy setup code
      </button>
      <p className="small">
        Keep this setup code private. Anyone with it may be able to access the shared cycle. It expires with
        the invitation.
      </p>
      <details>
        <summary>Show setup code</summary>
        <label htmlFor="portable-setup-code">Private setup code</label>
        <textarea
          id="portable-setup-code"
          readOnly
          value={code}
          rows={4}
          spellCheck={false}
          autoComplete="off"
          onFocus={(e) => e.target.select()}
        />
      </details>
      <p role="status" className="small">
        {message}
      </p>
    </div>
  );
}
