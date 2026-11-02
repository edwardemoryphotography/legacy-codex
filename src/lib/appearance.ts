export const APPEARANCE_KEY = 'codex_appearance_v1'
export const PALETTES = {
  aurora: { label: 'Aurora', primary: '#6A5CFF', secondary: '#22D3BE', accent: '#22D3BE', lightAccent: '#07695F' },
  ocean: { label: 'Ocean', primary: '#2462D9', secondary: '#35D9EF', accent: '#35D9EF', lightAccent: '#075E78' },
  forest: { label: 'Forest', primary: '#14835E', secondary: '#A0E6B0', accent: '#A0E6B0', lightAccent: '#145E37' },
  // Warm material is decoration, never an Ember state/event or transfer claim.
  sunset: { label: 'Sunset', primary: '#BA4935', secondary: '#E2BC76', accent: '#F2B9A5', lightAccent: '#873A29' },
} as const
export type Appearance = { palette: keyof typeof PALETTES; mode: 'dark' | 'light'; glow: number; motion: 'full' | 'soft' | 'reduced' }
export const DEFAULT_APPEARANCE: Appearance = { palette: 'aurora', mode: 'dark', glow: 0.65, motion: 'full' }
export function normalizeAppearance(value: unknown): Appearance {
  const v = value && typeof value === 'object' ? value as Partial<Appearance> : {}
  return {
    palette: typeof v.palette === 'string' && Object.hasOwn(PALETTES, v.palette) ? v.palette : 'aurora',
    mode: v.mode === 'light' ? 'light' : 'dark',
    glow: typeof v.glow === 'number' && Number.isFinite(v.glow) ? Math.max(0, Math.min(1, v.glow)) : 0.65,
    motion: v.motion === 'soft' || v.motion === 'reduced' ? v.motion : 'full',
  }
}
export function applyAppearance(value: Appearance) {
  const root = document.documentElement
  root.dataset.palette = value.palette
  root.dataset.motion = value.motion
  if (value.mode === 'light') root.dataset.theme = 'light'
  else delete root.dataset.theme
  root.style.setProperty('--ambient-glow', String(value.glow))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value.mode === 'light' ? '#F4F5FA' : '#0D0F22')
}
/** Same validation/application at boot and at runtime, with no host restriction. */
export const APPEARANCE_BOOT_SCRIPT = `(()=>{try{var p=JSON.parse(localStorage.getItem('codex_appearance_v1')||'null')||{},r=document.documentElement;r.dataset.palette=Object.hasOwn(${JSON.stringify(PALETTES)},p.palette)?p.palette:'aurora';r.dataset.motion=['soft','reduced'].includes(p.motion)?p.motion:'full';if(p.mode==='light')r.dataset.theme='light';else delete r.dataset.theme;r.style.setProperty('--ambient-glow',String(typeof p.glow==='number'&&Number.isFinite(p.glow)?Math.max(0,Math.min(1,p.glow)):.65));document.querySelector('meta[name="theme-color"]')?.setAttribute('content',p.mode==='light'?'#F4F5FA':'#0D0F22')}catch{}})()`
