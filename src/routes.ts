export const navigation = ['Batcave', 'Missions', 'Agents', 'Usage', 'Task Board', 'Calendar', 'Activity', 'Memory', 'Folders', 'Logs', 'Settings'] as const
export type Page = typeof navigation[number]

/** The page shown when the address names no page (or an unknown one). */
export const HOME: Page = 'Batcave'

export function pageSlug(page: Page): string {
  return page.toLowerCase().replace(/\s+/g, '-')
}

export function pageFromHash(hash: string): Page {
  const slug = hash.replace(/^#\/?/, '').split('/')[0].toLowerCase()
  if (slug === 'knowledge') return 'Memory'
  // Backward compatibility: alias dashboard and office to Batcave.
  if (slug === 'dashboard' || slug === 'office') return 'Batcave'
  return navigation.find((page) => pageSlug(page) === slug) ?? HOME
}
