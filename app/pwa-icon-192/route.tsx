import { renderBrandIcon } from '@/lib/brand-icon'

// Manifest icon (192x192). Referenced by app/manifest.ts.
export function GET() {
  return renderBrandIcon(192)
}
