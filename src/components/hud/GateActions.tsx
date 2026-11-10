export function GateActions({ open, moving, onToggle, onFocus, onClose }: {
  open: boolean
  moving: boolean
  onToggle: () => void
  onFocus: () => void
  onClose: () => void
}) {
  const status = moving ? open ? 'Opening' : 'Closing' : open ? 'Open' : 'Closed'
  return <section className="mo-context-panel" aria-label="Estate gate actions" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose() }
  }}>
    <button className="mo-hud-btn" aria-label="Close gate actions" onClick={onClose}>Close</button>
    <h3>Estate entrance gate</h3>
    <p role="status">Gate · {status}</p>
    <div className="mo-context-actions">
      <button className="mo-hud-btn" aria-pressed={open} onClick={onToggle}>{open ? 'Close estate gate' : 'Open estate gate'}</button>
      <button className="mo-hud-btn" onClick={onFocus}>Focus gate</button>
    </div>
    <small>Scene-session architectural control. Vehicle navigation and pedestrian collision are not simulated at this boundary.</small>
  </section>
}
