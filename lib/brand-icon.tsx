import { ImageResponse } from 'next/og'

/**
 * The RelayOps app icon, rendered at any size. Full-bleed brand green so it
 * works as an Android "maskable" icon (the OS crops to its own shape and the
 * centered mark stays inside the safe zone). Used by the favicon, the iOS
 * touch icon, and the PWA manifest icons.
 */
export function renderBrandIcon(size: number): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #1F4D3C 0%, #163828 100%)',
          color: '#ffffff',
          fontSize: size * 0.56,
          fontWeight: 700,
          fontFamily: 'sans-serif',
          letterSpacing: -size * 0.02,
        }}
      >
        R
      </div>
    ),
    { width: size, height: size }
  )
}
