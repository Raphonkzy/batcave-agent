import { useState, type FormEvent } from 'react'
import { accessRequest, downloadCode, generateCode, type AccessStatus } from '../access.ts'
import { formatDateTime } from '../format.ts'
import { PageTitle } from '../ui.tsx'
import { ProfileLockSettings } from './ProfileLockSettings.tsx'

type Mode = 'idle' | 'set' | 'off'
type CodeKind = 'generated' | 'custom'

function CodeField({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete?: string }) {
  const [show, setShow] = useState(false)
  return <div>
    <label className="field-label" htmlFor={id}>{label}</label>
    <div className="code-input-row">
      <input id={id} className="text-input" type={show ? 'text' : 'password'} autoComplete={autoComplete} spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)}/>
      <button type="button" className="refresh-button" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'HIDE' : 'SHOW'}</button>
    </div>
  </div>
}

function CodeSetup({ status, onDone, onCancel }: { status: AccessStatus; onDone: (status: AccessStatus) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<CodeKind>('generated')
  const [generated, setGenerated] = useState(() => generateCode())
  const [custom, setCustom] = useState('')
  const [confirm, setConfirm] = useState('')
  const [current, setCurrent] = useState('')
  const [saved, setSaved] = useState(false)
  const [remember, setRemember] = useState(true)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const code = kind === 'generated' ? generated : custom.trim()
  const customProblem = kind === 'custom' && (
    custom.trim().length < status.minLength ? `At least ${status.minLength} characters.`
      : custom.trim() !== confirm.trim() ? 'The two codes do not match.' : undefined
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      setError('Could not copy to the clipboard. Download the .txt file instead.')
    }
  }

  const changeCode = (updater: () => void) => { updater(); setSaved(false); setCopied(false); setError(undefined) }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (customProblem) { setError(customProblem); return }
    if (!saved) { setError('Tick the box to confirm you have saved this code.'); return }
    if (status.enabled && !current.trim()) { setError('Enter the current access code.'); return }
    setBusy(true)
    setError(undefined)
    const result = await accessRequest('code', { code, currentCode: current, remember })
    setBusy(false)
    if (result.ok) onDone(result.status); else setError(result.message)
  }

  return <form className="access-setup" onSubmit={submit}>
    <div className="tab-strip" role="tablist" aria-label="Kind of code">
      <button type="button" role="tab" aria-selected={kind === 'generated'} className={kind === 'generated' ? 'active' : ''} onClick={() => changeCode(() => setKind('generated'))}>Generate</button>
      <button type="button" role="tab" aria-selected={kind === 'custom'} className={kind === 'custom' ? 'active' : ''} onClick={() => changeCode(() => setKind('custom'))}>Custom</button>
    </div>
    {kind === 'generated'
      ? <div className="generated-code"><code aria-label="Generated access code">{generated}</code><button type="button" className="refresh-button" onClick={() => changeCode(() => setGenerated(generateCode()))}>↻ ANOTHER</button></div>
      : <><CodeField id="custom-code" label="New access code" value={custom} onChange={(value) => changeCode(() => setCustom(value))} autoComplete="new-password"/>
        <CodeField id="confirm-code" label="Repeat the new code" value={confirm} onChange={setConfirm} autoComplete="new-password"/>
        <p className="small-note">At least {status.minLength} characters. Spaces at the start and end are ignored.</p></>}
    <p className="muted">Batcave has no password reset, so keep a copy of the code. It is only shown here, while you set it.</p>
    <div className="access-actions">
      <button type="button" className="refresh-button" onClick={() => downloadCode(code)} disabled={Boolean(customProblem) || !code}>⬇ DOWNLOAD .TXT</button>
      <button type="button" className="refresh-button" onClick={() => void copy()} disabled={Boolean(customProblem) || !code}>{copied ? '✓ COPIED' : 'COPY'}</button>
    </div>
    {status.enabled && <CodeField id="current-code" label="Current access code" value={current} onChange={setCurrent} autoComplete="current-password"/>}
    <label className="check-label"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)}/> I have saved this code (downloaded or copied)</label>
    <label className="check-label"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}/> Remember this device for {status.rememberDays} days</label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="access-actions">
      <button type="submit" className="primary-button" disabled={!saved || busy}>{busy ? 'Saving…' : status.enabled ? 'Save new code' : 'Turn on access code'}</button>
      <button type="button" className="refresh-button" onClick={onCancel}>CANCEL</button>
    </div>
  </form>
}

function TurnOff({ onDone, onCancel }: { onDone: (status: AccessStatus) => void; onCancel: () => void }) {
  const [current, setCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!current.trim()) { setError('Enter the current access code.'); return }
    setBusy(true)
    const result = await accessRequest('disable', { currentCode: current })
    setBusy(false)
    if (result.ok) onDone(result.status); else setError(result.message)
  }
  return <form className="access-setup" onSubmit={submit}>
    <p className="muted">Anyone who can open this address will see Batcave without a code.</p>
    <CodeField id="disable-code" label="Current access code" value={current} onChange={setCurrent} autoComplete="current-password"/>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="access-actions"><button type="submit" className="primary-button danger" disabled={busy}>{busy ? 'Turning off…' : 'Turn off access code'}</button><button type="button" className="refresh-button" onClick={onCancel}>CANCEL</button></div>
  </form>
}

export function Settings({ access, onAccessChange }: { access: AccessStatus | undefined; onAccessChange: (status: AccessStatus) => void }) {
  const [mode, setMode] = useState<Mode>('idle')
  const [message, setMessage] = useState<string>()
  const done = (text: string) => (status: AccessStatus) => { setMode('idle'); setMessage(text); onAccessChange(status) }
  const lock = async () => {
    const result = await accessRequest('lock')
    if (result.ok) onAccessChange(result.status)
  }
  return <><PageTitle eyebrow="BATCAVE" title="Settings">Settings of this Batcave server. Hermes itself stays read-only.</PageTitle>
    <section className="card settings-card" aria-labelledby="access-title">
      <div className="settings-head"><div><p className="eyebrow">SECURITY</p><h2 id="access-title">Access code</h2></div>{access && <span className={`badge ${access.enabled ? 'good' : 'muted'}`}>{access.enabled ? 'On' : 'Off'}</span>}</div>
      <p className="muted">Ask for a code every time Batcave is opened in a browser. Like an API key: you generate (or choose) it once, download it, and enter it when asked. Only a hash is stored on the server.</p>
      {!access ? <p className="muted">Loading…</p> : <>
        {access.enabled && access.since && <p className="small-note">Set {formatDateTime(access.since)}.</p>}
        {message && mode === 'idle' && <p className="form-success" role="status">{message}</p>}
        {mode === 'idle' && <div className="access-actions">
          {access.enabled
            ? <><button type="button" className="primary-button" onClick={() => { setMessage(undefined); setMode('set') }}>Change code</button><button type="button" className="refresh-button" onClick={() => { setMessage(undefined); setMode('off') }}>TURN OFF</button><button type="button" className="refresh-button" onClick={() => void lock()}>LOCK THIS BROWSER</button></>
            : <button type="button" className="primary-button" onClick={() => { setMessage(undefined); setMode('set') }}>Set up access code</button>}
        </div>}
        {mode === 'set' && <CodeSetup status={access} onDone={done(access.enabled ? 'New access code saved. Other browsers have been signed out.' : 'Access code is on. Other browsers now need the code.')} onCancel={() => setMode('idle')}/>}
        {mode === 'off' && <TurnOff onDone={done('Access code is off.')} onCancel={() => setMode('idle')}/>}
        <p className="small-note">Lost the code? On the machine that runs Batcave, run <code>batcave access-code off</code> (or <code>batcave access-code new</code> for a new random code).</p>
      </>}
    </section>
    <ProfileLockSettings/>
  </>
}
