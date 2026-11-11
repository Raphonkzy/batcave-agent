/**
 * True when a dialog the user can actually reach is open. A page kept alive but hidden is marked
 * `inert`, so its dialogs (and any left open there) do not count and cannot block shortcuts.
 */
export function hasOpenDialog(): boolean {
  return Array.from(document.querySelectorAll('[role="dialog"]')).some((dialog) => !dialog.closest('[inert]'))
}
