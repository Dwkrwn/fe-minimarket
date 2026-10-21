import type { App } from 'vue'
import * as Lucide from 'lucide-vue-next'

export function registerLucide(app: App) {
  // Avoid double registration on HMR/hot reload
  const g = globalThis as any
  if (!g.__LUCIDE_COMPONENTS__) g.__LUCIDE_COMPONENTS__ = new Set<string>()
  const registered: Set<string> = g.__LUCIDE_COMPONENTS__

  // Some exports are utilities/generic, skip those explicitly
  const blacklist = new Set([
    'createLucideIcon',
    'Icon', // generic icon component which requires special props
  ])

  for (const [name, component] of Object.entries(Lucide)) {
    if (blacklist.has(name)) continue
    const type = typeof component
    if (type !== 'object' && type !== 'function') continue

    // Register with original name
    if (!registered.has(name)) {
      app.component(name, component as any)
      registered.add(name)
    }

    // Register with prefixed name
    const prefixed = `Lucide${name}`
    if (!registered.has(prefixed)) {
      app.component(prefixed, component as any)
      registered.add(prefixed)
    }
  }
}

export type LucideIconName = Exclude<keyof typeof Lucide, 'createLucideIcon'>
export const lucideIconNames: string[] = Object.keys(Lucide).filter((k) => k !== 'createLucideIcon' && k !== 'Icon')
