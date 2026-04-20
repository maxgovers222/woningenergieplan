import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: '#020617',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '6px solid rgba(245,158,11,0.35)',
        }}
      >
        <svg width="100" height="100" viewBox="0 0 18 18" fill="none">
          <path
            d="M9 2L15.5 6V13L9 17L2.5 13V6L9 2Z"
            fill="rgba(245,158,11,0.2)"
            stroke="#f59e0b"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <path
            d="M9 6.5L12 8.5V12L9 14L6 12V8.5L9 6.5Z"
            fill="#f59e0b"
          />
        </svg>
      </div>
    ),
    { width: 180, height: 180 }
  )
}
