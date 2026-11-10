import { useState, type FormEvent } from 'react'
import { accessRequest, downloadCode, generateCode, type AccessStatus } from '../access.ts'
import { formatDateTime } from '../format.ts'
import { ProfileLockSettings } from './ProfileLockSettings.tsx'
import { Pill } from '../components/ui/Primitives.tsx'

type Mode = 'idle' | 'set' | 'off'
type CodeKind = 'generated' | 'custom'

function CodeField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="mo-form-field">
      <label className="mo-field-label" htmlFor={id}>
        {label}
      </label>
      <div className="mo-code-input-row">
        <input
          id={id}
          className="mo-text-input font-mono"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="mo-btn mo-btn-ghost mo-btn-sm"
          onClick={() => setShow(!show)}
          aria-pressed={show}
        >
          {show ? 'SEMBUNYIKAN' : 'LIHAT'}
        </button>
      </div>
    </div>
  )
}

function CodeSetup({
  status,
  onDone,
  onCancel,
}: {
  status: AccessStatus
  onDone: (status: AccessStatus) => void
  onCancel: () => void
}) {
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
  const customProblem =
    kind === 'custom' &&
    (custom.trim().length < status.minLength
      ? `Minimal ${status.minLength} karakter.`
      : custom.trim() !== confirm.trim()
      ? 'Kedua kode tidak cocok.'
      : undefined)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    } catch {
      setError('Gagal menyalin ke clipboard. Silakan unduh file .txt.')
    }
  }

  const changeCode = (updater: () => void) => {
    updater()
    setSaved(false)
    setCopied(false)
    setError(undefined)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (customProblem) {
      setError(customProblem)
      return
    }
    if (!saved) {
      setError('Centang kotak konfirmasi penyimpanan kode.')
      return
    }
    if (status.enabled && !current.trim()) {
      setError('Masukkan access code saat ini.')
      return
    }
    setBusy(true)
    setError(undefined)
    const result = await accessRequest('code', { code, currentCode: current, remember })
    setBusy(false)
    if (result.ok) onDone(result.status)
    else setError(result.message)
  }

  return (
    <form className="mo-access-setup-form" onSubmit={submit}>
      <div className="mo-segmented" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`mo-segmented-item ${kind === 'generated' ? 'active' : ''}`}
          onClick={() => changeCode(() => setKind('generated'))}
        >
          Generate Otomatis
        </button>
        <button
          type="button"
          className={`mo-segmented-item ${kind === 'custom' ? 'active' : ''}`}
          onClick={() => changeCode(() => setKind('custom'))}
        >
          Kustom
        </button>
      </div>

      {kind === 'generated' ? (
        <div className="mo-generated-box">
          <code className="mo-code-display font-mono">{generated}</code>
          <button
            type="button"
            className="mo-btn mo-btn-ghost mo-btn-sm"
            onClick={() => changeCode(() => setGenerated(generateCode()))}
          >
            ↻ ACAK LAGI
          </button>
        </div>
      ) : (
        <>
          <CodeField
            id="custom-code"
            label="Access code baru"
            value={custom}
            onChange={(val) => changeCode(() => setCustom(val))}
            autoComplete="new-password"
          />
          <CodeField
            id="confirm-code"
            label="Ulangi access code"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
        </>
      )}

      <div className="mo-button-row" style={{ marginTop: 12, marginBottom: 16 }}>
        <button
          type="button"
          className="mo-btn mo-btn-ghost mo-btn-sm"
          onClick={() => downloadCode(code)}
          disabled={Boolean(customProblem) || !code}
        >
          ⬇ Unduh .TXT
        </button>
        <button
          type="button"
          className="mo-btn mo-btn-ghost mo-btn-sm"
          onClick={() => void copy()}
          disabled={Boolean(customProblem) || !code}
        >
          {copied ? '✓ TERSALIN' : 'SALIN'}
        </button>
      </div>

      {status.enabled && (
        <CodeField
          id="current-code"
          label="Access code saat ini"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
      )}

      <div className="mo-checkbox-group">
        <label className="mo-check-label">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          <span>Saya sudah menyimpan kode ini (unduh atau salin)</span>
        </label>
        <label className="mo-check-label">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Ingat browser ini selama {status.rememberDays} hari</span>
        </label>
      </div>

      {error && <p className="mo-form-error text-bad font-mono">{error}</p>}

      <div className="mo-button-row" style={{ marginTop: 16 }}>
        <button type="submit" className="mo-btn mo-btn-primary" disabled={!saved || busy}>
          {busy ? 'Menyimpan…' : status.enabled ? 'Simpan Kode Baru' : 'Aktifkan Access Code'}
        </button>
        <button type="button" className="mo-btn mo-btn-ghost" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  )
}

function TurnOff({
  onDone,
  onCancel,
}: {
  onDone: (status: AccessStatus) => void
  onCancel: () => void
}) {
  const [current, setCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!current.trim()) {
      setError('Masukkan access code saat ini.')
      return
    }
    setBusy(true)
    const result = await accessRequest('disable', { currentCode: current })
    setBusy(false)
    if (result.ok) onDone(result.status)
    else setError(result.message)
  }

  return (
    <form className="mo-access-setup-form" onSubmit={submit}>
      <p className="text-muted">Siapa pun yang membuka tautan Batcave dapat mengakses tanpa sandi.</p>
      <CodeField
        id="disable-code"
        label="Access code saat ini"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      {error && <p className="mo-form-error text-bad font-mono">{error}</p>}
      <div className="mo-button-row" style={{ marginTop: 16 }}>
        <button type="submit" className="mo-btn mo-btn-primary" disabled={busy}>
          {busy ? 'Menonaktifkan…' : 'Nonaktifkan Access Code'}
        </button>
        <button type="button" className="mo-btn mo-btn-ghost" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  )
}

export function Settings({
  access,
  onAccessChange,
}: {
  access: AccessStatus | undefined
  onAccessChange: (status: AccessStatus) => void
}) {
  const [mode, setMode] = useState<Mode>('idle')
  const [message, setMessage] = useState<string>()

  const done = (text: string) => (status: AccessStatus) => {
    setMode('idle')
    setMessage(text)
    onAccessChange(status)
  }

  const lock = async () => {
    const result = await accessRequest('lock')
    if (result.ok) onAccessChange(result.status)
  }

  return (
    <div className="mo-page-settings">
      <div className="mo-settings-narrow-col">
        <header className="mo-page-header">
          <h1 className="mo-page-title">Settings</h1>
          <p className="mo-page-description">
            Konfigurasi keamanan workstation Batcave. Mesin Hermes tetap beroperasi secara read-only.
          </p>
        </header>

        {/* Section 1: Access Code Hairline Row */}
        <section className="mo-settings-section">
          <div className="mo-section-row-head">
            <div>
              <div className="mo-section-eyebrow">KEAMANAN WORKSTATION</div>
              <h2 className="mo-section-heading">Access Code</h2>
            </div>
            {access && (
              <Pill variant={access.enabled ? 'accent' : 'muted'}>
                {access.enabled ? 'Aktif' : 'Nonaktif'}
              </Pill>
            )}
          </div>

          <p className="mo-section-desc">
            Perlindungan sandi saat membuka Batcave di browser. Kunci diverifikasi secara lokal melalui hashing kriptografis.
          </p>

          {!access ? (
            <p className="text-muted">Memuat status keamanan…</p>
          ) : (
            <>
              {access.enabled && access.since && (
                <div className="mo-section-since font-mono text-muted">
                  Aktif sejak: {formatDateTime(access.since)}
                </div>
              )}
              {message && mode === 'idle' && (
                <div className="mo-notice-box good font-mono">{message}</div>
              )}

              {mode === 'idle' && (
                <div className="mo-button-row" style={{ marginTop: 16 }}>
                  {access.enabled ? (
                    <>
                      <button
                        type="button"
                        className="mo-btn mo-btn-primary mo-btn-sm"
                        onClick={() => {
                          setMessage(undefined)
                          setMode('set')
                        }}
                      >
                        Change code
                      </button>
                      <button
                        type="button"
                        className="mo-btn mo-btn-ghost mo-btn-sm"
                        onClick={() => {
                          setMessage(undefined)
                          setMode('off')
                        }}
                      >
                        Turn off
                      </button>
                      <button
                        type="button"
                        className="mo-btn mo-btn-ghost mo-btn-sm"
                        onClick={() => void lock()}
                      >
                        LOCK THIS BROWSER
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="mo-btn mo-btn-primary mo-btn-sm"
                      onClick={() => {
                        setMessage(undefined)
                        setMode('set')
                      }}
                    >
                      Set up access code
                    </button>
                  )}
                </div>
              )}

              {mode === 'set' && (
                <CodeSetup
                  status={access}
                  onDone={done(
                    access.enabled
                      ? 'Access code berhasil diperbarui.'
                      : 'Access code telah aktif.'
                  )}
                  onCancel={() => setMode('idle')}
                />
              )}

              {mode === 'off' && (
                <TurnOff onDone={done('Access code dinonaktifkan.')} onCancel={() => setMode('idle')} />
              )}
            </>
          )}
        </section>

        {/* Section 2: Profile Lock PIN */}
        <section className="mo-settings-section">
          <ProfileLockSettings />
        </section>
      </div>
    </div>
  )
}
