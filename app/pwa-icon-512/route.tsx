import { renderBrandIcon } from '@/lib/brand-icon'

// Manifest icon (512x512, also used as maskable). Referenced by app/manifest.ts.
export function GET() {
  return renderBrandIcon(512)
}
