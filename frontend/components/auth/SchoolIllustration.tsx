// A flat school scene for the sign-in page: the school building with its flag,
// trees, a learner holding a book, and soft leaves — in the brand greens with
// greys. Pure SVG, so it is crisp at any size and costs nothing to load.
//
// Colours come from the --auth-* tokens set on the auth frame (AuthLayout), so
// the whole scene follows whatever brand palette that frame declares.
// Gentle motion (drifting clouds, waving flag, swaying tree, a learner who
// breathes) is defined in globals.css under "auth illustration" and switches
// itself off for people who prefer reduced motion.

export default function SchoolIllustration({ className }: { className?: string }) {
  const g900 = "var(--auth-900)"
  const g700 = "var(--auth-700)"
  const g500 = "var(--auth-500)"
  const g300 = "var(--auth-300)"
  const g200 = "var(--auth-200)"
  const g100 = "var(--auth-100)"
  const ink = "#1f2937"
  const line = "#94a3b8"
  const dot = "#cbd5e1"
  const skin = "#e8a383"

  return (
    <svg viewBox="0 0 520 440" className={className} role="img" aria-label="A school with a learner holding a book">
      {/* sky */}
      <circle cx="96" cy="88" r="48" fill={g200} opacity=".75" className="ai-sun" />
      <circle cx="430" cy="70" r="18" fill={g100} />
      <ellipse cx="150" cy="104" rx="34" ry="11" fill="#fff" opacity=".85" className="ai-cloud" />
      <ellipse cx="392" cy="118" rx="28" ry="9" fill="#fff" opacity=".85" className="ai-cloud ai-cloud-slow" />

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
        <path d="M257 186 V194 L263 198" stroke={g900} strokeWidth="2.5" strokeLinecap="round" fill="none" className="ai-clock" />
        {/* flag */}
        <line x1="257" y1="150" x2="257" y2="108" stroke={ink} strokeWidth="2.5" />
        <path d="M258 110 C270 104 278 116 292 110 L292 128 C278 134 270 122 258 128 Z" fill={g500} className="ai-flag" />
        {/* windows */}
        {[166, 202, 284, 320].map((x, i) => (
          <g key={x}>
            <rect x={x} y="236" width="28" height="34" rx="3" fill={g100} stroke={g300} strokeWidth="2"
              className="ai-window" style={{ animationDelay: `${i * 0.7}s` }} />
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
      {[[92, 264], [56, 290], [106, 278], [50, 318], [100, 300]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5.5" fill={dot} />
      ))}

      {/* tree, right */}
      <line x1="470" y1="360" x2="470" y2="268" stroke={ink} strokeWidth="3" />
      <g className="ai-sway">
        <path d="M470 300 L452 282 M470 288 L488 272" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="470" cy="246" r="34" fill={g300} />
        <circle cx="452" cy="232" r="18" fill={g500} opacity=".55" />
        <circle cx="488" cy="258" r="6" fill={ink} /><circle cx="452" cy="270" r="6" fill={ink} />
      </g>

      {/* learner with a book */}
      <g>
        <path d="M398 360 L404 302 L414 302 L412 360 Z" fill={ink} />
        <path d="M418 360 L418 302 L428 302 L432 360 Z" fill={ink} />
        <path d="M396 362 h18 v6 h-22 z M416 362 h18 l4 6 h-22 z" fill={ink} />
        <g className="ai-breathe">
          <path d="M396 304 C394 270 398 246 414 240 C430 246 436 270 434 304 Z" fill={g700} />
          <path d="M407 242 L414 256 L421 242" fill="#fff" />
          <rect x="408" y="226" width="12" height="16" rx="5" fill={skin} />
          <g className="ai-nod">
            <circle cx="414" cy="216" r="15" fill={skin} />
            <path d="M399 214 C399 196 428 194 430 212 C424 206 412 206 406 214 Z" fill={ink} />
          </g>
          {/* book held open */}
          <path d="M388 268 L412 274 L412 296 L388 290 Z" fill="#fff" stroke={ink} strokeWidth="1.8" />
          <path d="M412 274 L436 268 L436 290 L412 296 Z" fill={g100} stroke={ink} strokeWidth="1.8" />
          <path d="M394 262 C390 270 392 280 398 284" stroke={skin} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M434 262 C438 270 436 280 430 284" stroke={skin} strokeWidth="6" strokeLinecap="round" fill="none" />
        </g>
      </g>

      {/* ground */}
      <line x1="24" y1="362" x2="500" y2="362" stroke={line} strokeWidth="1.6" />

      {/* leaves, front left */}
      <g className="ai-sway ai-sway-alt">
        <path d="M140 362 C112 330 108 300 120 276 C150 296 160 330 140 362 Z" fill={g300} stroke={ink} strokeWidth="1.4" />
        <path d="M144 362 C150 320 170 296 196 288 C196 322 176 350 144 362 Z" fill={ink} />
        <path d="M138 362 C120 342 92 336 72 340 C86 360 112 368 138 362 Z" fill={g200} stroke={ink} strokeWidth="1.4" />
        <path d="M140 362 L122 290" stroke={ink} strokeWidth="1.2" />
      </g>

      {/* small flower */}
      <line x1="372" y1="362" x2="372" y2="338" stroke={ink} strokeWidth="1.6" />
      <circle cx="372" cy="334" r="5" fill={ink} />
      <circle cx="360" cy="352" r="3" fill="#f43f5e" />
    </svg>
  )
}
