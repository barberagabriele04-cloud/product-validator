// Primitive di disegno PDF native (no SVG, no rasterizzazione).
// Usa pdfkit per disegnare gauge, radar, donut, badge, header band, ecc.
// Tutte le coordinate sono in punti PDF (1pt = 1/72").

import type PDFKit from "pdfkit"
import {
  ACCENT,
  BG,
  CONFIDENCE_PALETTE,
  scoreColorHex,
  SCORE_PALETTE,
  TEXT,
} from "@/lib/pdf/colors"
import { FONT } from "@/lib/pdf/fonts"
import type {
  DataConfidence,
  DimensionKey,
  ReportColor,
} from "@/agent/types"

// A4 in pt: 595.28 × 841.89.
export const PAGE = {
  w: 595.28,
  h: 841.89,
  margin: 48,
  marginTop: 56,
  marginBottom: 48,
} as const

const TAU = Math.PI * 2

function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

// ─── Background della pagina (dark editorial) ───────────────────────────
export function fillBackground(doc: PDFKit.PDFDocument): void {
  doc.save()
  doc.rect(0, 0, PAGE.w, PAGE.h).fill(BG.page)
  doc.restore()
}

// ─── Header band ────────────────────────────────────────────────────────
const HEADER_HEIGHT = 40

export interface HeaderArgs {
  pageNum: number
  totalPages: number
}

export function drawHeaderBand(
  doc: PDFKit.PDFDocument,
  args: HeaderArgs,
): void {
  const y = 0
  // Hairline al bottom dell'header
  doc
    .moveTo(0, HEADER_HEIGHT)
    .lineTo(PAGE.w, HEADER_HEIGHT)
    .lineWidth(0.5)
    .strokeColor(BG.hairline)
    .stroke()

  // Logo "ai.udit_" — l'underscore è verde
  const logoX = PAGE.margin
  const logoY = y + 16
  doc
    .font(FONT.monoMd)
    .fontSize(11)
    .fillColor(TEXT.primary)
    .text("ai.udit", logoX, logoY, { lineBreak: false })
  const widthOfLogo = doc.widthOfString("ai.udit")
  doc
    .fillColor(ACCENT.green)
    .text("_", logoX + widthOfLogo, logoY, { lineBreak: false })

  // Tag descrittivo
  doc
    .font(FONT.mono)
    .fontSize(9)
    .fillColor(TEXT.veryFaint)
    .text(
      "VALIDAZIONE ALGORITMICA · DROPSHIPPING & ECOMMERCE",
      logoX + widthOfLogo + 16,
      logoY + 1,
      { lineBreak: false, characterSpacing: 1.4 },
    )

  // Page indicator a destra
  const pageLabel = `${args.pageNum} / ${args.totalPages}`
  doc
    .font(FONT.mono)
    .fontSize(9)
    .fillColor(TEXT.faint)
    .text(pageLabel, PAGE.w - PAGE.margin - 60, logoY + 1, {
      width: 60,
      align: "right",
      lineBreak: false,
      characterSpacing: 1.2,
    })
}

// ─── Footer ─────────────────────────────────────────────────────────────
const FOOTER_HEIGHT = 32

export interface FooterArgs {
  jobId: string
  createdAtIso: string
  durationSec: number
  totalCostEur: number
  dataIntegrity: number
  workersActive: number
}

export function drawFooter(
  doc: PDFKit.PDFDocument,
  args: FooterArgs,
): void {
  const y = PAGE.h - FOOTER_HEIGHT
  // Hairline top
  doc
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.w - PAGE.margin, y)
    .lineWidth(0.5)
    .strokeColor(BG.hairline)
    .stroke()

  const created = new Date(args.createdAtIso)
  const dateLine = created.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const minutes = Math.floor(args.durationSec / 60)
  const seconds = String(args.durationSec % 60).padStart(2, "0")

  doc
    .font(FONT.mono)
    .fontSize(7.5)
    .fillColor(TEXT.veryFaint)
    .text(
      `JOB #${args.jobId.slice(-7).toUpperCase()} · ${dateLine} · DURATA ${minutes}:${seconds} · COSTO €${args.totalCostEur.toFixed(3)} · INTEGRITÀ ${Math.round(args.dataIntegrity * 100)}% · ${args.workersActive}/5 WORKER`,
      PAGE.margin,
      y + 10,
      {
        width: PAGE.w - PAGE.margin * 2,
        align: "left",
        lineBreak: false,
        characterSpacing: 0.6,
      },
    )
}

// ─── Section label ──────────────────────────────────────────────────────
export interface SectionLabelArgs {
  x: number
  y: number
  kicker: string
  title?: string
  width?: number
}

export function drawSectionLabel(
  doc: PDFKit.PDFDocument,
  args: SectionLabelArgs,
): number {
  doc
    .font(FONT.mono)
    .fontSize(8.5)
    .fillColor(TEXT.faint)
    .text(args.kicker.toUpperCase(), args.x, args.y, {
      lineBreak: false,
      characterSpacing: 1.6,
      width: args.width,
    })
  let cursorY = args.y + 14
  if (args.title !== undefined) {
    doc
      .font(FONT.fraunces)
      .fontSize(20)
      .fillColor(TEXT.primary)
      .text(args.title, args.x, cursorY, {
        lineBreak: true,
        width: args.width,
      })
    cursorY += doc.heightOfString(args.title, { width: args.width })
  }
  return cursorY
}

// ─── Gauge score (cerchio progress) ─────────────────────────────────────
export interface GaugeArgs {
  cx: number
  cy: number
  radius: number
  score: number
  color: ReportColor
  lineWidth?: number
}

export function drawGauge(
  doc: PDFKit.PDFDocument,
  args: GaugeArgs,
): void {
  const lw = args.lineWidth ?? 14
  const palette = SCORE_PALETTE[args.color]

  // Cerchio outer track
  doc
    .save()
    .lineWidth(lw)
    .strokeColor(BG.hairline)
    .circle(args.cx, args.cy, args.radius)
    .stroke()
    .restore()

  // Arco progress: da -90° a -90° + 360° × (score/100), in senso orario
  const startAngle = -90
  const sweep = (Math.min(100, Math.max(0, args.score)) / 100) * 360
  const endAngle = startAngle + sweep

  if (sweep > 0) {
    drawArcStroke(doc, {
      cx: args.cx,
      cy: args.cy,
      radius: args.radius,
      startAngleDeg: startAngle,
      endAngleDeg: endAngle,
      lineWidth: lw,
      strokeColor: palette.hex,
    })
  }

  // Numero score grande al centro
  const scoreStr = String(Math.round(args.score))
  const scoreSize = 64
  doc
    .font(FONT.frauncesMd)
    .fontSize(scoreSize)
    .fillColor(palette.hex)
  const w = doc.widthOfString(scoreStr)
  doc.text(scoreStr, args.cx - w / 2, args.cy - scoreSize * 0.62, {
    lineBreak: false,
  })

  // Label color in caps sotto al numero
  doc
    .font(FONT.monoMd)
    .fontSize(10)
    .fillColor(palette.hex)
  const labelW = doc.widthOfString(palette.label)
  doc.text(palette.label, args.cx - labelW / 2, args.cy + scoreSize * 0.32, {
    lineBreak: false,
    characterSpacing: 1.6,
  })

  // Subtitle in Fraunces Italic — più editorial coerente col tono del design.
  doc
    .font(FONT.frauncesIt)
    .fontSize(11)
    .fillColor(TEXT.muted)
  const subW = doc.widthOfString(palette.subtitle)
  doc.text(
    palette.subtitle,
    args.cx - subW / 2,
    args.cy + scoreSize * 0.32 + 16,
    { lineBreak: false },
  )
}

// ─── Helper interno: arco stroked usando approssimazione Bezier ────────
// pdfkit non ha doc.arc() pubblico. Disegniamo l'arco come polilinea con
// passi piccoli (2°) — invisibile alla vista a queste dimensioni.
interface ArcStrokeArgs {
  cx: number
  cy: number
  radius: number
  startAngleDeg: number
  endAngleDeg: number
  lineWidth: number
  strokeColor: string
}

function drawArcStroke(
  doc: PDFKit.PDFDocument,
  args: ArcStrokeArgs,
): void {
  const stepDeg = 2
  const totalSweep = args.endAngleDeg - args.startAngleDeg
  const steps = Math.max(1, Math.ceil(Math.abs(totalSweep) / stepDeg))

  doc
    .save()
    .lineWidth(args.lineWidth)
    .strokeColor(args.strokeColor)
    .lineCap("round")

  const startRad = deg2rad(args.startAngleDeg)
  const x0 = args.cx + args.radius * Math.cos(startRad)
  const y0 = args.cy + args.radius * Math.sin(startRad)
  doc.moveTo(x0, y0)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const a = args.startAngleDeg + totalSweep * t
    const r = deg2rad(a)
    const x = args.cx + args.radius * Math.cos(r)
    const y = args.cy + args.radius * Math.sin(r)
    doc.lineTo(x, y)
  }
  doc.stroke().restore()
}

// ─── Radar pentagonale 5D ───────────────────────────────────────────────
export interface RadarScores {
  demand: { score: number; dataConfidence: DataConfidence }
  saturation: { score: number; dataConfidence: DataConfidence }
  economics: { score: number; dataConfidence: DataConfidence }
  fit: { score: number; dataConfidence: DataConfidence }
  risk: { score: number; dataConfidence: DataConfidence }
}

export interface RadarArgs {
  cx: number
  cy: number
  radius: number
  scores: RadarScores
  color: ReportColor
}

const DIMENSION_GLYPHS: Record<DimensionKey, string> = {
  demand: "DEM",
  saturation: "SAT",
  economics: "ECO",
  fit: "FIT",
  risk: "RSK",
}

const DIMENSION_ORDER: DimensionKey[] = [
  "demand",
  "saturation",
  "economics",
  "fit",
  "risk",
]

export function drawRadar(doc: PDFKit.PDFDocument, args: RadarArgs): void {
  const palette = SCORE_PALETTE[args.color]
  const angleFor = (i: number): number => -90 + i * (360 / 5)
  const polar = (
    rr: number,
    deg: number,
  ): { x: number; y: number } => {
    const r = deg2rad(deg)
    return {
      x: args.cx + rr * Math.cos(r),
      y: args.cy + rr * Math.sin(r),
    }
  }

  // Grid: 5 pentagoni concentrici a 20/40/60/80/100
  const rings = [0.2, 0.4, 0.6, 0.8, 1.0]
  doc.save().lineWidth(0.5).strokeColor(BG.hairline)
  for (const ring of rings) {
    const pts = DIMENSION_ORDER.map((_, i) => polar(args.radius * ring, angleFor(i)))
    const first = pts[0]
    if (first === undefined) continue
    doc.moveTo(first.x, first.y)
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i]
      if (p !== undefined) doc.lineTo(p.x, p.y)
    }
    doc.closePath().stroke()
  }
  // Spokes dal centro all'outer
  for (let i = 0; i < 5; i++) {
    const p = polar(args.radius, angleFor(i))
    doc.moveTo(args.cx, args.cy).lineTo(p.x, p.y).stroke()
  }
  doc.restore()

  // Polygon dei valori
  const valuePts = DIMENSION_ORDER.map((d, i) => {
    const v = (args.scores[d].score / 100) * args.radius
    return polar(v, angleFor(i))
  })

  doc.save().lineWidth(1.5).strokeColor(palette.hex).fillColor(palette.hex)
  const first = valuePts[0]
  if (first !== undefined) {
    doc.moveTo(first.x, first.y)
    for (let i = 1; i < valuePts.length; i++) {
      const p = valuePts[i]
      if (p !== undefined) doc.lineTo(p.x, p.y)
    }
    doc.closePath().fillOpacity(0.18).fill().fillOpacity(1)

    // Stroke esterno
    doc.moveTo(first.x, first.y)
    for (let i = 1; i < valuePts.length; i++) {
      const p = valuePts[i]
      if (p !== undefined) doc.lineTo(p.x, p.y)
    }
    doc.closePath().stroke()
  }
  doc.restore()

  // Dot pieni sui vertici
  for (const p of valuePts) {
    doc
      .save()
      .fillColor(palette.hex)
      .circle(p.x, p.y, 2.6)
      .fill()
      .restore()
  }

  // Etichette dimension a 115% del radius
  const labelRadius = args.radius + 18
  for (let i = 0; i < 5; i++) {
    const dim = DIMENSION_ORDER[i]
    if (dim === undefined) continue
    const lp = polar(labelRadius, angleFor(i))
    const glyph = DIMENSION_GLYPHS[dim]
    const score = String(Math.round(args.scores[dim].score))

    doc
      .font(FONT.mono)
      .fontSize(8)
      .fillColor(TEXT.faint)
    const glyphW = doc.widthOfString(glyph)
    doc.text(glyph, lp.x - glyphW / 2, lp.y - 9, {
      lineBreak: false,
      characterSpacing: 1.4,
    })

    doc
      .font(FONT.monoMd)
      .fontSize(11)
      .fillColor(TEXT.primary)
    const scoreW = doc.widthOfString(score)
    doc.text(score, lp.x - scoreW / 2, lp.y + 2, { lineBreak: false })
  }
}

// ─── Donut chart per margine lordo ──────────────────────────────────────
export interface DonutArgs {
  cx: number
  cy: number
  radius: number
  /** Frazione 0-1 (es. 0.75 per 75%). */
  value: number
  fillColor: string
  trackColor?: string
  lineWidth?: number
}

export function drawDonut(doc: PDFKit.PDFDocument, args: DonutArgs): void {
  const lw = args.lineWidth ?? 18
  const track = args.trackColor ?? BG.hairline

  // Track completo
  doc
    .save()
    .lineWidth(lw)
    .strokeColor(track)
    .circle(args.cx, args.cy, args.radius)
    .stroke()
    .restore()

  // Arco valore
  const v = Math.max(0, Math.min(1, args.value))
  if (v > 0) {
    drawArcStroke(doc, {
      cx: args.cx,
      cy: args.cy,
      radius: args.radius,
      startAngleDeg: -90,
      endAngleDeg: -90 + v * 360,
      lineWidth: lw,
      strokeColor: args.fillColor,
    })
  }
}

// ─── Confidence badge (pillola arrotondata) ─────────────────────────────
export interface ConfidenceBadgeArgs {
  x: number
  y: number
  confidence: DataConfidence
  width?: number
  height?: number
}

export function drawConfidenceBadge(
  doc: PDFKit.PDFDocument,
  args: ConfidenceBadgeArgs,
): void {
  const c = CONFIDENCE_PALETTE[args.confidence]
  const w = args.width ?? 50
  const h = args.height ?? 14
  // pdfkit roundedRect(x, y, w, h, r)
  doc
    .save()
    .lineWidth(0.6)
    .strokeColor(c.hex)
    .fillColor(c.hex)
    .fillOpacity(0.12)
    .roundedRect(args.x, args.y, w, h, 2)
    .fillAndStroke()
    .fillOpacity(1)
    .restore()

  doc
    .font(FONT.monoMd)
    .fontSize(7)
    .fillColor(c.hex)
  const tw = doc.widthOfString(c.short)
  doc.text(c.short, args.x + (w - tw) / 2, args.y + 3.5, {
    lineBreak: false,
    characterSpacing: 1.2,
  })
}

// ─── Mini bar 0-100 ─────────────────────────────────────────────────────
export interface MiniBarArgs {
  x: number
  y: number
  width: number
  height?: number
  score: number
}

export function drawMiniBar(
  doc: PDFKit.PDFDocument,
  args: MiniBarArgs,
): void {
  const h = args.height ?? 4
  // Track
  doc.save().fillColor(BG.hairline).rect(args.x, args.y, args.width, h).fill()
  // Fill
  const fillW = (Math.min(100, Math.max(0, args.score)) / 100) * args.width
  doc.fillColor(scoreColorHex(args.score)).rect(args.x, args.y, fillW, h).fill()
  doc.restore()
}

// ─── Compliance banner ──────────────────────────────────────────────────
// Sostituisce il vecchio drawVetoBanner. Critical = rosso prominente,
// Warning = ambra discreto. Non renderizza se severity === "none".
export interface ComplianceBannerArgs {
  x: number
  y: number
  width: number
  severity: "warning" | "critical"
  restrictedPlatforms: string[]
  reasons: string[]
}

export function drawComplianceBanner(
  doc: PDFKit.PDFDocument,
  args: ComplianceBannerArgs,
): number {
  const isCritical = args.severity === "critical"
  const accent = isCritical ? "#ef4444" : "#eab308"
  const accentBg = isCritical ? "#2a0a0a" : "#1f1a08"
  const titleColor = isCritical ? "#fecaca" : "#fde68a"
  const bodyColor = isCritical ? "#fca5a5" : "#fcd34d"
  const kicker = isCritical
    ? "COMPLIANCE — PROBLEMA CRITICO"
    : "NOTE COMPLIANCE"
  const headline = isCritical
    ? "Questo prodotto è ristretto o ha problemi compliance da gestire prima del lancio."
    : "Note operative compliance da verificare con il fornitore."
  const platformsLabel =
    args.restrictedPlatforms.length > 0
      ? args.restrictedPlatforms.map((p) => p.toUpperCase()).join(" / ")
      : null

  const padding = 18
  const titleSize = 14
  const labelSize = 8.5
  const reasonSize = 9
  const lineGap = 2
  const innerWidth = args.width - padding * 2 - 50

  // Misura altezza dei reasons concatenati
  doc.font(FONT.body).fontSize(reasonSize)
  const reasonsText = args.reasons.map((r) => `› ${r}`).join("\n")
  const reasonsHeight = doc.heightOfString(reasonsText, {
    width: innerWidth,
    lineGap,
  })

  const totalH = padding * 2 + 14 + 10 + 22 + reasonsHeight + 4

  // Background
  doc
    .save()
    .lineWidth(1)
    .strokeColor(`${accent}66`)
    .fillColor(accentBg)
    .rect(args.x, args.y, args.width, totalH)
    .fillAndStroke()
    .restore()

  // Icona rombo con simbolo
  const iconCx = args.x + padding + 14
  const iconCy = args.y + padding + 16
  doc
    .save()
    .lineWidth(1.2)
    .strokeColor(accent)
    .moveTo(iconCx, iconCy - 14)
    .lineTo(iconCx + 14, iconCy)
    .lineTo(iconCx, iconCy + 14)
    .lineTo(iconCx - 14, iconCy)
    .closePath()
    .stroke()

  doc
    .font(FONT.monoMd)
    .fontSize(14)
    .fillColor(accent)
  const symbol = isCritical ? "!" : "i"
  const symW = doc.widthOfString(symbol)
  doc.text(symbol, iconCx - symW / 2, iconCy - 8, { lineBreak: false })
  doc.restore()

  const textX = args.x + padding + 50

  const fullKicker =
    platformsLabel !== null ? `${kicker} · RISTRETTO SU ${platformsLabel}` : kicker
  doc
    .font(FONT.monoMd)
    .fontSize(labelSize)
    .fillColor(accent)
    .text(fullKicker, textX, args.y + padding, {
      lineBreak: false,
      characterSpacing: 1.8,
      width: innerWidth,
    })

  doc
    .font(FONT.fraunces)
    .fontSize(titleSize)
    .fillColor(titleColor)
    .text(headline, textX, args.y + padding + 14, {
      width: innerWidth,
      lineBreak: true,
      lineGap: 1,
    })

  doc
    .font(FONT.body)
    .fontSize(reasonSize)
    .fillColor(bodyColor)
    .text(reasonsText, textX, args.y + padding + 14 + 22, {
      width: innerWidth,
      lineBreak: true,
      lineGap,
    })

  return totalH
}

// Conserva la firma del vecchio drawVetoBanner per ridurre breakage durante
// il rollover; deprecata, usa drawComplianceBanner.
export interface VetoBannerArgs {
  x: number
  y: number
  width: number
  reason: string
}

export function drawVetoBanner(
  doc: PDFKit.PDFDocument,
  args: VetoBannerArgs,
): number {
  const padding = 18
  const titleSize = 14
  const labelSize = 8.5
  const reasonSize = 10
  const lineHeight = 1.45
  const innerWidth = args.width - padding * 2 - 50

  const reasonHeight = doc
    .font(FONT.body)
    .fontSize(reasonSize)
    .heightOfString(args.reason, { width: innerWidth, lineGap: 2 })

  const totalH = padding * 2 + 14 + 10 + 18 + reasonHeight + 8

  // Background con bordo rosso e fill scuro
  doc
    .save()
    .lineWidth(1)
    .strokeColor("#ef444466")
    .fillColor(ACCENT.redBg)
    .rect(args.x, args.y, args.width, totalH)
    .fillAndStroke()
    .restore()

  // Icona warning (rombo)
  const iconCx = args.x + padding + 14
  const iconCy = args.y + padding + 16
  doc
    .save()
    .lineWidth(1.2)
    .strokeColor(ACCENT.red)
    .moveTo(iconCx, iconCy - 14)
    .lineTo(iconCx + 14, iconCy)
    .lineTo(iconCx, iconCy + 14)
    .lineTo(iconCx - 14, iconCy)
    .closePath()
    .stroke()

  doc
    .font(FONT.monoMd)
    .fontSize(14)
    .fillColor(ACCENT.red)
  const exclamW = doc.widthOfString("!")
  doc.text("!", iconCx - exclamW / 2, iconCy - 8, { lineBreak: false })
  doc.restore()

  const textX = args.x + padding + 50

  doc
    .font(FONT.monoMd)
    .fontSize(labelSize)
    .fillColor(ACCENT.red)
    .text("VETO ATTIVO · SCORE LIMITATO", textX, args.y + padding, {
      lineBreak: false,
      characterSpacing: 2,
    })

  doc
    .font(FONT.fraunces)
    .fontSize(titleSize)
    .fillColor("#fecaca")
    .text(
      "Questo prodotto non è raccomandato a prescindere dai dati di mercato.",
      textX,
      args.y + padding + 14,
      { width: innerWidth, lineBreak: true, lineGap: 1 },
    )

  doc
    .font(FONT.body)
    .fontSize(reasonSize)
    .fillColor("#fca5a5")
    .text(args.reason, textX, args.y + padding + 14 + 26, {
      width: innerWidth,
      lineBreak: true,
      lineGap: 2,
    })

  return totalH
}
