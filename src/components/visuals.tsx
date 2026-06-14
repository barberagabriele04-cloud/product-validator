// Visual primitives + palette del prototipo ai.udit_.
// ScoreGauge, RadarChart5D, ConfidenceBadge, MiniBar, DimensionCard.
// Stili inline preservati identici al prototipo originale.

"use client"

import { useEffect, useState, type CSSProperties } from "react"
import type {
  DataConfidence,
  DimensionKey,
  ReportColor,
} from "@/agent/types"

// ─────────────────────────────────────────────────────────────────────
// Palettes — chiavi allineate ai literal del backend (verde-acceso con
// hyphen come in src/agent/types.ts).
// ─────────────────────────────────────────────────────────────────────

interface ScorePalette {
  hex: string
  label: string
  subtitle: string
  min: number
}

export const SCORE_PALETTE: Record<ReportColor, ScorePalette> = {
  "verde-acceso": {
    hex: "#22e36a",
    label: "Eccellente",
    subtitle: "Opportunità rara",
    min: 85,
  },
  verde: {
    hex: "#84cc16",
    label: "Buono",
    subtitle: "Consigliato testare",
    min: 70,
  },
  giallo: {
    hex: "#eab308",
    label: "Cauto",
    subtitle: "Opportunità con riserve",
    min: 55,
  },
  arancione: {
    hex: "#f97316",
    label: "Difficile",
    subtitle: "Molti ostacoli",
    min: 40,
  },
  rosso: {
    hex: "#ef4444",
    label: "Sconsigliato",
    subtitle: "Non procedere",
    min: 0,
  },
}

interface ConfidencePaletteEntry {
  hex: string
  label: string
  shortLabel: string
  description: string
}

export const CONFIDENCE_PALETTE: Record<DataConfidence, ConfidencePaletteEntry> = {
  high: {
    hex: "#22e36a",
    label: "Alta",
    shortLabel: "ALTA",
    description: "Dati osservati da fonti autorevoli",
  },
  medium: {
    hex: "#eab308",
    label: "Media",
    shortLabel: "MED",
    description: "Dati parziali o stimati",
  },
  low: {
    hex: "#f97316",
    label: "Bassa",
    shortLabel: "BASSA",
    description: "Indizi deboli, alta incertezza",
  },
  unknown: {
    hex: "#737373",
    label: "Sconosciuta",
    shortLabel: "N/D",
    description: "Worker fallito o senza dati",
  },
}

interface DimensionMetaEntry {
  idx: number
  name: string
  subtitle: string
  glyph: string
}

export const DIMENSION_META: Record<DimensionKey, DimensionMetaEntry> = {
  demand: {
    idx: 1,
    name: "Domanda",
    subtitle: "Volume e crescita di mercato",
    glyph: "DEM",
  },
  saturation: {
    idx: 2,
    name: "Saturazione",
    subtitle: "Concorrenza e penetrazione brand",
    glyph: "SAT",
  },
  economics: {
    idx: 3,
    name: "Economia",
    subtitle: "Margini, CPA, breakeven",
    glyph: "ECO",
  },
  fit: {
    idx: 4,
    name: "Fit",
    subtitle: "Match prodotto / canale / utente",
    glyph: "FIT",
  },
  risk: {
    idx: 5,
    name: "Rischio",
    subtitle: "Compliance, normative, veto rules",
    glyph: "RSK",
  },
}

export function colorForScore(score: number): ReportColor {
  if (score >= 85) return "verde-acceso"
  if (score >= 70) return "verde"
  if (score >= 55) return "giallo"
  if (score >= 40) return "arancione"
  return "rosso"
}

function scoreColorHex(score: number): string {
  return SCORE_PALETTE[colorForScore(score)].hex
}

// ─────────────────────────────────────────────────────────────────────
// ScoreGauge — half-circle gauge, 0-100, animated arc reveal
// ─────────────────────────────────────────────────────────────────────

export interface ScoreGaugeProps {
  score?: number
  color?: ReportColor
  size?: number
  animated?: boolean
  label?: boolean
}

export function ScoreGauge({
  score = 0,
  color = "giallo",
  size = 320,
  animated = true,
  label = true,
}: ScoreGaugeProps) {
  const palette = SCORE_PALETTE[color]
  const [t, setT] = useState(animated ? 0 : 1)

  useEffect(() => {
    if (!animated) {
      setT(1)
      return
    }
    let raf: number | undefined
    let start: number | undefined
    const dur = 1600
    const step = (now: number): void => {
      if (start === undefined) start = now
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 4)
      setT(eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf)
    }
  }, [animated, score])

  const cx = size / 2
  const cy = size * 0.62
  const r = size * 0.42
  const stroke = size * 0.055

  const startAngle = -200
  const endAngle = 20
  const totalSpan = endAngle - startAngle

  const polar = (deg: number): [number, number] => {
    const rad = (deg * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }

  const arc = (a0: number, a1: number, radius: number = r): string => {
    const [x0, y0] = polar(a0)
    const [x1, y1] = polar(a1)
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`
  }

  const safeScore = Math.min(100, Math.max(0, score))
  const scoreAngle = startAngle + (totalSpan * safeScore * t) / 100

  const segments = [
    { from: 0, to: 39, color: "#ef4444" },
    { from: 39, to: 54, color: "#f97316" },
    { from: 54, to: 69, color: "#eab308" },
    { from: 69, to: 84, color: "#84cc16" },
    { from: 84, to: 100, color: "#22e36a" },
  ]

  const tickAt = (val: number) => {
    const a = startAngle + (totalSpan * val) / 100
    const [x0, y0] = polar(a)
    const rad = (a * Math.PI) / 180
    const inner = r - stroke * 0.6
    const x1 = cx + inner * Math.cos(rad)
    const y1 = cy + inner * Math.sin(rad)
    return { x0, y0, x1, y1 }
  }

  const displayed = Math.round(score * t)

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        width: size,
      }}
    >
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
        <path
          d={arc(startAngle, endAngle)}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth={stroke}
          strokeLinecap="butt"
        />
        {segments.map((s, i) => {
          const a0 = startAngle + (totalSpan * s.from) / 100
          const a1 = startAngle + (totalSpan * s.to) / 100
          return (
            <path
              key={i}
              d={arc(a0, a1)}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke * 0.18}
              strokeLinecap="butt"
              opacity={0.5}
            />
          )
        })}
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => {
          const tk = tickAt(v)
          const major = v % 50 === 0
          return (
            <line
              key={v}
              x1={tk.x0}
              y1={tk.y0}
              x2={tk.x1}
              y2={tk.y1}
              stroke={major ? "#666" : "#333"}
              strokeWidth={major ? 1.2 : 0.6}
            />
          )
        })}
        <path
          d={arc(startAngle, scoreAngle)}
          fill="none"
          stroke={palette.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 ${color === "verde-acceso" ? 12 : 6}px ${palette.hex}66)`,
          }}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill="#fafafa"
          fontFamily="'JetBrains Mono', monospace"
          fontSize={size * 0.28}
          fontWeight={500}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {displayed}
        </text>
        <text
          x={cx}
          y={cy + size * 0.05}
          textAnchor="middle"
          fill="#737373"
          fontFamily="'JetBrains Mono', monospace"
          fontSize={size * 0.05}
          letterSpacing="0.15em"
        >
          /100
        </text>
        <text
          x={polar(startAngle)[0] - 4}
          y={polar(startAngle)[1] + 14}
          fill="#525252"
          fontSize={size * 0.038}
          fontFamily="'JetBrains Mono', monospace"
          textAnchor="end"
        >
          0
        </text>
        <text
          x={polar(endAngle)[0] + 4}
          y={polar(endAngle)[1] + 14}
          fill="#525252"
          fontSize={size * 0.038}
          fontFamily="'JetBrains Mono', monospace"
          textAnchor="start"
        >
          100
        </text>
      </svg>
      {label && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            border: `1px solid ${palette.hex}55`,
            background: `${palette.hex}10`,
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: palette.hex,
              boxShadow: `0 0 8px ${palette.hex}`,
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: palette.hex,
              textTransform: "uppercase",
            }}
          >
            {palette.label}
          </span>
          <span style={{ color: "#737373", fontSize: 11, letterSpacing: "0.05em" }}>
            · {palette.subtitle}
          </span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// RadarChart5D — pentagonal radar
// ─────────────────────────────────────────────────────────────────────

export interface RadarScores {
  demand: { score: number; dataConfidence: DataConfidence }
  saturation: { score: number; dataConfidence: DataConfidence }
  economics: { score: number; dataConfidence: DataConfidence }
  fit: { score: number; dataConfidence: DataConfidence }
  risk: { score: number; dataConfidence: DataConfidence }
}

export interface RadarChart5DProps {
  scores: RadarScores
  color?: ReportColor
  size?: number
}

export function RadarChart5D({
  scores,
  color = "giallo",
  size = 380,
}: RadarChart5DProps) {
  const palette = SCORE_PALETTE[color]
  const dims: DimensionKey[] = ["demand", "saturation", "economics", "fit", "risk"]
  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38

  const angle = (i: number): number => -90 + i * (360 / 5)
  const polar = (radius: number, deg: number): [number, number] => {
    const rad = (deg * Math.PI) / 180
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)]
  }

  const [t, setT] = useState(0)
  useEffect(() => {
    let raf: number | undefined
    let start: number | undefined
    const step = (now: number): void => {
      if (start === undefined) start = now
      const p = Math.min(1, (now - start) / 1400)
      const eased = 1 - Math.pow(1 - p, 3)
      setT(eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf)
    }
  }, [scores])

  const points = dims.map((d, i): [number, number] => {
    const v = (scores[d].score / 100) * t
    return polar(r * v, angle(i))
  })
  const polyPath =
    points
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(" ") + " Z"

  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible" }}
    >
      {rings.map((rr, ri) => {
        const ringPath =
          dims
            .map((_, i) => {
              const [x, y] = polar(r * rr, angle(i))
              return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
            })
            .join(" ") + " Z"
        return (
          <path
            key={ri}
            d={ringPath}
            fill="none"
            stroke="#262626"
            strokeWidth={ri === rings.length - 1 ? 1.2 : 0.5}
          />
        )
      })}
      {dims.map((_, i) => {
        const [x, y] = polar(r, angle(i))
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="#262626"
            strokeWidth={0.5}
          />
        )
      })}
      <path
        d={polyPath}
        fill={`${palette.hex}22`}
        stroke={palette.hex}
        strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 6px ${palette.hex}55)` }}
      />
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={4.5}
          fill="#0a0a0a"
          stroke={palette.hex}
          strokeWidth={1.5}
        />
      ))}
      {dims.map((d, i) => {
        const [lx, ly] = polar(r + size * 0.08, angle(i))
        const conf = scores[d].dataConfidence
        const confHex = CONFIDENCE_PALETTE[conf].hex
        const meta = DIMENSION_META[d]
        return (
          <g key={d}>
            <text
              x={lx}
              y={ly - 8}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize={9}
              letterSpacing="0.2em"
              fill="#737373"
            >
              0{meta.idx} · {meta.glyph}
            </text>
            <text
              x={lx}
              y={ly + 6}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize={16}
              fontWeight={500}
              fill="#fafafa"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {Math.round(scores[d].score * t)}
            </text>
            <circle cx={lx + 22} cy={ly + 1} r={3} fill={confHex} />
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────
// ConfidenceBadge
// ─────────────────────────────────────────────────────────────────────

export interface ConfidenceBadgeProps {
  confidence: DataConfidence
  size?: "sm" | "md"
}

export function ConfidenceBadge({ confidence, size = "md" }: ConfidenceBadgeProps) {
  const c = CONFIDENCE_PALETTE[confidence]
  const fontSize = size === "sm" ? 9 : 10
  const padding = size === "sm" ? "2px 6px" : "3px 8px"
  return (
    <span
      title={c.description}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding,
        border: `1px solid ${c.hex}55`,
        background: `${c.hex}14`,
        color: c.hex,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        borderRadius: 2,
      }}
    >
      <span
        style={{ width: 5, height: 5, borderRadius: 999, background: c.hex }}
      />
      {c.shortLabel}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────
// MiniBar — horizontal 0-100 bar
// ─────────────────────────────────────────────────────────────────────

export interface MiniBarProps {
  value: number
  color?: string
  height?: number
  animate?: boolean
}

export function MiniBar({
  value,
  color = "#22e36a",
  height = 4,
  animate = true,
}: MiniBarProps) {
  const [t, setT] = useState(animate ? 0 : 1)
  useEffect(() => {
    if (!animate) return
    let raf: number | undefined
    let start: number | undefined
    const step = (now: number): void => {
      if (start === undefined) start = now
      const p = Math.min(1, (now - start) / 1200)
      const eased = 1 - Math.pow(1 - p, 3)
      setT(eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf)
    }
  }, [value, animate])
  return (
    <div
      style={{
        width: "100%",
        height,
        background: "#1a1a1a",
        borderRadius: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, value) * t}%`,
          height: "100%",
          background: color,
          transition: "width 0.2s linear",
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// DimensionCard — full breakdown card per dimensione
// ─────────────────────────────────────────────────────────────────────

export interface DimensionCardData {
  score: number
  summary: string
  dataConfidence: DataConfidence
}

export interface DimensionCardProps {
  dimKey: DimensionKey
  data: DimensionCardData
}

export function DimensionCard({ dimKey, data }: DimensionCardProps) {
  const meta = DIMENSION_META[dimKey]
  const scoreCol = scoreColorHex(data.score)
  const dimmed =
    data.dataConfidence === "low" || data.dataConfidence === "unknown"
  const cardStyle: CSSProperties = {
    border: "1px solid #1f1f1f",
    padding: 20,
    background: "#0c0c0c",
    opacity: dimmed ? 0.78 : 1,
    position: "relative",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  }
  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "#525252",
            }}
          >
            0{meta.idx} · {meta.glyph}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: "'Fraunces', 'Times New Roman', serif",
              fontSize: 22,
              color: "#fafafa",
              letterSpacing: "-0.01em",
              fontWeight: 400,
            }}
          >
            {meta.name}
          </div>
        </div>
        <ConfidenceBadge confidence={data.dataConfidence} size="sm" />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 6,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span
          style={{
            fontSize: 44,
            color: scoreCol,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {data.score}
        </span>
        <span style={{ color: "#525252", fontSize: 12, letterSpacing: "0.1em" }}>
          /100
        </span>
      </div>

      <MiniBar value={data.score} color={scoreCol} />

      <div
        style={{
          color: "#a3a3a3",
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        {data.summary}
      </div>
    </div>
  )
}
