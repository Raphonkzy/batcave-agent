import { useEffect, useRef, useState, type FormEvent } from 'react'
import { accessRequest, type AccessStatus } from './access.ts'
import { BatMark } from './components/ui/BatMark.tsx'

export function LockScreen({
  status,
  onUnlocked,
}: {
  status: AccessStatus
  onUnlocked: (status: AccessStatus) => void
}) {
  const [code, setCode] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Locked · Batcave'
    input.current?.focus()
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim()) {
      setError('Enter the access code.')
      return
    }
    setBusy(true)
    setError(undefined)
    const result = await accessRequest('unlock', { code, remember })
    setBusy(false)
    if (result.ok) {
      onUnlocked(result.status)
      return
    }
    setError(result.message)
    input.current?.select()
  }

  return (
    <main className="mo-lock-screen">
      <form className="mo-lock-container" onSubmit={submit} aria-labelledby="lock-title">
        <div className="mo-lock-brand">
          <BatMark size={40} />
          <span className="mo-brand-text">batcave</span>
        </div>

        <h1 id="lock-title" className="mo-lock-heading">Enter access code</h1>
        <p className="mo-lock-subtitle text-muted">
          This Batcave is protected with an access code.
        </p>

        <div className="mo-lock-field-row">
          <input
            ref={input}
            id="access-code"
            className="mo-lock-input font-mono"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            spellCheck={false}
            placeholder="••••••••••••"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
          <button
            type="button"
            className="mo-btn mo-btn-ghost mo-btn-sm"
            onClick={() => setShow(!show)}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="mo-lock-options">
          <label className="mo-check-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember this device for {status.rememberDays} days</span>
          </label>
        </div>

        {error && <p className="mo-form-error text-bad font-mono">{error}</p>}

        <button type="submit" className="mo-btn mo-btn-primary mo-btn-lg mo-btn-block" disabled={busy}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>

        <p className="mo-lock-footer text-muted font-mono">
          Lost the code? On the machine that runs Batcave, run <code>batcave access-code off</code>.
        </p>
      </form>
    </main>
  )
}
