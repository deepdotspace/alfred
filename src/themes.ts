/**
 * Theme catalog — the theme this app ships with.
 *
 * Alfred ships a single house theme. To switch or add a theme: change
 * `data-theme` on <html> in index.html, and:
 *   1. Append a `[data-theme="my-id"] { ... }` block in src/themes.css
 *      with the shadcn token overrides. If it's a light theme, also
 *      include `color-scheme: light;` inside the block.
 *   2. Add an entry here for type safety, autocomplete, and UI display.
 *
 * Color values per theme live in src/themes.css — this file is metadata only.
 */

export const THEMES = [
  {
    id: 'alfred',
    label: 'Alfred',
    description: 'Cool periwinkle pastel with indigo accent. The Alfred house theme.',
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

/** Read the currently active theme id from <html data-theme>. */
export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return 'alfred'
  const id = document.documentElement.getAttribute('data-theme') as ThemeId | null
  return id ?? 'alfred'
}

/** Look up a theme entry by id, or fall back to the first theme. */
export function getTheme(id: string) {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}
