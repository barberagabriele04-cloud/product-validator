// Palette colori per il PDF — strettamente coerenti con
// src/components/visuals.tsx (palette UI).

import type {
  DataConfidence,
  ReportColor,
} from "@/agent/types"

interface ScorePalette {
  hex: string
  label: string
  subtitle: string
}

export const SCORE_PALETTE: Record<ReportColor, ScorePalette> = {
  "verde-acceso": {
    hex: "#22e36a",
    label: "VERDE ACCESO",
    subtitle: "Eccellente — opportunità rara",
  },
  verde: {
    hex: "#84cc16",
    label: "VERDE",
    subtitle: "Buono — consigliato testare",
  },
  giallo: {
    hex: "#eab308",
    label: "GIALLO",
    subtitle: "Cauto — opportunità con riserve",
  },
  arancione: {
    hex: "#f97316",
    label: "ARANCIONE",
    subtitle: "Difficile — molti ostacoli",
  },
  rosso: {
    hex: "#ef4444",
    label: "ROSSO",
    subtitle: "Sconsigliato — non procedere",
  },
}

interface ConfidencePalette {
  hex: string
  label: string
  short: string
}

export const CONFIDENCE_PALETTE: Record<DataConfidence, ConfidencePalette> = {
  high: { hex: "#22e36a", label: "Alta", short: "ALTA" },
  medium: { hex: "#eab308", label: "Media", short: "MEDIA" },
  low: { hex: "#f97316", label: "Bassa", short: "BASSA" },
  unknown: { hex: "#737373", label: "Sconosciuta", short: "N/D" },
}

export function colorForScore(score: number): ReportColor {
  if (score >= 85) return "verde-acceso"
  if (score >= 70) return "verde"
  if (score >= 55) return "giallo"
  if (score >= 40) return "arancione"
  return "rosso"
}

export function scoreColorHex(score: number): string {
  return SCORE_PALETTE[colorForScore(score)].hex
}

// Tinte di sfondo dark coerenti col CSS globals.
export const BG = {
  page: "#0a0a0a",
  surface: "#0c0c0c",
  hairline: "#1f1f1f",
  hairlineSoft: "#262626",
} as const

export const TEXT = {
  primary: "#fafafa",
  secondary: "#e5e5e5",
  muted: "#a3a3a3",
  faint: "#737373",
  veryFaint: "#525252",
  ghost: "#404040",
} as const

export const ACCENT = {
  green: "#22e36a",
  red: "#ef4444",
  redBg: "#2a0a0a",
} as const
