// A flat school scene for the sign-in page: the school building with its flag,
// trees, a learner checking in at a fingerprint terminal, and soft leaves — in
// the Shulepoa greens with greys, matching the portal.shulepoa.co.ke login.
// Pure SVG, so it is crisp at any size and costs nothing to load.

const g900 = "#14532d"
const g700 = "#15803d"
const g500 = "#22c55e"
const g300 = "#86efac"
const g200 = "#bbf7d0"
const g100 = "#dcfce7"
const ink = "#1f2937"
const line = "#94a3b8"
const dot = "#cbd5e1"

export function SchoolIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 440" className={className} role="img" aria-label="A learner checking in at a school fingerprint terminal">
      {/* sky shapes */}
      <circle cx="96" cy="88" r="48" fill={g200} opacity=".75" />
      <circle cx="430" cy="70" r="18" fill={g100} />
      <ellipse cx="150" cy="104" rx="34" ry="11" fill="#fff" opacity=".85" />
      <ellipse cx="392" cy="118" rx="28" ry="9" fill="#fff" opacity=".85" />

      {/* hills */}
      <path d="M0 330 L92 236 L132 270 L196 196 L270 290 L0 300 Z" fill="#e9eeec" />
      <path d="M196 196 L214 214 L204 222 L188 206 Z" fill="#fff" opacity=".9" />
      <path d="M300 300 L382 214 L430 258 L470 222 L520 270 L520 310 Z" fill="#e9eeec" />

      {/* school */}
      <g>
        <rect x="150" y="214" width="214" height="146" rx="3" fill="#fff" stroke={dot} strokeWidth="2" />
        <path d="M138 218 L257 150 L376 218 Z" fill={g700} />
        <path d="M160 214 L257 160 L354 214 Z" fill={g500} opacity=".35" />
        <circle cx="257" cy="194" r="13" fill="#fff" stroke={g900} strokeWidth="2.5" />
        <path d="M257 186 V194 L263 198" stroke={g900} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* flag */}
        <line x1="257" y1="150" x2="257" y2="108" stroke={ink} strokeWidth="2.5" />
        <path d="M258 110 C270 104 278 116 292 110 L292 128 C278 134 270 122 258 128 Z" fill={g500} />
        {/* windows */}
        {[166, 202, 284, 320].map((x) => (
          <g key={x}>
            <rect x={x} y="236" width="28" height="34" rx="3" fill={g100} stroke={g300} strokeWidth="2" />
            <line x1={x + 14} y1="236" x2={x + 14} y2="270" stroke={g300} strokeWidth="2" />
            <rect x={x} y="292" width="28" height="34" rx="3" fill={g100} stroke={g300} strokeWidth="2" />
          </g>
        ))}
        {/* door */}
        <rect x="240" y="290" width="36" height="70" rx="3" fill={ink} />
        <circle cx="268" cy="326" r="2.5" fill={g300} />
        <rect x="232" y="356" width="52" height="6" rx="2" fill={dot} />
      </g>

      {/* dotted shrub, left */}
      <g stroke={line} strokeWidth="1.6" fill="none">
        <path d="M70 360 C68 330 74 300 92 268" />
        <path d="M78 318 L58 294" /><path d="M84 300 L104 282" /><path d="M74 338 L52 322" />
      </g>
      {[[92, 264], [56, 290], [106, 278], [50, 318], [100, 300]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5.5" fill={dot} />)}

      {/* tree, right */}
      <line x1="470" y1="360" x2="470" y2="268" stroke={ink} strokeWidth="3" />
      <path d="M470 300 L452 282 M470 288 L488 272" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="470" cy="246" r="34" fill={g300} />
      <circle cx="452" cy="232" r="18" fill={g500} opacity=".55" />
      <circle cx="488" cy="258" r="6" fill={ink} /><circle cx="452" cy="270" r="6" fill={ink} />

      {/* fingerprint terminal on its stand */}
      <g>
        <rect x="369" y="300" width="6" height="62" fill={ink} />
        <rect x="360" y="354" width="24" height="6" rx="2" fill={ink} />
        <rect x="355" y="262" width="34" height="44" rx="6" fill="#fff" stroke={ink} strokeWidth="2" />
        <rect x="360" y="267" width="24" height="12" rx="2" fill={g100} stroke={g300} strokeWidth="1.5" />
        <g stroke={g700} strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d="M366 299 C366 289 378 289 378 299" />
          <path d="M369 299 C369 293 375 293 375 299" />
          <path d="M363 297 C363 285 381 285 381 297" />
        </g>
        <circle cx="384" cy="270" r="2" fill={g500} />
      </g>

      {/* learner, reaching for the terminal */}
      <g>
        <path d="M398 360 L404 302 L414 302 L412 360 Z" fill={ink} />
        <path d="M418 360 L418 302 L428 302 L432 360 Z" fill={ink} />
        <path d="M396 362 h18 v6 h-22 z M416 362 h18 l4 6 h-22 z" fill={ink} />
        <path d="M396 304 C394 270 398 246 414 240 C430 246 436 270 434 304 Z" fill={g700} />
        <path d="M407 242 L414 256 L421 242" fill="#fff" />
        <rect x="408" y="226" width="12" height="16" rx="5" fill="#e8a383" />
        <circle cx="414" cy="216" r="15" fill="#e8a383" />
        <path d="M399 214 C399 196 428 194 430 212 C424 206 412 206 406 214 Z" fill={ink} />
        <path d="M400 256 C390 266 384 282 380 292" stroke="#e8a383" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M432 262 C436 272 434 284 428 290" stroke="#e8a383" strokeWidth="6" strokeLinecap="round" fill="none" />
        <rect x="420" y="282" width="16" height="20" rx="2" fill="#fff" stroke={ink} strokeWidth="1.6" />
      </g>

      {/* ground */}
      <line x1="24" y1="362" x2="500" y2="362" stroke={line} strokeWidth="1.6" />

      {/* leaves, front left */}
      <path d="M140 362 C112 330 108 300 120 276 C150 296 160 330 140 362 Z" fill={g300} stroke={ink} strokeWidth="1.4" />
      <path d="M144 362 C150 320 170 296 196 288 C196 322 176 350 144 362 Z" fill={ink} />
      <path d="M138 362 C120 342 92 336 72 340 C86 360 112 368 138 362 Z" fill={g200} stroke={ink} strokeWidth="1.4" />
      <path d="M140 362 L122 290" stroke={ink} strokeWidth="1.2" />
    </svg>
  )
}
