import { ImageResponse } from 'next/og'

export const alt = 'Esocity Bid — The Intelligent Live Marketplace'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Default social sharing card, generated at build time. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: 'linear-gradient(135deg, #0a0b0f 0%, #151a3d 60%, #2830a3 100%)',
        color: '#ffffff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #5563fa, #2830a3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            paddingLeft: 20,
            gap: 7,
          }}
        >
          <div style={{ width: 26, height: 8, borderRadius: 4, background: '#fff' }} />
          <div
            style={{ width: 20, height: 8, borderRadius: 4, background: '#fff', opacity: 0.85 }}
          />
          <div style={{ width: 32, height: 8, borderRadius: 4, background: '#fff' }} />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 34,
            letterSpacing: 6,
            fontWeight: 700,
          }}
        >
          ESOCITY
          <span
            style={{
              fontSize: 22,
              background: '#fff',
              color: '#0a0b0f',
              padding: '4px 10px',
              borderRadius: 8,
              letterSpacing: 3,
            }}
          >
            BID
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          The Intelligent Live Marketplace
        </div>
        <div style={{ fontSize: 34, color: '#bac2ff' }}>Live Commerce. Smarter Bidding.</div>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>
        <span>Live auctions</span>
        <span>·</span>
        <span>Marketplace</span>
        <span>·</span>
        <span>Flash Drops</span>
        <span>·</span>
        <span>Rewards</span>
      </div>
    </div>,
    size,
  )
}
