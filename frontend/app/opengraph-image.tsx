import { ImageResponse } from "next/og"

export const alt = "Shulepoa Attendance — biometric school attendance system in Kenya"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// The card shown when the site is shared on WhatsApp, Facebook, X or LinkedIn.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #14532d 0%, #166534 45%, #16a34a 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 20,
              background: "white",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 900,
            }}
          >
            S
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, fontWeight: 800 }}>Shulepoa Attendance</div>
            <div style={{ fontSize: 24, opacity: 0.8 }}>attedance.shulepoa.co.ke</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>
            Know who&apos;s in school the second they arrive.
          </div>
          <div style={{ fontSize: 30, opacity: 0.88 }}>
            Fingerprint clock-in · Instant parent SMS · Live registers · PDF reports
          </div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["Built for Kenyan schools", "ZKTeco devices", "No school server needed"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.3)",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}
