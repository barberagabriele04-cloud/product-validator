// Report page — convertito dal prototipo, parametrizzato su dati reali.
// Sezioni: header, hero (gauge + verdict), veto banner, radar 5D + breakdown
// table, dimension cards, strengths/risks, recommendation, economics deep-dive
// (solo se presente data + confidence high), footer.

"use client"

import Link from "next/link"
import {
  ConfidenceBadge,
  DIMENSION_META,
  DimensionCard,
  RadarChart5D,
  ScoreGauge,
  SCORE_PALETTE,
} from "@/components/visuals"
import type {
  AnalysisInput,
  ComplianceFlag,
  DimensionBreakdown,
  DimensionKey,
  EconomicsBreakdownData,
  FinalReport,
} from "@/agent/types"

// Il backend espone breakdown.economics.data come numeri puri
// (EconomicsBreakdownData) — risolti dall'aggregator. Il frontend lo consuma
// senza ulteriori conversioni.
export interface ReportPayload extends FinalReport {
}

export interface ReportPageData {
  jobId: string
  input: AnalysisInput
  /** ISO timestamp di submission (createdAt o startedAt). */
  submittedAt: string
  /** Durata effettiva start→completed in secondi. */
  durationSec: number
  report: ReportPayload
}

interface SectionLabelProps {
  num: string
  kicker: string
  title: string
  sub?: string
}

function SectionLabel({ num, kicker, title, sub }: SectionLabelProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 18,
        marginBottom: 24,
        paddingTop: 6,
        borderTop: "1px solid #1f1f1f",
      }}
    >
      <div
        style={{
          paddingTop: 14,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.22em",
          color: "#525252",
          minWidth: 60,
        }}
      >
        § {num}
      </div>
      <div style={{ flex: 1, paddingTop: 12 }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.28em",
            color: "#737373",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 38,
            color: "#fafafa",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            fontWeight: 400,
          }}
        >
          {title}
        </div>
        {sub !== undefined && (
          <div
            style={{
              marginTop: 10,
              color: "#737373",
              fontSize: 14,
              maxWidth: 600,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  )
}

// Banner compliance — separato dallo score di mercato. Renderizza solo se
// severity !== "none". Critical = rosso prominente; Warning = ambra discreto.
function ComplianceBanner({ alert }: { alert: ComplianceFlag }) {
  if (alert.severity === "none") return null

  const isCritical = alert.severity === "critical"
  const accent = isCritical ? "#ef4444" : "#eab308"
  const accentBg = isCritical ? "#2a0a0a" : "#1f1a08"
  const stripeBg = isCritical ? "#ef444408" : "#eab30808"
  const titleColor = isCritical ? "#fecaca" : "#fde68a"
  const bodyColor = isCritical ? "#fca5a5" : "#fcd34d"
  const kicker = isCritical
    ? "COMPLIANCE — PROBLEMA CRITICO"
    : "NOTE COMPLIANCE"
  const headline = isCritical
    ? "Questo prodotto è ristretto o ha problemi compliance da gestire prima del lancio."
    : "Note operative compliance da verificare con il fornitore."

  const platformsLabel =
    alert.restrictedPlatforms.length > 0
      ? alert.restrictedPlatforms.map((p) => p.toUpperCase()).join(" / ")
      : null

  return (
    <div
      style={{
        border: `1px solid ${accent}66`,
        background: `linear-gradient(135deg, ${accentBg} 0%, #0a0a0a 100%)`,
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(135deg, transparent 0, transparent 18px, ${stripeBg} 18px, ${stripeBg} 36px)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          gap: 18,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: `1.5px solid ${accent}`,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 22,
            fontWeight: 600,
            transform: "rotate(45deg)",
            flexShrink: 0,
          }}
        >
          <span style={{ transform: "rotate(-45deg)" }}>{isCritical ? "!" : "i"}</span>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.3em",
              color: accent,
              marginBottom: 6,
            }}
          >
            {kicker}
            {platformsLabel !== null && ` · RISTRETTO SU ${platformsLabel}`}
          </div>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 22,
              color: titleColor,
              lineHeight: 1.3,
              marginBottom: 10,
            }}
          >
            {headline}
          </div>
          <ul
            style={{
              color: bodyColor,
              fontSize: 14,
              lineHeight: 1.55,
              margin: 0,
              padding: 0,
              listStyle: "none",
            }}
          >
            {alert.reasons.map((r, i) => (
              <li
                key={i}
                style={{
                  paddingLeft: 16,
                  position: "relative",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    color: accent,
                  }}
                >
                  ›
                </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// Sezione "COMPLIANCE & LEGAL" — sempre presente, anche se severity=none.
// Comunica trasparenza: l'utente vede sempre lo stato compliance del prodotto.
function ComplianceLegalSection({ alert }: { alert: ComplianceFlag }) {
  const trademarkLabel: Record<ComplianceFlag["trademarkRisk"], string> = {
    low: "Basso",
    medium: "Moderato",
    high: "Elevato",
    unknown: "Sconosciuto",
  }
  const restrictedLabel =
    alert.restrictedPlatforms.length > 0
      ? `Sì, su ${alert.restrictedPlatforms.map((p) => p.toUpperCase()).join(" / ")}`
      : "No"
  const ceLabel = alert.ceComplianceRequired ? "Richiesta" : "Non richiesta"
  const trademarkLine =
    alert.trademarkDetails !== null && alert.trademarkDetails !== ""
      ? `${trademarkLabel[alert.trademarkRisk]} — ${alert.trademarkDetails}`
      : trademarkLabel[alert.trademarkRisk]

  return (
    <div
      style={{
        border: "1px solid #1f1f1f",
        background: "#0c0c0c",
        padding: 24,
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.28em",
          color: "#737373",
          marginBottom: 16,
        }}
      >
        COMPLIANCE & LEGAL
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ComplianceRow
          label="Categoria ristretta"
          value={restrictedLabel}
          accent={alert.restrictedCategory ? "#ef4444" : "#a3a3a3"}
        />
        <ComplianceRow
          label="Rischio trademark"
          value={trademarkLine}
          accent={
            alert.trademarkRisk === "high"
              ? "#ef4444"
              : alert.trademarkRisk === "medium"
                ? "#eab308"
                : "#a3a3a3"
          }
        />
        <ComplianceRow
          label="Marcatura CE"
          value={ceLabel}
          accent={alert.ceComplianceRequired ? "#eab308" : "#a3a3a3"}
        />
      </div>
    </div>
  )
}

function ComplianceRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: string
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 16,
        alignItems: "baseline",
        borderTop: "1px solid #1f1f1f",
        paddingTop: 10,
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "#737373",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ color: accent, fontSize: 14, lineHeight: 1.45 }}>
        {value}
      </span>
    </div>
  )
}

interface StrengthsRisksProps {
  strengths: readonly string[]
  risks: readonly string[]
}

function StrengthsRisks({ strengths, risks }: StrengthsRisksProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 1,
        background: "#1f1f1f",
        border: "1px solid #1f1f1f",
      }}
    >
      <div style={{ background: "#0a0a0a", padding: "28px 28px 32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 22,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              background: "#22e36a",
              borderRadius: 999,
              boxShadow: "0 0 8px #22e36a",
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.24em",
              color: "#22e36a",
            }}
          >
            PUNTI DI FORZA
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#525252",
              marginLeft: "auto",
            }}
          >
            03
          </span>
        </div>
        {strengths.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 16,
              padding: "16px 0",
              borderTop: i === 0 ? "none" : "1px dashed #1f1f1f",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#22e36a",
                paddingTop: 3,
                minWidth: 22,
              }}
            >
              +{i + 1}
            </div>
            <div style={{ color: "#d4d4d4", fontSize: 14, lineHeight: 1.55 }}>
              {s}
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "#0a0a0a", padding: "28px 28px 32px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 22,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              background: "#ef4444",
              borderRadius: 999,
              boxShadow: "0 0 8px #ef4444",
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.24em",
              color: "#ef4444",
            }}
          >
            RISCHI E OSTACOLI
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "#525252",
              marginLeft: "auto",
            }}
          >
            03
          </span>
        </div>
        {risks.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 16,
              padding: "16px 0",
              borderTop: i === 0 ? "none" : "1px dashed #1f1f1f",
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "#ef4444",
                paddingTop: 3,
                minWidth: 22,
              }}
            >
              −{i + 1}
            </div>
            <div style={{ color: "#d4d4d4", fontSize: 14, lineHeight: 1.55 }}>
              {s}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface EconomicsPanelProps {
  data: EconomicsBreakdownData
  userBudget: number
}

function EconomicsPanel({ data, userBudget }: EconomicsPanelProps) {
  const profitable = data.profitableAtUserBudget
  // Il backend espone grossMarginPct come frazione 0-1. Convertiamo a 0-100
  // per la visualizzazione donut e percentuale.
  const marginPct = Math.round(data.grossMarginPct * 100)
  const C = 2 * Math.PI * 64

  return (
    <div style={{ border: "1px solid #1f1f1f", background: "#0c0c0c", padding: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 28,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.28em",
              color: "#737373",
            }}
          >
            DEEP-DIVE · UNIT ECONOMICS
          </div>
          <div
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 26,
              color: "#fafafa",
              marginTop: 6,
            }}
          >
            La matematica del prodotto
          </div>
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "#525252",
          }}
        >
          CATEGORY:{" "}
          <span style={{ color: "#a3a3a3" }}>{data.categoryClassification}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "200px 1fr",
          gap: 40,
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", width: 180, height: 180 }}>
          <svg width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="64" fill="none" stroke="#1f1f1f" strokeWidth="20" />
            <circle
              cx="90"
              cy="90"
              r="64"
              fill="none"
              stroke="#22e36a"
              strokeWidth="20"
              strokeDasharray={`${(marginPct / 100) * C} ${C}`}
              strokeDashoffset={C / 4}
              transform="rotate(-90 90 90)"
              strokeLinecap="butt"
              style={{ filter: "drop-shadow(0 0 6px #22e36a44)" }}
            />
            <text
              x="90"
              y="86"
              textAnchor="middle"
              fill="#fafafa"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="34"
              fontWeight="500"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {marginPct}
              <tspan fontSize="18" fill="#737373">
                %
              </tspan>
            </text>
            <text
              x="90"
              y="106"
              textAnchor="middle"
              fill="#737373"
              fontFamily="'JetBrains Mono', monospace"
              fontSize="9"
              letterSpacing="0.24em"
            >
              MARGINE LORDO
            </text>
          </svg>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            background: "#1f1f1f",
            border: "1px solid #1f1f1f",
          }}
        >
          {[
            {
              label: "COGS",
              val: `€${formatNumber(data.estimatedCogs)}`,
              hint: "Costo unitario",
            },
            {
              label: "RETAIL SUGG.",
              val: `€${formatNumber(data.suggestedRetailPrice)}`,
              hint: "Prezzo consigliato",
            },
            {
              label: "BREAKEVEN ROAS",
              val: data.breakevenRoas.toFixed(2),
              hint: "Soglia di pareggio",
            },
            {
              label: "CPM STIMATO",
              val: `€${formatNumber(data.estimatedCpm)}`,
              hint: "Costo per 1k impr.",
            },
            {
              label: "CPA STIMATO",
              val: `€${formatNumber(data.estimatedCpa)}`,
              hint: "Costo per acquisto",
            },
            {
              label: "RESI ATTESI",
              val: `${(data.expectedReturnRate * 100).toFixed(1)}%`,
              hint: "Quota ordini",
            },
          ].map((m, i) => (
            <div key={i} style={{ background: "#0c0c0c", padding: "16px 18px" }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.22em",
                  color: "#525252",
                  marginBottom: 6,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 22,
                  color: "#fafafa",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {m.val}
              </div>
              <div style={{ fontSize: 11, color: "#737373", marginTop: 4 }}>
                {m.hint}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 28,
          padding: "20px 22px",
          border: "1px solid #1f1f1f",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "#737373",
            }}
          >
            CPA STIMATO ÷ BUDGET MENSILE ={" "}
            {Math.floor(userBudget / Math.max(1, data.estimatedCpa))} ACQUISTI / MESE
          </div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.22em",
              color: profitable ? "#22e36a" : "#ef4444",
              border: `1px solid ${profitable ? "#22e36a55" : "#ef444455"}`,
              padding: "4px 10px",
            }}
          >
            {profitable ? "✓ PROFITTEVOLE" : "✗ NON PROFITTEVOLE"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, height: 28, background: "#1a1a1a" }}>
          <div
            style={{
              width: `${Math.min(60, (data.estimatedCpa / Math.max(1, userBudget)) * 100 * 30)}%`,
              background: "#22e36a",
              display: "flex",
              alignItems: "center",
              paddingLeft: 8,
              color: "#0a0a0a",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            CPA €{formatNumber(data.estimatedCpa)}
          </div>
          <div
            style={{
              flex: 1,
              background: "#262626",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 8,
              color: "#a3a3a3",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
            }}
          >
            BUDGET €{userBudget}/MESE
          </div>
        </div>
      </div>
    </div>
  )
}

function formatNumber(n: number): string {
  return n.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export interface ReportPageProps {
  data: ReportPageData
  /**
   * Disabilita il bottone "Scarica PDF" (es. nella pagina /esempio dove
   * il report è hardcoded e non esiste in db).
   */
  pdfDownloadDisabled?: boolean
}

export function ReportPage({ data, pdfDownloadDisabled }: ReportPageProps) {
  const { input, submittedAt, durationSec, report: r, jobId } = data
  const palette = SCORE_PALETTE[r.color]
  const submittedDate = new Date(submittedAt)
  const dateStr = submittedDate.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  const timeStr = submittedDate.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  })
  const shortJob = jobId.slice(-7).toUpperCase()

  const dimEntries: ReadonlyArray<[DimensionKey, DimensionBreakdown]> = [
    ["demand", r.breakdown.demand],
    ["saturation", r.breakdown.saturation],
    ["economics", r.breakdown.economics],
    ["fit", r.breakdown.fit],
    ["risk", r.breakdown.risk],
  ]

  const radarScores = {
    demand: {
      score: r.breakdown.demand.score,
      dataConfidence: r.breakdown.demand.dataConfidence,
    },
    saturation: {
      score: r.breakdown.saturation.score,
      dataConfidence: r.breakdown.saturation.dataConfidence,
    },
    economics: {
      score: r.breakdown.economics.score,
      dataConfidence: r.breakdown.economics.dataConfidence,
    },
    fit: {
      score: r.breakdown.fit.score,
      dataConfidence: r.breakdown.fit.dataConfidence,
    },
    risk: {
      score: r.breakdown.risk.score,
      dataConfidence: r.breakdown.risk.dataConfidence,
    },
  }

  const showEconomicsPanel =
    r.breakdown.economics.dataConfidence === "high" &&
    r.breakdown.economics.data !== undefined

  const durationMin = Math.floor(durationSec / 60)
  const durationSecRem = String(durationSec % 60).padStart(2, "0")

  const channelLabel = input.userChannel
    .replace(/_/g, " · ")
    .toUpperCase()

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
          ai.udit<span style={{ color: palette.hex }}>_</span>
        </Link>
        <span style={{ color: "#404040" }}>/</span>
        <span>
          REPORT · {dateStr.toUpperCase()} · {timeStr}
        </span>
        <span style={{ color: "#404040" }}>·</span>
        <span>JOB #{shortJob}</span>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          {pdfDownloadDisabled === true ? (
            <span
              title="Disponibile solo per analisi salvate in database"
              style={{
                background: "transparent",
                border: "1px solid #1f1f1f",
                color: "#525252",
                padding: "6px 14px",
                fontFamily: "inherit",
                fontSize: 10,
                letterSpacing: "0.2em",
                cursor: "not-allowed",
              }}
            >
              ↓ PDF (N/D NEGLI ESEMPI)
            </span>
          ) : (
            <a
              href={`/api/job/${jobId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "transparent",
                border: `1px solid ${palette.hex}55`,
                color: palette.hex,
                padding: "6px 14px",
                fontFamily: "inherit",
                fontSize: 10,
                letterSpacing: "0.2em",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              ↓ SCARICA PDF
            </a>
          )}
          <Link
            href="/analyze"
            style={{
              background: "transparent",
              border: "1px solid #1f1f1f",
              color: "#a3a3a3",
              padding: "6px 14px",
              fontFamily: "inherit",
              fontSize: 10,
              letterSpacing: "0.2em",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            NUOVA ANALISI →
          </Link>
        </span>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 48px 80px" }}>
        <div style={{ marginBottom: 56 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.28em",
              color: "#525252",
              marginBottom: 14,
            }}
          >
            VERDETTO · ANALISI #{shortJob}
          </div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 56,
              fontWeight: 400,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              margin: 0,
              marginBottom: 12,
              color: "#fafafa",
            }}
          >
            {input.productName}
          </h1>
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              color: "#737373",
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span>{channelLabel}</span>
            <span style={{ color: "#404040" }}>·</span>
            <span>MERCATO {input.userMarket}</span>
            <span style={{ color: "#404040" }}>·</span>
            <span>BUDGET €{input.userBudget}/MESE</span>
            {input.productCogs !== undefined && (
              <>
                <span style={{ color: "#404040" }}>·</span>
                <span>COGS €{input.productCogs}</span>
              </>
            )}
            <span style={{ color: "#404040" }}>·</span>
            <span>
              IMG {input.userImageExperience.toUpperCase()} · VIDEO{" "}
              {input.userVideoExperience.toUpperCase()}
            </span>
          </div>
        </div>

        {r.complianceAlert.severity !== "none" && (
          <div style={{ marginBottom: 40 }}>
            <ComplianceBanner alert={r.complianceAlert} />
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 40,
            alignItems: "center",
            padding: "40px 0",
            borderTop: "1px solid #1f1f1f",
            borderBottom: "1px solid #1f1f1f",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ScoreGauge score={r.score} color={r.color} size={340} />
          </div>
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.28em",
                color: palette.hex,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  background: palette.hex,
                  borderRadius: 999,
                  boxShadow: `0 0 6px ${palette.hex}`,
                }}
              />
              SINTESI · 2 FRASI
            </div>
            <p
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: 22,
                lineHeight: 1.45,
                color: "#e5e5e5",
                margin: 0,
                letterSpacing: "-0.005em",
                fontWeight: 400,
              }}
            >
              {r.verdict}
            </p>
          </div>
        </div>

        {/* §01 Radar */}
        <div style={{ marginTop: 56 }}>
          <SectionLabel
            num="01"
            kicker="ASSE MULTI-DIMENSIONALE"
            title="Le 5 dimensioni dell'analisi"
            sub="Ogni asse rappresenta una valutazione indipendente: domanda, saturazione, economia, fit operativo, rischio. La forma del poligono dice di più della singola somma."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 56,
              alignItems: "center",
              padding: "20px 0",
            }}
          >
            <RadarChart5D scores={radarScores} color={r.color} size={420} />
            <div style={{ borderLeft: "1px solid #1f1f1f", paddingLeft: 32 }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.24em",
                  color: "#525252",
                  marginBottom: 20,
                }}
              >
                INTEGRITÀ DATI · {Math.round(r.dataIntegrity * 100)}%
              </div>
              {dimEntries.map(([k, v]) => {
                const m = DIMENSION_META[k]
                const sc =
                  v.score >= 70
                    ? "#84cc16"
                    : v.score >= 55
                      ? "#eab308"
                      : v.score >= 40
                        ? "#f97316"
                        : "#ef4444"
                return (
                  <div
                    key={k}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "60px 1fr 50px 60px",
                      gap: 16,
                      alignItems: "center",
                      padding: "10px 0",
                      borderTop: "1px solid #1f1f1f",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        color: "#737373",
                        letterSpacing: "0.18em",
                      }}
                    >
                      {m.glyph}
                    </div>
                    <div
                      style={{
                        fontFamily: "'Fraunces', serif",
                        fontSize: 16,
                        color: "#fafafa",
                      }}
                    >
                      {m.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 18,
                        color: sc,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {v.score}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <ConfidenceBadge confidence={v.dataConfidence} size="sm" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* §02 Breakdown cards */}
        <div style={{ marginTop: 64 }}>
          <SectionLabel
            num="02"
            kicker="DETTAGLIO PER DIMENSIONE"
            title="Il dettaglio dietro ogni numero"
            sub="Le card affidabili (verde) sono utilizzabili per decisioni operative. Le card sbiadite hanno confidenza bassa: usale come ipotesi, non come verità."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 12,
            }}
          >
            {dimEntries.map(([k, v]) => (
              <DimensionCard key={k} dimKey={k} data={v} />
            ))}
          </div>
        </div>

        {/* §03 Strengths/Risks */}
        <div style={{ marginTop: 64 }}>
          <SectionLabel
            num="03"
            kicker="POLARIZZAZIONI"
            title="Da una parte la forza, dall'altra il rischio"
          />
          <StrengthsRisks strengths={r.strengths} risks={r.risks} />
        </div>

        {/* §04 Recommendation */}
        <div style={{ marginTop: 64 }}>
          <SectionLabel
            num="04"
            kicker="DECISIONE OPERATIVA"
            title="Cosa fare adesso, in concreto"
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: 32,
              alignItems: "flex-start",
              border: `1px solid ${palette.hex}33`,
              background: `linear-gradient(135deg, ${palette.hex}08 0%, transparent 60%)`,
              padding: "32px 36px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 96,
                  color: palette.hex,
                  lineHeight: 1,
                  fontWeight: 400,
                  opacity: 0.7,
                }}
              >
                ⤳
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  color: palette.hex,
                  marginBottom: 14,
                }}
              >
                RACCOMANDAZIONE OPERATIVA
              </div>
              <p
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: 20,
                  lineHeight: 1.5,
                  color: "#e5e5e5",
                  margin: 0,
                  fontWeight: 400,
                }}
              >
                {r.recommendation}
              </p>
            </div>
          </div>
        </div>

        {/* §05 Economics — solo se data presente */}
        {showEconomicsPanel && r.breakdown.economics.data !== undefined && (
          <div style={{ marginTop: 64 }}>
            <SectionLabel
              num="05"
              kicker="UNIT ECONOMICS · ALTA CONFIDENZA"
              title="La matematica dietro al verdetto"
              sub="Numeri stimati a partire dal COGS dichiarato, dal canale, dal mercato e dai benchmark del backend."
            />
            <EconomicsPanel
              data={r.breakdown.economics.data}
              userBudget={input.userBudget}
            />
          </div>
        )}

        {/* §06 Compliance & Legal — sempre presente, anche se severity=none. */}
        <div style={{ marginTop: 64 }}>
          <SectionLabel
            num="06"
            kicker="DETTAGLI LEGALI"
            title="Compliance & Legal"
            sub="Stato compliance del prodotto. Non incide sullo score di mercato — è informazione operativa per gestire vendita e advertising."
          />
          <ComplianceLegalSection alert={r.complianceAlert} />
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 72,
            paddingTop: 28,
            borderTop: "1px solid #1f1f1f",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
          }}
        >
          {[
            {
              label: "INTEGRITÀ DATI",
              val: `${Math.round(r.dataIntegrity * 100)}%`,
              sub: "5 worker su 5",
            },
            {
              label: "DURATA ANALISI",
              val: `${durationMin}:${durationSecRem}`,
              sub: "minuti:secondi",
            },
            {
              label: "COSTO ANALISI",
              val: `€${r.totalCostEur.toFixed(3)}`,
              sub: "compute + fonti",
            },
            {
              label: "WORKER ATTIVI",
              val: "5 / 5",
              sub: "demand·sat·eco·fit·risk",
            },
          ].map((s, i) => (
            <div key={i}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  color: "#525252",
                  marginBottom: 8,
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 22,
                  color: "#fafafa",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.val}
              </div>
              <div style={{ fontSize: 11, color: "#737373", marginTop: 2 }}>
                {s.sub}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 56,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Link
            href="/analyze"
            style={{
              background: palette.hex,
              border: "none",
              color: "#0a0a0a",
              padding: "16px 32px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.18em",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            ANALIZZA UN ALTRO PRODOTTO →
          </Link>
        </div>
      </div>
    </div>
  )
}

