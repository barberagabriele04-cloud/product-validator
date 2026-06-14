// Loading page — convertita dal prototipo, adattata a Next.js + polling reale.
//
// Differenze rispetto al prototipo:
// - Non riceve più una "fixture": riceve productName + jobId + startedAt da
//   /api/job/[jobId]. Il calcolo dello stage e dell'elapsed deriva da startedAt.
// - thoughtsSampled NON è popolato dal backend. Il prototipo era cosmetic; lo
//   mantengo come array statico locale di frasi credibili.
//   TODO Phase 4: stream eventi reali dall'orchestrator via SSE per thought
//   stream genuino.

"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

interface LoadingPageProps {
  productName: string
  jobId: string
  startedAt: string | null
  /** Durata attesa per calcolare la progress bar; default 150s. */
  expectedDurationSec?: number
}

const STATIC_THOUGHTS: ReadonlyArray<string> = [
  "Cercando volume di ricerca su Google Trends...",
  "Analizzando momentum hashtag TikTok...",
  "Scansionando Meta Ad Library per ads attive...",
  "Stimando saturazione store Shopify...",
  "Calcolando unit economics dal COGS...",
  "Lookup CPM/CPA dai benchmark categoria...",
  "Cross-check policy pubblicitarie e veto rules...",
  "Verificando rischio trademark e compliance...",
  "Aggregazione score pesato 5 dimensioni...",
  "Generazione narrativa verdetto e raccomandazione...",
]

const STAGES = [
  {
    key: "demand",
    name: "Domanda di mercato",
    glyph: "DEM",
    desc: "Google Trends · TikTok · keyword volume",
  },
  {
    key: "saturation",
    name: "Saturazione concorrenza",
    glyph: "SAT",
    desc: "Meta Ad Library · Amazon · brand check",
  },
  {
    key: "economics",
    name: "Economia unitaria",
    glyph: "ECO",
    desc: "COGS · margine · breakeven · ROAS",
  },
  {
    key: "fit",
    name: "Fit operativo",
    glyph: "FIT",
    desc: "canale · capacità creativa · setup",
  },
  {
    key: "risk",
    name: "Rischio e compliance",
    glyph: "RSK",
    desc: "veto rules · normative · resi attesi",
  },
] as const

export function LoadingPage({
  productName,
  jobId,
  startedAt,
  expectedDurationSec = 150,
}: LoadingPageProps) {
  const startMsRef = useRef<number>(
    startedAt !== null ? new Date(startedAt).getTime() : Date.now(),
  )
  const [elapsed, setElapsed] = useState(0)
  const [thoughtCount, setThoughtCount] = useState(0)

  useEffect(() => {
    startMsRef.current =
      startedAt !== null ? new Date(startedAt).getTime() : Date.now()
  }, [startedAt])

  useEffect(() => {
    const tick = setInterval(() => {
      setElapsed((Date.now() - startMsRef.current) / 1000)
    }, 100)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    const intervalMs = (expectedDurationSec * 1000) / (STATIC_THOUGHTS.length + 1)
    const t = setInterval(() => {
      setThoughtCount((n) => Math.min(STATIC_THOUGHTS.length, n + 1))
    }, intervalMs)
    return () => clearInterval(t)
  }, [expectedDurationSec])

  const progress = Math.min(1, elapsed / expectedDurationSec)
  const currentStage = Math.min(4, Math.floor(progress * 5))
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0")
  const ss = String(Math.floor(elapsed % 60)).padStart(2, "0")
  const visibleThoughts = STATIC_THOUGHTS.slice(0, thoughtCount)
  const shortJob = jobId.slice(-7).toUpperCase()

  return (
    <div style={{ background: "#0a0a0a", color: "#fafafa", minHeight: "100vh" }}>
      <div
        style={{
          borderBottom: "1px solid #1f1f1f",
          padding: "14px 48px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#737373",
        }}
      >
        <Link
          href="/"
          style={{
            background: "transparent",
            border: "none",
            color: "#fafafa",
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.08em",
            cursor: "pointer",
            padding: 0,
            textDecoration: "none",
          }}
        >
          ai.udit<span style={{ color: "#22e36a" }}>_</span>
        </Link>
        <span style={{ color: "#404040" }}>/</span>
        <span>
          ANALISI IN CORSO · {mm}:{ss}
        </span>
        <span style={{ marginLeft: "auto" }}>JOB #{shortJob}</span>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 48px" }}>
        <div style={{ marginBottom: 56 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.28em",
              color: "#22e36a",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                background: "#22e36a",
                borderRadius: 999,
                boxShadow: "0 0 8px #22e36a",
                animation: "pulse 1.4s infinite",
              }}
            />
            ANALISI IN CORSO · 5 WORKER PARALLELI
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 48,
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: 0,
              marginBottom: 12,
              color: "#fafafa",
            }}
          >
            Sto analizzando{" "}
            <span style={{ color: "#22e36a" }}>{productName}</span>
          </h1>
          <p style={{ color: "#a3a3a3", fontSize: 15, maxWidth: 640, lineHeight: 1.5 }}>
            L'agente sta raccogliendo dati da fonti web in tempo reale: Google
            Trends, TikTok, Meta Ad Library, Amazon, fonti normative. L'analisi
            richiede 1-3 minuti — non chiudere la pagina.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 1,
            background: "#1f1f1f",
            border: "1px solid #1f1f1f",
          }}
        >
          <div style={{ background: "#0a0a0a", padding: 36 }}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.28em",
                color: "#525252",
                marginBottom: 28,
              }}
            >
              WORKER PARALLELI · 5 / 5
            </div>

            {STAGES.map((s, i) => {
              const status =
                i < currentStage ? "done" : i === currentStage ? "running" : "pending"
              const colorByStatus =
                status === "done"
                  ? "#22e36a"
                  : status === "running"
                    ? "#eab308"
                    : "#404040"
              return (
                <div
                  key={s.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr auto",
                    gap: 20,
                    alignItems: "center",
                    padding: "18px 0",
                    borderTop: i === 0 ? "none" : "1px solid #1f1f1f",
                  }}
                >
                  <div style={{ position: "relative", width: 44, height: 44 }}>
                    {status === "running" && (
                      <svg
                        width="44"
                        height="44"
                        viewBox="0 0 44 44"
                        style={{ position: "absolute" }}
                      >
                        <circle
                          cx="22"
                          cy="22"
                          r="20"
                          fill="none"
                          stroke="#1f1f1f"
                          strokeWidth="2"
                        />
                        <circle
                          cx="22"
                          cy="22"
                          r="20"
                          fill="none"
                          stroke="#eab308"
                          strokeWidth="2"
                          strokeDasharray="80 200"
                          strokeLinecap="round"
                          style={{
                            animation: "spin 1.2s linear infinite",
                            transformOrigin: "center",
                          }}
                        />
                      </svg>
                    )}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        border: `1.5px solid ${
                          status === "running" ? "transparent" : colorByStatus
                        }`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        color: colorByStatus,
                        background:
                          status === "done" ? `${colorByStatus}10` : "transparent",
                      }}
                    >
                      {status === "done" ? "✓" : s.glyph}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 10,
                          color: "#525252",
                          letterSpacing: "0.18em",
                        }}
                      >
                        0{i + 1}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Fraunces', serif",
                          fontSize: 18,
                          color: status === "pending" ? "#525252" : "#fafafa",
                        }}
                      >
                        {s.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: status === "pending" ? "#404040" : "#737373",
                        marginTop: 4,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {s.desc}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      color: colorByStatus,
                      padding: "4px 8px",
                      border: `1px solid ${colorByStatus}55`,
                    }}
                  >
                    {status === "done" ? "DONE" : status === "running" ? "RUN" : "WAIT"}
                  </div>
                </div>
              )
            })}

            <div
              style={{
                marginTop: 32,
                paddingTop: 24,
                borderTop: "1px solid #1f1f1f",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: "#737373",
                  marginBottom: 10,
                }}
              >
                <span>PROGRESSO COMPLESSIVO</span>
                <span style={{ color: "#fafafa", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <div style={{ height: 4, background: "#1a1a1a", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${progress * 100}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #22e36a, #84cc16, #eab308)",
                    transition: "width 0.2s linear",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#0a0a0a",
              padding: 36,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.28em",
                color: "#525252",
                marginBottom: 24,
              }}
            >
              STREAM RAGIONAMENTO
            </div>
            <div
              style={{
                flex: 1,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                lineHeight: 1.7,
                color: "#a3a3a3",
                minHeight: 460,
                position: "relative",
              }}
            >
              {visibleThoughts.map((text, i) => {
                const tsec = Math.floor(
                  (i / STATIC_THOUGHTS.length) * expectedDurationSec,
                )
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "5px 0",
                      opacity: i === visibleThoughts.length - 1 ? 1 : 0.65,
                      animation: "fadeIn 0.4s ease-out",
                    }}
                  >
                    <span style={{ color: "#404040", flexShrink: 0 }}>
                      [{String(tsec).padStart(2, "0")}s]
                    </span>
                    <span
                      style={{
                        color:
                          i === visibleThoughts.length - 1 ? "#22e36a" : "#737373",
                      }}
                    >
                      ›
                    </span>
                    <span style={{ flex: 1 }}>{text}</span>
                  </div>
                )
              })}
              {visibleThoughts.length < STATIC_THOUGHTS.length && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: "5px 0",
                    color: "#22e36a",
                  }}
                >
                  <span style={{ color: "#404040" }}>
                    [{mm.slice(1)}
                    {ss[0]}s]
                  </span>
                  <span>›</span>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 14,
                      background: "#22e36a",
                      animation: "blink 1s steps(2) infinite",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1,
            background: "#1f1f1f",
            border: "1px solid #1f1f1f",
          }}
        >
          {[
            { l: "TEMPO TRASCORSO", v: `${mm}:${ss}` },
            { l: "TEMPO MEDIO", v: "01:42" },
            { l: "WORKER ATTIVI", v: `${currentStage + 1} / 5` },
            {
              l: "STATO POLLING",
              v: progress >= 1 ? "ATTESA" : "ATTIVO",
            },
          ].map((s, i) => (
            <div key={i} style={{ background: "#0a0a0a", padding: "16px 20px" }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: "#525252",
                }}
              >
                {s.l}
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 18,
                  color: "#fafafa",
                  marginTop: 4,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
