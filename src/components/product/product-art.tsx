import type * as React from 'react'
import { useId } from 'react'

import type { ArtKey, ArtPalette } from '@/domain/catalog'
import { cn } from '@/lib/utils'

/**
 * Original, generated product artwork (no third-party imagery or trademarks).
 * Server-rendered SVG with per-product colourways. Replace with real photography by supplying
 * image URLs (see STORAGE_PROVIDER) — ProductImage falls back to this artwork.
 */

interface ArtProps {
  id: string
  p: ArtPalette
  label?: string
}

function Defs({ id, p }: ArtProps) {
  return (
    <defs>
      <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={p.body} />
        <stop offset="1" stopColor={p.shade} />
      </linearGradient>
      <linearGradient id={`${id}-bv`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={p.body} />
        <stop offset="1" stopColor={p.shade} />
      </linearGradient>
      <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0.06" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-sc`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#0c1022" />
        <stop offset="0.55" stopColor="#1b2250" />
        <stop offset="1" stopColor={p.accent} stopOpacity="0.9" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="0.3" cy="0.3" r="0.9">
        <stop offset="0" stopColor={p.accent} stopOpacity="0.95" />
        <stop offset="0.6" stopColor={p.accent} stopOpacity="0.15" />
        <stop offset="1" stopColor={p.accent} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={p.accent} />
        <stop offset="1" stopColor={p.accent} stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
        <stop offset="1" stopColor={p.body} stopOpacity="0.35" />
      </linearGradient>
      <radialGradient id={`${id}-shadow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#000" stopOpacity="0.28" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

const F = (id: string, key: string) => `url(#${id}-${key})`

function Shadow({
  id,
  cx = 200,
  cy = 334,
  rx = 120,
  ry = 16,
}: {
  id: string
  cx?: number
  cy?: number
  rx?: number
  ry?: number
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={F(id, 'shadow')} />
}

const ART: Record<ArtKey, (props: ArtProps) => React.ReactNode> = {
  phone: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={80} />
      <rect x="138" y="52" width="124" height="266" rx="30" fill={F(id, 'b')} />
      <rect x="146" y="60" width="108" height="250" rx="24" fill={F(id, 'sc')} />
      <circle cx="226" cy="118" r="52" fill={F(id, 'glow')} opacity="0.9" />
      <rect x="180" y="70" width="40" height="11" rx="5.5" fill="#05060a" />
      <rect x="160" y="258" width="80" height="6" rx="3" fill="#fff" opacity="0.2" />
      <rect x="160" y="272" width="54" height="6" rx="3" fill="#fff" opacity="0.12" />
      <text
        x="200"
        y="146"
        textAnchor="middle"
        fill="#fff"
        fontSize="24"
        fontWeight="600"
        fontFamily="system-ui"
        opacity="0.92"
      >
        09:41
      </text>
      <rect x="262" y="120" width="3" height="34" rx="1.5" fill={p.shade} />
      <rect x="135" y="104" width="3" height="22" rx="1.5" fill={p.shade} />
      <rect x="138" y="52" width="124" height="266" rx="30" fill={F(id, 's')} opacity="0.5" />
    </g>
  ),
  headphones: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={110} />
      <path
        d="M110 214 C104 110 150 68 200 68 C250 68 296 110 290 214"
        fill="none"
        stroke={F(id, 'b')}
        strokeWidth="20"
        strokeLinecap="round"
      />
      <path
        d="M124 196 C122 120 158 86 200 86 C242 86 278 120 276 196"
        fill="none"
        stroke={p.shade}
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.5"
      />
      <rect x="78" y="188" width="74" height="118" rx="34" fill={F(id, 'b')} />
      <rect x="248" y="188" width="74" height="118" rx="34" fill={F(id, 'b')} />
      <rect x="132" y="200" width="24" height="94" rx="12" fill={p.shade} />
      <rect x="244" y="200" width="24" height="94" rx="12" fill={p.shade} />
      <circle cx="115" cy="247" r="14" fill={p.accent} opacity="0.35" />
      <rect x="78" y="188" width="74" height="118" rx="34" fill={F(id, 's')} opacity="0.6" />
      <rect x="248" y="188" width="74" height="118" rx="34" fill={F(id, 's')} opacity="0.6" />
    </g>
  ),
  earbuds: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={100} />
      <rect x="120" y="180" width="160" height="130" rx="52" fill={F(id, 'bv')} />
      <path d="M120 232 H280" stroke={p.shade} strokeWidth="3" opacity="0.6" />
      <circle cx="200" cy="262" r="5" fill={p.accent} />
      <rect x="120" y="180" width="160" height="130" rx="52" fill={F(id, 's')} />
      <g transform="translate(148 88) rotate(-18)">
        <ellipse cx="0" cy="0" rx="26" ry="24" fill={F(id, 'b')} />
        <rect x="-8" y="10" width="16" height="62" rx="8" fill={F(id, 'bv')} />
        <ellipse cx="-6" cy="-6" rx="10" ry="8" fill="#fff" opacity="0.5" />
      </g>
      <g transform="translate(252 96) rotate(16)">
        <ellipse cx="0" cy="0" rx="26" ry="24" fill={F(id, 'b')} />
        <rect x="-8" y="10" width="16" height="62" rx="8" fill={F(id, 'bv')} />
        <ellipse cx="-6" cy="-6" rx="10" ry="8" fill="#fff" opacity="0.5" />
      </g>
    </g>
  ),
  tv: ({ id, p }) => (
    <g>
      <Shadow id={id} cy={322} rx={140} />
      <path d="M150 300 L172 262 H228 L250 300 Z" fill={F(id, 'b')} />
      <rect x="120" y="298" width="160" height="10" rx="5" fill={p.shade} />
      <rect x="44" y="78" width="312" height="190" rx="10" fill={p.shade} />
      <rect x="52" y="86" width="296" height="174" rx="4" fill={F(id, 'sc')} />
      <ellipse cx="250" cy="140" rx="120" ry="60" fill={F(id, 'glow')} opacity="0.85" />
      <path
        d="M52 220 C120 180 180 250 260 196 S348 190 348 190 V260 H52 Z"
        fill={p.accent}
        opacity="0.35"
      />
      <rect x="52" y="86" width="296" height="174" rx="4" fill={F(id, 's')} opacity="0.35" />
    </g>
  ),
  laptop: ({ id, p }) => (
    <g>
      <Shadow id={id} cy={322} rx={150} />
      <rect x="82" y="86" width="236" height="160" rx="12" fill={p.shade} />
      <rect x="90" y="94" width="220" height="144" rx="6" fill={F(id, 'sc')} />
      <circle cx="248" cy="140" r="70" fill={F(id, 'glow')} opacity="0.8" />
      <rect x="104" y="112" width="70" height="8" rx="4" fill="#fff" opacity="0.5" />
      <rect x="104" y="128" width="110" height="6" rx="3" fill="#fff" opacity="0.2" />
      <path d="M60 252 H340 L324 292 H76 Z" fill={F(id, 'bv')} />
      <rect x="170" y="254" width="60" height="6" rx="3" fill={p.shade} opacity="0.6" />
      <path d="M60 252 H340 L324 292 H76 Z" fill={F(id, 's')} opacity="0.5" />
    </g>
  ),
  tablet: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={130} />
      <rect x="80" y="96" width="232" height="170" rx="20" fill={F(id, 'b')} />
      <rect x="90" y="106" width="212" height="150" rx="12" fill={F(id, 'sc')} />
      <circle cx="140" cy="150" r="60" fill={F(id, 'glow')} opacity="0.85" />
      <rect x="110" y="214" width="120" height="8" rx="4" fill="#fff" opacity="0.3" />
      <rect
        x="318"
        y="118"
        width="10"
        height="170"
        rx="5"
        fill={p.accent}
        transform="rotate(12 323 203)"
      />
      <rect x="80" y="96" width="232" height="170" rx="20" fill={F(id, 's')} opacity="0.4" />
    </g>
  ),
  camera: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={130} />
      <path d="M150 112 L170 88 H230 L250 112 Z" fill={F(id, 'bv')} />
      <rect x="76" y="110" width="248" height="164" rx="22" fill={F(id, 'b')} />
      <rect x="76" y="110" width="58" height="164" rx="22" fill={p.shade} />
      <circle cx="224" cy="194" r="66" fill={p.shade} />
      <circle cx="224" cy="194" r="54" fill="#101217" />
      <circle cx="224" cy="194" r="38" fill={F(id, 'sc')} />
      <circle cx="210" cy="178" r="12" fill="#fff" opacity="0.35" />
      <rect x="264" y="98" width="30" height="12" rx="4" fill={p.accent} />
      <rect x="76" y="110" width="248" height="164" rx="22" fill={F(id, 's')} opacity="0.35" />
    </g>
  ),
  console: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={110} />
      <path
        d="M140 54 C170 50 186 60 190 80 V300 C170 306 150 306 134 300 C126 220 126 130 140 54 Z"
        fill={F(id, 'b')}
      />
      <path
        d="M260 54 C230 50 214 60 210 80 V300 C230 306 250 306 266 300 C274 220 274 130 260 54 Z"
        fill={F(id, 'b')}
      />
      <rect x="186" y="66" width="28" height="238" rx="6" fill={p.accent} />
      <rect x="194" y="84" width="12" height="4" rx="2" fill={p.body} opacity="0.8" />
      <path
        d="M140 54 C170 50 186 60 190 80 V300 C170 306 150 306 134 300 C126 220 126 130 140 54 Z"
        fill={F(id, 's')}
        opacity="0.7"
      />
    </g>
  ),
  handheld: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={150} />
      <rect x="44" y="130" width="312" height="140" rx="60" fill={F(id, 'b')} />
      <rect x="112" y="146" width="176" height="108" rx="10" fill={F(id, 'sc')} />
      <circle cx="170" cy="182" r="46" fill={F(id, 'glow')} opacity="0.8" />
      <circle cx="82" cy="176" r="18" fill={p.shade} />
      <circle cx="82" cy="176" r="10" fill="#2a2d35" />
      <circle cx="318" cy="222" r="18" fill={p.shade} />
      <circle cx="318" cy="222" r="10" fill="#2a2d35" />
      <circle cx="308" cy="162" r="7" fill={p.accent} />
      <circle cx="328" cy="178" r="7" fill={p.accent} opacity="0.7" />
      <rect x="72" y="214" width="22" height="8" rx="3" fill={p.shade} />
      <rect x="44" y="130" width="312" height="140" rx="60" fill={F(id, 's')} opacity="0.4" />
    </g>
  ),
  controller: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={130} />
      <path
        d="M118 136 H282 C322 136 344 172 350 222 C356 268 330 290 306 276 C288 266 276 240 256 232 H144 C124 240 112 266 94 276 C70 290 44 268 50 222 C56 172 78 136 118 136 Z"
        fill={F(id, 'b')}
      />
      <circle cx="140" cy="186" r="20" fill={p.shade} />
      <circle cx="140" cy="186" r="12" fill="#2b2e36" />
      <circle cx="232" cy="218" r="18" fill={p.shade} />
      <circle cx="232" cy="218" r="10" fill="#2b2e36" />
      <rect x="160" y="208" width="30" height="10" rx="3" fill={p.shade} />
      <rect x="170" y="198" width="10" height="30" rx="3" fill={p.shade} />
      <circle cx="278" cy="170" r="8" fill={p.accent} />
      <circle cx="298" cy="186" r="8" fill={p.accent} opacity="0.8" />
      <circle cx="258" cy="186" r="8" fill={p.accent} opacity="0.6" />
      <circle cx="278" cy="202" r="8" fill={p.accent} opacity="0.45" />
      <path
        d="M118 136 H282 C322 136 344 172 350 222 L340 200 C330 170 310 150 282 150 H118 C90 150 70 170 60 200 L50 222 C56 172 78 136 118 136 Z"
        fill="#fff"
        opacity="0.18"
      />
    </g>
  ),
  vr: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={130} />
      <path
        d="M70 186 C40 150 70 96 120 104"
        fill="none"
        stroke={p.shade}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M330 186 C360 150 330 96 280 104"
        fill="none"
        stroke={p.shade}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <rect x="64" y="134" width="272" height="132" rx="54" fill={F(id, 'b')} />
      <rect x="84" y="150" width="232" height="96" rx="42" fill={p.accent} opacity="0.9" />
      <rect x="84" y="150" width="232" height="96" rx="42" fill={F(id, 's')} />
      <circle cx="116" cy="176" r="5" fill={p.body} opacity="0.7" />
      <circle cx="284" cy="176" r="5" fill={p.body} opacity="0.7" />
      <rect x="64" y="134" width="272" height="132" rx="54" fill={F(id, 's')} opacity="0.5" />
    </g>
  ),
  vacuum: ({ id, p }) => (
    <g>
      <Shadow id={id} cx={186} cy={330} rx={96} />
      <g transform="rotate(-16 200 200)">
        <rect x="193" y="126" width="14" height="178" rx="7" fill="#c9ccd3" />
        <rect x="196" y="130" width="4" height="170" rx="2" fill="#fff" opacity="0.6" />
        <rect x="136" y="292" width="128" height="32" rx="13" fill={F(id, 'bv')} />
        <rect x="142" y="314" width="116" height="8" rx="4" fill={p.accent} opacity="0.8" />
        <path
          d="M226 64 C270 62 272 146 228 146"
          fill="none"
          stroke={p.shade}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <rect x="166" y="48" width="68" height="104" rx="26" fill={F(id, 'b')} />
        <rect x="175" y="58" width="50" height="62" rx="20" fill={p.accent} opacity="0.5" />
        <circle cx="200" cy="89" r="12" fill="#fff" opacity="0.5" />
        <rect x="166" y="48" width="68" height="104" rx="26" fill={F(id, 's')} opacity="0.6" />
      </g>
    </g>
  ),
  robot: ({ id, p }) => (
    <g>
      <rect x="220" y="96" width="120" height="176" rx="18" fill={p.shade} opacity="0.85" />
      <rect x="236" y="116" width="88" height="10" rx="5" fill={p.accent} opacity="0.5" />
      <Shadow id={id} cx={190} cy={318} rx={140} ry={20} />
      <ellipse cx="190" cy="270" rx="140" ry="54" fill={p.shade} />
      <ellipse cx="190" cy="258" rx="140" ry="54" fill={F(id, 'bv')} />
      <ellipse cx="190" cy="248" rx="40" ry="16" fill={p.accent} />
      <ellipse cx="190" cy="242" rx="40" ry="14" fill="#fff" opacity="0.3" />
      <path
        d="M62 262 C90 300 290 300 318 262"
        fill="none"
        stroke={p.accent}
        strokeWidth="3"
        opacity="0.6"
      />
      <ellipse cx="170" cy="238" rx="100" ry="30" fill={F(id, 's')} opacity="0.6" />
    </g>
  ),
  thermostat: ({ id, p }) => (
    <g>
      <Shadow id={id} cy={320} rx={100} />
      <circle cx="200" cy="190" r="118" fill={F(id, 'b')} />
      <circle cx="200" cy="190" r="96" fill="#14161c" />
      <path
        d="M130 250 A96 96 0 1 1 270 250"
        fill="none"
        stroke={p.accent}
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.9"
      />
      <text
        x="200"
        y="202"
        textAnchor="middle"
        fill="#fff"
        fontSize="44"
        fontWeight="600"
        fontFamily="system-ui"
      >
        21.5°
      </text>
      <text
        x="200"
        y="232"
        textAnchor="middle"
        fill={p.accent}
        fontSize="13"
        fontFamily="system-ui"
        letterSpacing="2"
      >
        HEATING
      </text>
      <circle cx="200" cy="190" r="118" fill={F(id, 's')} opacity="0.5" />
    </g>
  ),
  lamp: ({ id, p }) => (
    <g>
      <circle cx="200" cy="150" r="130" fill={F(id, 'glow')} opacity="0.55" />
      <Shadow id={id} rx={90} />
      <rect x="192" y="170" width="16" height="140" rx="8" fill={F(id, 'bv')} />
      <ellipse cx="200" cy="316" rx="74" ry="14" fill={p.shade} />
      <path d="M100 176 C100 100 148 66 200 66 C252 66 300 100 300 176 Z" fill={F(id, 'b')} />
      <ellipse cx="200" cy="176" rx="100" ry="14" fill={p.accent} />
      <path
        d="M120 150 C124 110 150 84 190 78"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.4"
      />
    </g>
  ),
  coffee: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={140} />
      <path d="M232 40 H300 L292 84 H240 Z" fill={p.accent} opacity="0.85" />
      <rect x="96" y="80" width="208" height="236" rx="18" fill={F(id, 'b')} />
      <rect x="112" y="100" width="176" height="48" rx="10" fill="#15171c" />
      <circle cx="140" cy="124" r="10" fill={p.accent} opacity="0.8" />
      <rect x="164" y="118" width="100" height="12" rx="6" fill="#fff" opacity="0.25" />
      <rect x="160" y="160" width="80" height="26" rx="8" fill={p.shade} />
      <rect x="236" y="168" width="70" height="12" rx="6" fill={p.accent} />
      <rect x="176" y="232" width="48" height="44" rx="8" fill="#fff" />
      <rect x="176" y="232" width="48" height="12" rx="4" fill="#6b4a33" />
      <rect x="112" y="278" width="176" height="14" rx="4" fill={p.shade} />
      <rect x="96" y="80" width="208" height="236" rx="18" fill={F(id, 's')} opacity="0.55" />
    </g>
  ),
  kettle: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={120} />
      <rect x="112" y="296" width="170" height="20" rx="10" fill={p.shade} />
      <path d="M138 296 C126 220 140 150 196 140 C252 150 266 220 256 296 Z" fill={F(id, 'b')} />
      <path
        d="M146 262 C104 254 78 206 64 140"
        fill="none"
        stroke={F(id, 'b')}
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M250 170 C300 164 310 250 262 262"
        fill="none"
        stroke={p.accent}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="170" y="126" width="52" height="16" rx="8" fill={p.accent} />
      <path
        d="M160 180 C160 160 176 150 190 150"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.35"
      />
    </g>
  ),
  airfryer: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={140} />
      <rect x="70" y="84" width="260" height="232" rx="42" fill={F(id, 'b')} />
      <rect x="92" y="104" width="216" height="40" rx="12" fill="#15171c" />
      <circle cx="120" cy="124" r="8" fill={p.accent} />
      <rect x="140" y="119" width="80" height="10" rx="5" fill="#fff" opacity="0.3" />
      <rect x="90" y="160" width="104" height="136" rx="18" fill={p.shade} />
      <rect x="206" y="160" width="104" height="136" rx="18" fill={p.shade} />
      <rect x="112" y="220" width="60" height="12" rx="6" fill={p.accent} />
      <rect x="228" y="220" width="60" height="12" rx="6" fill={p.accent} />
      <rect x="70" y="84" width="260" height="232" rx="42" fill={F(id, 's')} opacity="0.5" />
    </g>
  ),
  mixer: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={140} />
      <rect x="84" y="290" width="232" height="28" rx="14" fill={F(id, 'bv')} />
      <path d="M96 290 V130 C96 100 116 84 146 84 H150 V290 Z" fill={F(id, 'b')} />
      <path
        d="M100 80 C100 60 120 50 150 50 H292 C320 50 330 72 326 96 C322 118 300 126 280 126 H100 Z"
        fill={F(id, 'b')}
      />
      <rect x="196" y="126" width="12" height="80" fill={p.accent} />
      <path d="M150 200 H310 C306 262 280 290 230 290 C180 290 154 262 150 200 Z" fill="#dfe3e8" />
      <path
        d="M150 200 H310 C306 262 280 290 230 290 C180 290 154 262 150 200 Z"
        fill={F(id, 's')}
      />
      <path
        d="M100 80 C100 60 120 50 150 50 H292 C300 50 306 52 310 56 C250 60 150 60 104 96 Z"
        fill="#fff"
        opacity="0.3"
      />
    </g>
  ),
  blender: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={110} />
      <rect x="126" y="244" width="148" height="74" rx="16" fill={F(id, 'bv')} />
      <circle cx="200" cy="282" r="16" fill={p.accent} />
      <path
        d="M138 70 H262 L250 244 H150 Z"
        fill={F(id, 'glass')}
        stroke={p.body}
        strokeOpacity="0.5"
        strokeWidth="3"
      />
      <path d="M146 150 H254 L250 244 H150 Z" fill={p.accent} opacity="0.35" />
      <rect x="132" y="58" width="136" height="22" rx="8" fill={p.shade} />
      <path
        d="M262 100 C300 104 304 170 258 180"
        fill="none"
        stroke={p.shade}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path
        d="M156 84 L150 230"
        stroke="#fff"
        strokeWidth="6"
        opacity="0.5"
        strokeLinecap="round"
      />
    </g>
  ),
  fragrance: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={100} />
      <rect x="166" y="60" width="68" height="60" rx="8" fill={p.accent} />
      <rect x="166" y="60" width="68" height="60" rx="8" fill={F(id, 's')} />
      <rect x="186" y="112" width="28" height="20" fill={p.accent} opacity="0.8" />
      <rect x="112" y="128" width="176" height="190" rx="24" fill={F(id, 'b')} opacity="0.92" />
      <rect x="124" y="180" width="152" height="128" rx="16" fill={p.shade} opacity="0.5" />
      <rect x="146" y="196" width="108" height="46" rx="4" fill="#fff" opacity="0.88" />
      <rect x="160" y="210" width="80" height="6" rx="3" fill={p.shade} />
      <rect x="170" y="224" width="60" height="4" rx="2" fill={p.shade} opacity="0.6" />
      <path
        d="M130 146 L130 296"
        stroke="#fff"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.35"
      />
    </g>
  ),
  skincare: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={150} />
      <rect x="74" y="120" width="76" height="198" rx="20" fill={F(id, 'b')} />
      <rect x="100" y="84" width="24" height="40" rx="6" fill={p.shade} />
      <rect x="100" y="76" width="44" height="12" rx="6" fill={p.shade} />
      <rect
        x="164"
        y="170"
        width="68"
        height="148"
        rx="14"
        fill={F(id, 'glass')}
        stroke={p.body}
        strokeWidth="3"
      />
      <rect x="182" y="120" width="32" height="54" rx="10" fill={p.shade} />
      <rect x="248" y="236" width="100" height="82" rx="18" fill={F(id, 'b')} />
      <rect x="244" y="220" width="108" height="26" rx="10" fill={p.shade} />
      <rect x="86" y="200" width="52" height="30" rx="4" fill="#fff" opacity="0.85" />
      <rect x="74" y="120" width="76" height="198" rx="20" fill={F(id, 's')} opacity="0.6" />
    </g>
  ),
  hairdryer: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={130} />
      <path d="M150 200 L176 316 H214 L214 200 Z" fill={F(id, 'bv')} />
      <rect x="60" y="120" width="230" height="96" rx="48" fill={F(id, 'b')} />
      <rect x="276" y="130" width="60" height="76" rx="18" fill={p.shade} />
      <rect x="320" y="136" width="10" height="64" rx="5" fill={p.accent} />
      <circle cx="104" cy="168" r="26" fill={p.shade} />
      <circle cx="104" cy="168" r="14" fill={p.accent} opacity="0.7" />
      <rect x="182" y="232" width="24" height="10" rx="5" fill={p.accent} />
      <rect x="60" y="120" width="230" height="96" rx="48" fill={F(id, 's')} opacity="0.6" />
    </g>
  ),
  sneaker: ({ id, p }) => (
    <g>
      <Shadow id={id} cy={316} rx={160} />
      <path
        d="M52 282 C52 268 64 262 80 262 H318 C340 262 356 270 360 284 C362 296 350 304 334 304 H72 C60 304 52 296 52 282 Z"
        fill="#f5f5f3"
        stroke="#d6d6d1"
        strokeWidth="3"
      />
      <path d="M62 290 H354" stroke={p.accent} strokeWidth="4" opacity="0.55" />
      <path
        d="M60 264 L66 214 C68 196 80 186 98 184 L150 178 C170 176 184 164 196 148 L210 130 C218 120 232 118 242 126 C262 144 290 176 324 204 C346 222 356 244 352 264 Z"
        fill={F(id, 'b')}
      />
      <path
        d="M60 264 L66 214 C68 196 80 186 98 184 L112 184 L106 264 Z"
        fill={p.shade}
        opacity="0.45"
      />
      <path
        d="M296 200 C328 216 350 238 352 264 H288 C292 244 294 222 296 200 Z"
        fill={p.shade}
        opacity="0.35"
      />
      <path d="M130 236 H270" stroke={p.accent} strokeWidth="10" strokeLinecap="round" />
      <path
        d="M206 138 L230 160 M194 152 L218 174 M182 166 L206 188"
        stroke={p.shade}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.75"
      />
      <rect x="58" y="206" width="12" height="40" rx="6" fill={p.accent} />
      <path
        d="M86 204 C110 196 140 192 160 190"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.4"
      />
    </g>
  ),
  bag: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={160} />
      <path
        d="M150 132 C150 80 250 80 250 132"
        fill="none"
        stroke={p.shade}
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M60 200 C60 150 90 132 130 132 H270 C310 132 340 150 340 200 V282 C340 304 322 316 300 316 H100 C78 316 60 304 60 282 Z"
        fill={F(id, 'b')}
      />
      <path d="M72 172 H328" stroke={p.accent} strokeWidth="4" strokeDasharray="10 8" />
      <rect x="112" y="220" width="176" height="70" rx="12" fill={p.shade} opacity="0.4" />
      <rect x="186" y="164" width="28" height="18" rx="4" fill={p.accent} />
      <circle cx="84" cy="200" r="8" fill={p.accent} />
      <circle cx="316" cy="200" r="8" fill={p.accent} />
      <path
        d="M60 200 C60 150 90 132 130 132 H270 C300 132 324 142 334 170 C300 150 120 150 66 184 Z"
        fill="#fff"
        opacity="0.2"
      />
    </g>
  ),
  jacket: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={150} />
      <path
        d="M150 62 H250 L330 110 L350 250 L312 262 L300 150 V318 H100 V150 L88 262 L50 250 L70 110 Z"
        fill={F(id, 'b')}
      />
      {[110, 150, 190, 230, 270].map((y) => (
        <path
          key={y}
          d={`M${y < 150 ? 100 : 100} ${y} H300`}
          stroke={p.shade}
          strokeWidth="4"
          opacity="0.55"
        />
      ))}
      <path d="M200 66 V318" stroke={p.accent} strokeWidth="5" />
      <path d="M150 62 C170 92 230 92 250 62" fill="none" stroke={p.shade} strokeWidth="8" />
      <path
        d="M110 120 C112 170 110 220 112 300"
        stroke="#fff"
        strokeWidth="10"
        opacity="0.18"
        strokeLinecap="round"
      />
    </g>
  ),
  sunglasses: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={150} />
      <path d="M52 150 H348" stroke={p.accent} strokeWidth="6" strokeLinecap="round" />
      <path d="M186 158 C194 148 206 148 214 158" fill="none" stroke={p.accent} strokeWidth="6" />
      <path
        d="M62 152 C62 210 88 250 124 250 C160 250 184 214 184 176 C184 156 170 150 150 150 H80 C68 150 62 150 62 152 Z"
        fill={p.shade}
        stroke={p.accent}
        strokeWidth="6"
      />
      <path
        d="M338 152 C338 210 312 250 276 250 C240 250 216 214 216 176 C216 156 230 150 250 150 H320 C332 150 338 150 338 152 Z"
        fill={p.shade}
        stroke={p.accent}
        strokeWidth="6"
      />
      <path
        d="M84 170 C94 160 120 160 136 170"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M238 170 C248 160 274 160 290 170"
        fill="none"
        stroke="#fff"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.35"
      />
    </g>
  ),
  smartwatch: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={90} />
      <rect x="152" y="40" width="96" height="92" rx="20" fill={p.shade} />
      <rect x="152" y="268" width="96" height="62" rx="20" fill={p.shade} />
      <rect x="126" y="110" width="148" height="176" rx="44" fill={F(id, 'b')} />
      <rect x="138" y="122" width="124" height="152" rx="34" fill="#0b0d12" />
      <circle
        cx="200"
        cy="198"
        r="44"
        fill="none"
        stroke={p.accent}
        strokeWidth="10"
        strokeDasharray="200 80"
        strokeLinecap="round"
      />
      <circle
        cx="200"
        cy="198"
        r="30"
        fill="none"
        stroke="#34d399"
        strokeWidth="8"
        strokeDasharray="120 80"
        strokeLinecap="round"
      />
      <text
        x="200"
        y="206"
        textAnchor="middle"
        fill="#fff"
        fontSize="20"
        fontWeight="600"
        fontFamily="system-ui"
      >
        10:09
      </text>
      <rect x="274" y="160" width="10" height="36" rx="5" fill={p.accent} />
      <rect x="126" y="110" width="148" height="176" rx="44" fill={F(id, 's')} opacity="0.35" />
    </g>
  ),
  watch: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={90} />
      <rect x="160" y="30" width="80" height="110" rx="14" fill={F(id, 'bv')} />
      <rect x="160" y="262" width="80" height="80" rx="14" fill={F(id, 'bv')} />
      <circle cx="200" cy="200" r="94" fill={F(id, 'b')} />
      <circle cx="200" cy="200" r="78" fill={p.accent} />
      {Array.from({ length: 12 }).map((_, index) => (
        <rect
          key={index}
          x="197"
          y="128"
          width="6"
          height={index % 3 === 0 ? 18 : 10}
          rx="3"
          fill="#fff"
          opacity="0.9"
          transform={`rotate(${index * 30} 200 200)`}
        />
      ))}
      <rect
        x="196"
        y="146"
        width="8"
        height="58"
        rx="4"
        fill="#fff"
        transform="rotate(-30 200 200)"
      />
      <rect
        x="197"
        y="130"
        width="6"
        height="74"
        rx="3"
        fill="#fff"
        transform="rotate(64 200 200)"
      />
      <circle cx="200" cy="200" r="7" fill={p.body} />
      <rect x="292" y="190" width="18" height="20" rx="4" fill={p.body} />
      <circle cx="200" cy="200" r="94" fill={F(id, 's')} opacity="0.45" />
    </g>
  ),
  tracker: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={130} />
      <path
        d="M70 200 C70 140 130 110 200 110 C270 110 330 140 330 200 C330 260 270 290 200 290 C130 290 70 260 70 200 Z"
        fill="none"
        stroke={F(id, 'b')}
        strokeWidth="34"
      />
      <rect x="150" y="150" width="100" height="100" rx="26" fill={p.shade} />
      <rect x="160" y="160" width="80" height="80" rx="20" fill="#05070a" />
      <text
        x="200"
        y="206"
        textAnchor="middle"
        fill={p.accent}
        fontSize="24"
        fontWeight="700"
        fontFamily="system-ui"
      >
        8,412
      </text>
      <text
        x="200"
        y="224"
        textAnchor="middle"
        fill="#fff"
        fontSize="10"
        fontFamily="system-ui"
        opacity="0.7"
      >
        STEPS
      </text>
    </g>
  ),
  bike: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={150} />
      <path d="M90 318 H310" stroke={p.shade} strokeWidth="14" strokeLinecap="round" />
      <circle cx="140" cy="250" r="56" fill={p.shade} />
      <circle cx="140" cy="250" r="40" fill={p.accent} opacity="0.85" />
      <circle cx="140" cy="250" r="12" fill={p.body} />
      <path
        d="M140 250 L220 130 L290 318"
        fill="none"
        stroke={F(id, 'b')}
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M220 130 L250 70" stroke={F(id, 'b')} strokeWidth="14" strokeLinecap="round" />
      <rect
        x="226"
        y="52"
        width="70"
        height="44"
        rx="8"
        fill="#101217"
        transform="rotate(-12 260 74)"
      />
      <rect x="120" y="96" width="70" height="18" rx="9" fill={p.shade} />
      <path d="M170 110 L186 170" stroke={p.shade} strokeWidth="12" strokeLinecap="round" />
    </g>
  ),
  dumbbell: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={160} />
      <rect x="58" y="280" width="284" height="34" rx="10" fill={p.shade} opacity="0.8" />
      {[0, 1].map((row) => (
        <g key={row} transform={`translate(0 ${row * -86})`}>
          <rect x="112" y="244" width="176" height="14" rx="7" fill="#9aa0aa" />
          {[70, 88, 106].map((x) => (
            <rect key={x} x={x} y="208" width="16" height="86" rx="6" fill={F(id, 'bv')} />
          ))}
          {[278, 296, 314].map((x) => (
            <rect key={x} x={x} y="208" width="16" height="86" rx="6" fill={F(id, 'bv')} />
          ))}
          <rect x="124" y="226" width="12" height="50" rx="4" fill={p.accent} />
          <rect x="264" y="226" width="12" height="50" rx="4" fill={p.accent} />
        </g>
      ))}
    </g>
  ),
  massager: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={120} />
      <path d="M190 190 L216 312 H256 L240 190 Z" fill={F(id, 'bv')} />
      <rect x="92" y="116" width="220" height="86" rx="42" fill={F(id, 'b')} />
      <rect x="54" y="136" width="46" height="46" rx="12" fill={p.shade} />
      <circle cx="52" cy="159" r="26" fill={p.accent} />
      <rect x="226" y="132" width="60" height="10" rx="5" fill={p.accent} opacity="0.7" />
      <rect x="92" y="116" width="220" height="86" rx="42" fill={F(id, 's')} opacity="0.6" />
    </g>
  ),
  luggage: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={110} />
      <path
        d="M170 42 H230 V92"
        fill="none"
        stroke="#9aa0aa"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <path d="M170 42 V92" stroke="#9aa0aa" strokeWidth="10" />
      <rect x="160" y="30" width="80" height="22" rx="10" fill={p.shade} />
      <rect x="112" y="88" width="176" height="226" rx="26" fill={F(id, 'b')} />
      {[150, 186, 222, 258].map((x) => (
        <rect
          key={x}
          x={x - 3}
          y="100"
          width="6"
          height="202"
          rx="3"
          fill={p.shade}
          opacity="0.55"
        />
      ))}
      <rect x="112" y="88" width="176" height="226" rx="26" fill={F(id, 's')} opacity="0.55" />
      <circle cx="134" cy="322" r="11" fill="#2b2e36" />
      <circle cx="266" cy="322" r="11" fill="#2b2e36" />
      <rect x="184" y="182" width="32" height="10" rx="5" fill={p.accent} />
    </g>
  ),
  powerbank: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={130} />
      <path
        d="M296 214 C352 214 350 300 290 300 H240"
        fill="none"
        stroke="#9aa0aa"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <rect x="80" y="120" width="220" height="150" rx="30" fill={F(id, 'b')} />
      <rect x="112" y="150" width="96" height="44" rx="10" fill="#0d0f13" />
      <text
        x="160"
        y="180"
        textAnchor="middle"
        fill={p.accent}
        fontSize="22"
        fontWeight="700"
        fontFamily="system-ui"
      >
        87%
      </text>
      <rect x="112" y="220" width="130" height="10" rx="5" fill={p.accent} />
      <rect x="80" y="120" width="220" height="150" rx="30" fill={F(id, 's')} opacity="0.6" />
    </g>
  ),
  giftcard: ({ id, p, label }) => (
    <g>
      <Shadow id={id} rx={150} />
      <g transform="rotate(-8 200 200)">
        <rect x="64" y="110" width="272" height="172" rx="20" fill={F(id, 'b')} />
        <circle cx="300" cy="140" r="90" fill={p.accent} opacity="0.14" />
        <rect x="92" y="150" width="44" height="34" rx="6" fill={p.accent} opacity="0.85" />
        <text
          x="92"
          y="258"
          fill={p.accent}
          fontSize="13"
          fontWeight="600"
          fontFamily="system-ui"
          letterSpacing="3"
        >
          GIFT CARD
        </text>
        <text
          x="308"
          y="176"
          textAnchor="end"
          fill={p.accent}
          fontSize="34"
          fontWeight="700"
          fontFamily="system-ui"
        >
          {label ?? ''}
        </text>
        <rect x="64" y="110" width="272" height="172" rx="20" fill={F(id, 's')} opacity="0.45" />
      </g>
    </g>
  ),
  dashcam: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={110} />
      <rect x="178" y="70" width="44" height="56" rx="10" fill={p.shade} />
      <path
        d="M110 130 H290 C304 130 312 140 310 152 L296 262 C294 274 284 282 272 282 H128 C116 282 106 274 104 262 L90 152 C88 140 96 130 110 130 Z"
        fill={F(id, 'b')}
      />
      <circle cx="200" cy="206" r="48" fill={p.shade} />
      <circle cx="200" cy="206" r="34" fill={F(id, 'sc')} />
      <circle cx="188" cy="194" r="9" fill="#fff" opacity="0.45" />
      <circle cx="270" cy="160" r="5" fill={p.accent} />
    </g>
  ),
  evcharger: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={120} />
      <path
        d="M150 270 C120 330 250 330 280 290 C300 262 330 250 330 210"
        fill="none"
        stroke="#2b2e36"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="306" y="186" width="44" height="30" rx="8" fill={p.shade} />
      <rect x="110" y="60" width="160" height="220" rx="28" fill={F(id, 'b')} />
      <circle cx="190" cy="150" r="42" fill="none" stroke={p.accent} strokeWidth="10" />
      <path d="M186 128 L172 154 H190 L180 176 L206 146 H188 L198 128 Z" fill={p.accent} />
      <rect x="150" y="226" width="80" height="10" rx="5" fill={p.shade} opacity="0.6" />
      <rect x="110" y="60" width="160" height="220" rx="28" fill={F(id, 's')} opacity="0.6" />
    </g>
  ),
  inflator: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={110} />
      <path
        d="M250 160 C320 150 330 250 280 290"
        fill="none"
        stroke="#2b2e36"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect x="120" y="100" width="140" height="210" rx="30" fill={F(id, 'b')} />
      <rect x="140" y="126" width="100" height="64" rx="12" fill="#0d0f13" />
      <text
        x="180"
        y="168"
        textAnchor="middle"
        fill="#fff"
        fontSize="26"
        fontWeight="700"
        fontFamily="system-ui"
      >
        35
      </text>
      <text x="206" y="168" fill={p.body} fontSize="11" fontFamily="system-ui">
        PSI
      </text>
      <circle cx="160" cy="228" r="12" fill={p.accent} />
      <circle cx="220" cy="228" r="12" fill={p.accent} />
      <rect x="120" y="100" width="140" height="210" rx="30" fill={F(id, 's')} opacity="0.5" />
    </g>
  ),
  drone: ({ id, p }) => (
    <g>
      <Shadow id={id} cy={320} rx={150} />
      {[
        [80, 120],
        [320, 120],
        [80, 240],
        [320, 240],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <path d={`M200 180 L${x} ${y}`} stroke={p.shade} strokeWidth="14" strokeLinecap="round" />
          <ellipse cx={x} cy={(y as number) - 12} rx="56" ry="8" fill={p.accent} opacity="0.35" />
          <circle cx={x} cy={y} r="12" fill={p.shade} />
        </g>
      ))}
      <rect x="146" y="140" width="108" height="84" rx="30" fill={F(id, 'b')} />
      <circle cx="200" cy="244" r="20" fill="#1b1d23" />
      <circle cx="200" cy="244" r="10" fill={F(id, 'sc')} />
      <rect x="146" y="140" width="108" height="84" rx="30" fill={F(id, 's')} opacity="0.6" />
    </g>
  ),
  scooter: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={160} />
      <circle cx="90" cy="290" r="34" fill="#1b1d23" />
      <circle cx="90" cy="290" r="14" fill={p.accent} />
      <circle cx="306" cy="290" r="34" fill="#1b1d23" />
      <circle cx="306" cy="290" r="14" fill={p.accent} />
      <path
        d="M90 290 H250 L300 76"
        fill="none"
        stroke={F(id, 'b')}
        strokeWidth="18"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="110" y="264" width="160" height="22" rx="10" fill={F(id, 'bv')} />
      <path d="M270 70 H336" stroke={p.shade} strokeWidth="14" strokeLinecap="round" />
      <path
        d="M300 76 L306 290"
        stroke={p.shade}
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.6"
      />
    </g>
  ),
  candle: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={150} />
      {[
        [110, 190],
        [200, 160],
        [290, 200],
      ].map(([x, y], index) => (
        <g key={x}>
          <ellipse cx={x} cy={(y as number) - 30} rx="6" ry="12" fill="#ffb347" opacity="0.9" />
          <rect x={(x as number) - 2} y={(y as number) - 20} width="4" height="16" fill="#3b3024" />
          <rect
            x={(x as number) - 52}
            y={y}
            width="104"
            height={316 - (y as number)}
            rx="14"
            fill={F(id, 'b')}
          />
          <rect
            x={(x as number) - 52}
            y={y}
            width="104"
            height="18"
            rx="9"
            fill={p.accent}
            opacity="0.5"
          />
          <rect
            x={(x as number) - 34}
            y={(y as number) + 48}
            width="68"
            height="38"
            rx="4"
            fill="#fff"
            opacity={0.8 - index * 0.1}
          />
        </g>
      ))}
    </g>
  ),
  speaker: ({ id, p }) => (
    <g>
      <Shadow id={id} rx={130} />
      <path
        d="M150 90 C150 50 250 50 250 90"
        fill="none"
        stroke={p.shade}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect x="104" y="86" width="192" height="230" rx="80" fill={F(id, 'b')} />
      {Array.from({ length: 9 }).map((_, row) =>
        Array.from({ length: 7 }).map((__, col) => (
          <circle
            key={`${row}-${col}`}
            cx={134 + col * 22}
            cy={126 + row * 20}
            r="3.4"
            fill={p.shade}
            opacity="0.55"
          />
        )),
      )}
      <rect x="176" y="286" width="48" height="10" rx="5" fill={p.accent} />
      <rect x="104" y="86" width="192" height="230" rx="80" fill={F(id, 's')} opacity="0.5" />
    </g>
  ),
}

const VARIANT_TRANSFORMS = [
  '',
  'translate(-60 -52) scale(1.3)',
  'rotate(-7 200 200) translate(8 4)',
]

export interface ProductArtProps {
  art: ArtKey
  palette: ArtPalette
  /** Unique, stable id fragment (e.g. product slug) for gradient ids. */
  uid: string
  variant?: number
  label?: string
  className?: string
  title?: string
}

export function ProductArt({
  art,
  palette,
  uid,
  variant = 0,
  label,
  className,
  title,
}: ProductArtProps) {
  // The same product can appear several times on a page (gallery, thumbnails, carousels), so the
  // gradient ids also carry a per-instance suffix.
  const instance = useId()
  const id = `pa-${uid}-${variant}-${instance}`.replace(/[^a-zA-Z0-9-]/g, '')
  const Draw = ART[art] ?? ART.giftcard
  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-label={title}
      className={cn('h-full w-full', className)}
    >
      {title ? <title>{title}</title> : null}
      <Defs id={id} p={palette} />
      {variant === 2 ? (
        <circle cx="300" cy="96" r="70" fill={palette.accent} opacity="0.1" />
      ) : null}
      <g transform={VARIANT_TRANSFORMS[variant] ?? ''}>{Draw({ id, p: palette, label })}</g>
    </svg>
  )
}

/** Product media tile: real photo when a URL exists, otherwise generated artwork on a tinted backdrop. */
export function ProductMedia({
  art,
  palette,
  uid,
  variant = 0,
  label,
  alt,
  className,
  imageUrl,
}: ProductArtProps & { alt: string; imageUrl?: string }) {
  return (
    <div
      className={cn(
        'art-backdrop relative flex aspect-square items-center justify-center overflow-hidden',
        className,
      )}
      style={{ '--art-backdrop': palette.backdrop } as React.CSSProperties}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote media may come from a configurable CDN
        <img src={imageUrl} alt={alt} className="h-full w-full object-contain" loading="lazy" />
      ) : (
        <ProductArt
          art={art}
          palette={palette}
          uid={uid}
          variant={variant}
          label={label}
          title={alt}
          className="p-[8%]"
        />
      )}
    </div>
  )
}

export function giftCardLabel(name: string): string | undefined {
  const match = /£\s?(\d+)/.exec(name)
  return match ? `£${match[1]}` : undefined
}
