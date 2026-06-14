// PDF report generator: 2-3 pagine A4 dark editorial.
// Niente chiamate Claude — rendering deterministico dei dati FinalReport.
//
// Pagina 1: hero (gauge + verdict + recommendation)
// Pagina 2: radar + breakdown 5 dimensioni + strengths/risks
// Pagina 3 (condizionale): economics deep-dive

import PDFDocument from "pdfkit"
import {
  ACCENT,
  BG,
  CONFIDENCE_PALETTE,
  scoreColorHex,
  SCORE_PALETTE,
  TEXT,
} from "@/lib/pdf/colors"
import { FONT, registerFonts } from "@/lib/pdf/fonts"
import {
  drawComplianceBanner,
  drawConfidenceBadge,
  drawDonut,
  drawFooter,
  drawGauge,
  drawHeaderBand,
  drawMiniBar,
  drawRadar,
  drawSectionLabel,
  fillBackground,
  PAGE,
  type RadarScores,
} from "@/lib/pdf/primitives"
import type {
  AnalysisInput,
  DimensionBreakdown,
  DimensionKey,
  FinalReport,
} from "@/agent/types"

const DIMENSION_NAMES: Record<DimensionKey, string> = {
  demand: "Domanda",
  saturation: "Saturazione",
  economics: "Economia",
  fit: "Fit",
  risk: "Rischio",
}

export interface GenerateReportPdfArgs {
  report: FinalReport
  input: AnalysisInput
  jobId: string
  createdAtIso: string
  durationSec: number
}

export async function generateReportPdf(
  args: GenerateReportPdfArgs,
): Promise<Buffer> {
  // La pagina 3 è ora SEMPRE presente: contiene la sezione "Compliance &
  // Legal" (sempre necessaria) + il pannello economics deep-dive se
  // applicabile. Garantiamo coerenza con la sezione 06 della UI online.
  const showEconomicsPanel =
    args.report.breakdown.economics.dataConfidence === "high" &&
    args.report.breakdown.economics.data !== undefined

  const totalPages = 3

  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    info: {
      Title: `ai.udit_ — ${args.input.productName}`,
      Author: "ai.udit_",
      Subject: "Validazione algoritmica prodotto",
      Keywords: "dropshipping, ecommerce, validazione, ai.udit",
    },
  })

  registerFonts(doc)

  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))
  const finished = new Promise<void>((resolve) => {
    doc.on("end", () => resolve())
  })

  drawPage1(doc, args, totalPages)
  doc.addPage({ size: "A4", margin: 0 })
  drawPage2(doc, args, totalPages)
  doc.addPage({ size: "A4", margin: 0 })
  drawPage3(doc, args, totalPages, showEconomicsPanel)

  doc.end()
  await finished
  return Buffer.concat(chunks)
}

const FOOTER_RESERVED = 32

function buildFooterArgs(
  args: GenerateReportPdfArgs,
  workersActive: number,
): Parameters<typeof drawFooter>[1] {
  return {
    jobId: args.jobId,
    createdAtIso: args.createdAtIso,
    durationSec: args.durationSec,
    totalCostEur: args.report.totalCostEur,
    dataIntegrity: args.report.dataIntegrity,
    workersActive,
  }
}

function workersActiveCount(report: FinalReport): number {
  // Approssimazione: integrity * 5, arrotondato.
  return Math.round(report.dataIntegrity * 5)
}

// ───────────────────────────────────────────────────────────────────────
// PAGINA 1 — Hero (score + verdict + recommendation)
// ───────────────────────────────────────────────────────────────────────
function drawPage1(
  doc: PDFKit.PDFDocument,
  args: GenerateReportPdfArgs,
  totalPages: number,
): void {
  fillBackground(doc)
  drawHeaderBand(doc, { pageNum: 1, totalPages })

  const { input, report } = args
  const palette = SCORE_PALETTE[report.color]

  let y = 56

  // Product name (max 2 righe, ellipsis di fatto via height limit)
  doc
    .font(FONT.fraunces)
    .fontSize(26)
    .fillColor(TEXT.primary)
    .text(input.productName, PAGE.margin, y, {
      width: PAGE.w - PAGE.margin * 2,
      lineBreak: true,
      lineGap: 2,
      ellipsis: true,
      height: 70,
    })
  y += Math.min(
    70,
    doc.heightOfString(input.productName, {
      width: PAGE.w - PAGE.margin * 2,
      lineGap: 2,
    }),
  )
  y += 6

  // Meta line
  const channelStr = input.userChannel.toUpperCase()
  const cogsStr =
    input.productCogs !== undefined ? `COGS €${input.productCogs}` : "COGS STIMATO"
  const metaLine = `${channelStr} · ${input.userMarket} · BUDGET €${input.userBudget}/MO · ${cogsStr} · IMG ${input.userImageExperience.toUpperCase()} · VIDEO ${input.userVideoExperience.toUpperCase()}`
  doc
    .font(FONT.mono)
    .fontSize(8.5)
    .fillColor(TEXT.veryFaint)
    .text(metaLine, PAGE.margin, y, {
      width: PAGE.w - PAGE.margin * 2,
      lineBreak: false,
      characterSpacing: 1.2,
    })
  y += 24

  // Score gauge centrale
  const gaugeRadius = 88
  const gaugeCx = PAGE.w / 2
  const gaugeCy = y + gaugeRadius + 12
  drawGauge(doc, {
    cx: gaugeCx,
    cy: gaugeCy,
    radius: gaugeRadius,
    score: report.score,
    color: report.color,
  })
  y = gaugeCy + gaugeRadius + 32

  // Compliance banner se severity != none
  if (report.complianceAlert.severity !== "none") {
    const usedH = drawComplianceBanner(doc, {
      x: PAGE.margin,
      y,
      width: PAGE.w - PAGE.margin * 2,
      severity: report.complianceAlert.severity,
      restrictedPlatforms: report.complianceAlert.restrictedPlatforms,
      reasons: report.complianceAlert.reasons,
    })
    y += usedH + 24
  }

  // Sezione VERDETTO
  y = drawSectionLabel(doc, {
    x: PAGE.margin,
    y,
    kicker: "VERDETTO · SINTESI",
    width: PAGE.w - PAGE.margin * 2,
  })
  y += 4
  doc
    .font(FONT.fraunces)
    .fontSize(14)
    .fillColor(TEXT.primary)
    .text(report.verdict, PAGE.margin, y, {
      width: PAGE.w - PAGE.margin * 2,
      lineBreak: true,
      lineGap: 3,
      align: "left",
    })
  y +=
    doc.heightOfString(report.verdict, {
      width: PAGE.w - PAGE.margin * 2,
      lineGap: 3,
    }) + 28

  // Sezione RACCOMANDAZIONE
  if (y < PAGE.h - FOOTER_RESERVED - 200) {
    y = drawSectionLabel(doc, {
      x: PAGE.margin,
      y,
      kicker: "RACCOMANDAZIONE OPERATIVA",
      width: PAGE.w - PAGE.margin * 2,
    })
    y += 4

    // Bordo accentato laterale
    const recColor = palette.hex
    doc
      .save()
      .lineWidth(2)
      .strokeColor(recColor)
      .moveTo(PAGE.margin, y)
      .lineTo(PAGE.margin, y + 8)
      .stroke()
      .restore()

    const recAvailableH = PAGE.h - FOOTER_RESERVED - 12 - y
    doc
      .font(FONT.fraunces)
      .fontSize(12)
      .fillColor(TEXT.secondary)
      .text(report.recommendation, PAGE.margin + 12, y, {
        width: PAGE.w - PAGE.margin * 2 - 12,
        lineBreak: true,
        lineGap: 3,
        height: recAvailableH,
        ellipsis: true,
      })
  }

  drawFooter(doc, buildFooterArgs(args, workersActiveCount(report)))
}

// ───────────────────────────────────────────────────────────────────────
// PAGINA 2 — Dimensioni (radar + breakdown + strengths/risks)
// ───────────────────────────────────────────────────────────────────────
function drawPage2(
  doc: PDFKit.PDFDocument,
  args: GenerateReportPdfArgs,
  totalPages: number,
): void {
  fillBackground(doc)
  drawHeaderBand(doc, { pageNum: 2, totalPages })

  const { report } = args
  let y = 56

  // Section label
  y = drawSectionLabel(doc, {
    x: PAGE.margin,
    y,
    kicker: `ANALISI MULTIDIMENSIONALE · 5 DIMENSIONI · INTEGRITÀ ${Math.round(report.dataIntegrity * 100)}%`,
    title: "Le 5 dimensioni dell'analisi",
    width: PAGE.w - PAGE.margin * 2,
  })
  y += 8

  // Radar centrato a sinistra, tabella scores a destra
  const radarRadius = 90
  const radarCx = PAGE.margin + 40 + radarRadius
  const radarCy = y + radarRadius + 14

  const radarScores: RadarScores = {
    demand: {
      score: report.breakdown.demand.score,
      dataConfidence: report.breakdown.demand.dataConfidence,
    },
    saturation: {
      score: report.breakdown.saturation.score,
      dataConfidence: report.breakdown.saturation.dataConfidence,
    },
    economics: {
      score: report.breakdown.economics.score,
      dataConfidence: report.breakdown.economics.dataConfidence,
    },
    fit: {
      score: report.breakdown.fit.score,
      dataConfidence: report.breakdown.fit.dataConfidence,
    },
    risk: {
      score: report.breakdown.risk.score,
      dataConfidence: report.breakdown.risk.dataConfidence,
    },
  }

  drawRadar(doc, {
    cx: radarCx,
    cy: radarCy,
    radius: radarRadius,
    scores: radarScores,
    color: report.color,
  })

  // Tabella scores a destra del radar
  const tableX = radarCx + radarRadius + 64
  const tableY = y + 6
  const dimsOrder: DimensionKey[] = [
    "demand",
    "saturation",
    "economics",
    "fit",
    "risk",
  ]
  let rowY = tableY
  for (const k of dimsOrder) {
    const v = report.breakdown[k]
    doc
      .font(FONT.mono)
      .fontSize(8)
      .fillColor(TEXT.faint)
      .text(DIMENSION_NAMES[k].toUpperCase(), tableX, rowY, {
        lineBreak: false,
        characterSpacing: 1.4,
      })
    doc
      .font(FONT.fraunces)
      .fontSize(20)
      .fillColor(scoreColorHex(v.score))
      .text(String(v.score), tableX + 64, rowY - 6, { lineBreak: false })
    drawConfidenceBadge(doc, {
      x: tableX + 110,
      y: rowY - 1,
      confidence: v.dataConfidence,
      width: 50,
      height: 14,
    })
    rowY += 26
  }

  y = Math.max(radarCy + radarRadius + 24, rowY + 12)

  // Breakdown 5 colonne
  const cellGap = 8
  const cellWidth =
    (PAGE.w - PAGE.margin * 2 - cellGap * 4) / 5
  const cellHeight = 124
  const cellY = y
  for (let i = 0; i < dimsOrder.length; i++) {
    const k = dimsOrder[i]
    if (k === undefined) continue
    const v = report.breakdown[k]
    const x = PAGE.margin + i * (cellWidth + cellGap)
    drawBreakdownCell(doc, x, cellY, cellWidth, cellHeight, k, v)
  }
  y = cellY + cellHeight + 28

  // Strengths/Risks 2 colonne
  const colGap = 16
  const colW = (PAGE.w - PAGE.margin * 2 - colGap) / 2
  const remainH = PAGE.h - FOOTER_RESERVED - 16 - y
  drawStrengthRiskColumn(
    doc,
    PAGE.margin,
    y,
    colW,
    remainH,
    "PUNTI DI FORZA",
    ACCENT.green,
    report.strengths,
    "+",
  )
  drawStrengthRiskColumn(
    doc,
    PAGE.margin + colW + colGap,
    y,
    colW,
    remainH,
    "RISCHI E OSTACOLI",
    ACCENT.red,
    report.risks,
    "−",
  )

  drawFooter(doc, buildFooterArgs(args, workersActiveCount(report)))
}

function drawBreakdownCell(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  dim: DimensionKey,
  v: DimensionBreakdown,
): void {
  const dimmed = v.dataConfidence === "low" || v.dataConfidence === "unknown"
  const opacity = dimmed ? 0.7 : 1

  doc
    .save()
    .opacity(opacity)
    .lineWidth(0.7)
    .strokeColor(BG.hairline)
    .fillColor(BG.surface)
    .rect(x, y, w, h)
    .fillAndStroke()

  // Header
  doc
    .font(FONT.mono)
    .fontSize(7.5)
    .fillColor(TEXT.veryFaint)
    .text(DIMENSION_NAMES[dim].toUpperCase(), x + 12, y + 12, {
      lineBreak: false,
      characterSpacing: 1.3,
    })

  // Score grande
  const scoreCol = scoreColorHex(v.score)
  doc
    .font(FONT.frauncesMd)
    .fontSize(28)
    .fillColor(scoreCol)
    .text(String(v.score), x + 12, y + 24, { lineBreak: false })

  // Mini bar
  drawMiniBar(doc, {
    x: x + 12,
    y: y + 60,
    width: w - 24,
    score: v.score,
  })

  // Confidence badge
  drawConfidenceBadge(doc, {
    x: x + 12,
    y: y + 70,
    confidence: v.dataConfidence,
  })

  // Summary (truncate per area disponibile)
  const summaryY = y + 90
  const availH = h - (summaryY - y) - 8
  doc
    .font(FONT.body)
    .fontSize(7.5)
    .fillColor(TEXT.muted)
    .text(v.summary, x + 12, summaryY, {
      width: w - 24,
      height: availH,
      ellipsis: true,
      lineGap: 1.5,
    })

  doc.restore()
}

function drawStrengthRiskColumn(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  header: string,
  headerColor: string,
  items: readonly string[],
  marker: string,
): void {
  // Header
  doc
    .save()
    .fillColor(headerColor)
    .circle(x + 4, y + 5, 3)
    .fill()
    .restore()

  doc
    .font(FONT.monoMd)
    .fontSize(8.5)
    .fillColor(headerColor)
    .text(header, x + 14, y + 1, {
      lineBreak: false,
      characterSpacing: 1.7,
    })

  doc
    .font(FONT.mono)
    .fontSize(8)
    .fillColor(TEXT.veryFaint)
    .text("03", x + w - 16, y + 2, { lineBreak: false })

  // Items
  let cursorY = y + 18
  const itemHMax = (h - 18) / Math.max(1, items.length)
  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      // Hairline tratteggiato (semplificato come solid sottile)
      doc
        .save()
        .lineWidth(0.4)
        .strokeColor(BG.hairline)
        .moveTo(x, cursorY - 4)
        .lineTo(x + w, cursorY - 4)
        .stroke()
        .restore()
    }
    const numLabel = `${marker}${i + 1}`
    doc
      .font(FONT.mono)
      .fontSize(9)
      .fillColor(headerColor)
      .text(numLabel, x, cursorY + 1, { lineBreak: false })
    doc
      .font(FONT.fraunces)
      .fontSize(10)
      .fillColor("#d4d4d4")
      .text(items[i] ?? "", x + 22, cursorY, {
        width: w - 22,
        height: itemHMax - 8,
        lineBreak: true,
        lineGap: 1.5,
        ellipsis: true,
      })
    const used = doc.heightOfString(items[i] ?? "", {
      width: w - 22,
      lineGap: 1.5,
    })
    cursorY += Math.min(itemHMax - 4, used) + 12
  }
}

// ───────────────────────────────────────────────────────────────────────
// PAGINA 3 — Compliance & Legal (sempre) + Economics deep-dive (condizionale)
// ───────────────────────────────────────────────────────────────────────
function drawPage3(
  doc: PDFKit.PDFDocument,
  args: GenerateReportPdfArgs,
  totalPages: number,
  showEconomicsPanel: boolean,
): void {
  fillBackground(doc)
  drawHeaderBand(doc, { pageNum: 3, totalPages })

  const { report, input } = args
  let y = 56

  // Compliance & Legal — SEMPRE presente
  y = drawSectionLabel(doc, {
    x: PAGE.margin,
    y,
    kicker: "DETTAGLI LEGALI",
    title: "Compliance & Legal",
    width: PAGE.w - PAGE.margin * 2,
  })
  y += 8
  doc
    .font(FONT.body)
    .fontSize(10)
    .fillColor(TEXT.muted)
    .text(
      "Stato compliance del prodotto. Non incide sullo score di mercato — è informazione operativa per gestire vendita e advertising.",
      PAGE.margin,
      y,
      { width: PAGE.w - PAGE.margin * 2, lineBreak: true, lineGap: 2 },
    )
  y +=
    doc.heightOfString(
      "Stato compliance del prodotto. Non incide sullo score di mercato — è informazione operativa per gestire vendita e advertising.",
      { width: PAGE.w - PAGE.margin * 2, lineGap: 2 },
    ) + 16

  y = drawComplianceLegalSection(doc, y, report.complianceAlert) + 28

  const eco = report.breakdown.economics.data
  if (!showEconomicsPanel || eco === undefined) {
    drawFooter(doc, buildFooterArgs(args, workersActiveCount(report)))
    return
  }

  y = drawSectionLabel(doc, {
    x: PAGE.margin,
    y,
    kicker: "DEEP-DIVE · UNIT ECONOMICS · CONFIDENCE ALTA",
    title: "La matematica dietro al verdetto",
    width: PAGE.w - PAGE.margin * 2,
  })
  y += 12

  doc
    .font(FONT.body)
    .fontSize(10)
    .fillColor(TEXT.muted)
    .text(
      "Numeri stimati a partire dal COGS dichiarato, dal canale, dal mercato e dai benchmark del backend.",
      PAGE.margin,
      y,
      { width: PAGE.w - PAGE.margin * 2, lineBreak: true, lineGap: 2 },
    )
  y += 36

  // Donut margine lordo
  const donutRadius = 60
  const donutCx = PAGE.margin + donutRadius + 24
  const donutCy = y + donutRadius + 14

  drawDonut(doc, {
    cx: donutCx,
    cy: donutCy,
    radius: donutRadius,
    value: eco.grossMarginPct,
    fillColor: ACCENT.green,
    lineWidth: 18,
  })

  // Numero al centro
  const marginPctStr = `${Math.round(eco.grossMarginPct * 100)}%`
  doc
    .font(FONT.frauncesMd)
    .fontSize(28)
    .fillColor(TEXT.primary)
  const mw = doc.widthOfString(marginPctStr)
  doc.text(marginPctStr, donutCx - mw / 2, donutCy - 18, {
    lineBreak: false,
  })
  doc
    .font(FONT.mono)
    .fontSize(8)
    .fillColor(TEXT.faint)
  const labelStr = "MARGINE LORDO"
  const lw = doc.widthOfString(labelStr)
  doc.text(labelStr, donutCx - lw / 2, donutCy + 12, {
    lineBreak: false,
    characterSpacing: 1.4,
  })

  // 3 stat box a destra del donut
  const statBoxX = donutCx + donutRadius + 48
  const statBoxW = PAGE.w - PAGE.margin - statBoxX
  let statY = y
  const stats: Array<{ label: string; value: string; color: string }> = [
    {
      label: "BREAKEVEN ROAS",
      value: eco.breakevenRoas.toFixed(2),
      color:
        eco.breakevenRoas < 2.5
          ? scoreColorHex(75)
          : eco.breakevenRoas < 3.5
            ? scoreColorHex(60)
            : ACCENT.red,
    },
    {
      label: "CPA STIMATO",
      value: `€${eco.estimatedCpa.toFixed(2)}`,
      color: TEXT.primary,
    },
    {
      label: "RETAIL SUGG",
      value: `€${eco.suggestedRetailPrice.toFixed(0)}`,
      color: TEXT.primary,
    },
  ]
  for (const s of stats) {
    doc
      .font(FONT.mono)
      .fontSize(8)
      .fillColor(TEXT.faint)
      .text(s.label, statBoxX, statY, {
        lineBreak: false,
        characterSpacing: 1.4,
      })
    doc
      .font(FONT.frauncesMd)
      .fontSize(24)
      .fillColor(s.color)
      .text(s.value, statBoxX, statY + 12, { lineBreak: false })
    statY += 44
  }

  y = donutCy + donutRadius + 32

  // Bar chart CPA × 30 vs userBudget
  const minTestBudget = eco.estimatedCpa * 30
  const userBudget = input.userBudget
  const maxV = Math.max(minTestBudget, userBudget) * 1.05
  const barAreaX = PAGE.margin
  const barAreaY = y
  const barAreaW = PAGE.w - PAGE.margin * 2
  const barH = 18
  const labelColW = 130

  doc
    .font(FONT.mono)
    .fontSize(8)
    .fillColor(TEXT.faint)
    .text("BUDGET TEST MIN", barAreaX, barAreaY + 5, {
      width: labelColW,
      lineBreak: false,
      characterSpacing: 1.4,
    })
  const minTestBarW = (minTestBudget / maxV) * (barAreaW - labelColW - 80)
  doc
    .save()
    .fillColor(TEXT.veryFaint)
    .rect(barAreaX + labelColW, barAreaY, minTestBarW, barH)
    .fill()
    .restore()
  doc
    .font(FONT.monoMd)
    .fontSize(9)
    .fillColor(TEXT.primary)
    .text(
      `€${Math.round(minTestBudget)}`,
      barAreaX + labelColW + minTestBarW + 8,
      barAreaY + 5,
      { lineBreak: false },
    )

  const userBarY = barAreaY + barH + 10
  const userBarSufficient = userBudget >= minTestBudget
  doc
    .font(FONT.mono)
    .fontSize(8)
    .fillColor(TEXT.faint)
    .text("BUDGET UTENTE", barAreaX, userBarY + 5, {
      width: labelColW,
      lineBreak: false,
      characterSpacing: 1.4,
    })
  const userBarW = (userBudget / maxV) * (barAreaW - labelColW - 80)
  doc
    .save()
    .fillColor(userBarSufficient ? ACCENT.green : ACCENT.red)
    .rect(barAreaX + labelColW, userBarY, userBarW, barH)
    .fill()
    .restore()
  doc
    .font(FONT.monoMd)
    .fontSize(9)
    .fillColor(TEXT.primary)
    .text(
      `€${userBudget}/MO`,
      barAreaX + labelColW + userBarW + 8,
      userBarY + 5,
      { lineBreak: false },
    )

  y = userBarY + barH + 24

  // Status profittabilità
  const statusW = 220
  const statusH = 26
  const statusColor = eco.profitableAtUserBudget ? ACCENT.green : ACCENT.red
  doc
    .save()
    .lineWidth(1)
    .strokeColor(statusColor)
    .rect(PAGE.margin, y, statusW, statusH)
    .stroke()
    .restore()
  doc
    .font(FONT.monoMd)
    .fontSize(10)
    .fillColor(statusColor)
    .text(
      eco.profitableAtUserBudget
        ? "✓ PROFITTEVOLE AL BUDGET ATTUALE"
        : "✗ NON PROFITTEVOLE",
      PAGE.margin + 12,
      y + 8,
      { lineBreak: false, characterSpacing: 1.4 },
    )
  y += statusH + 18

  // Categoria + return rate
  doc
    .font(FONT.body)
    .fontSize(10)
    .fillColor(TEXT.muted)
    .text(`CATEGORIA: ${eco.categoryClassification}`, PAGE.margin, y, {
      lineBreak: false,
    })
  y += 16
  doc.text(
    `RESI ATTESI: ${(eco.expectedReturnRate * 100).toFixed(1)}% (categoria ${eco.categoryClassification})`,
    PAGE.margin,
    y,
    { lineBreak: false },
  )
  y += 28

  // Disclaimer
  doc
    .font(FONT.body)
    .fontSize(8)
    .fillColor(TEXT.veryFaint)
    .text(
      "L'analisi si basa su dati pubblici al momento della query. Verifica indipendente consigliata per decisioni di investimento superiori a €500.",
      PAGE.margin,
      y,
      { width: PAGE.w - PAGE.margin * 2, lineBreak: true, lineGap: 2 },
    )

  drawFooter(doc, buildFooterArgs(args, workersActiveCount(report)))
}

// Suppress unused if confidence palette not exported elsewhere from this module.
void CONFIDENCE_PALETTE

// ─── Compliance & Legal section (struct table) ──────────────────────────
function drawComplianceLegalSection(
  doc: PDFKit.PDFDocument,
  yStart: number,
  alert: import("@/agent/types").ComplianceFlag,
): number {
  const padding = 18
  const rowH = 22
  const labelColW = 140
  const tableW = PAGE.w - PAGE.margin * 2

  const rows: Array<{ label: string; value: string; accent: string }> = []

  rows.push({
    label: "CATEGORIA RISTRETTA",
    value:
      alert.restrictedPlatforms.length > 0
        ? `Sì, su ${alert.restrictedPlatforms.map((p) => p.toUpperCase()).join(" / ")}`
        : "No",
    accent: alert.restrictedCategory ? "#ef4444" : "#a3a3a3",
  })

  const trademarkLabel: Record<typeof alert.trademarkRisk, string> = {
    low: "Basso",
    medium: "Moderato",
    high: "Elevato",
    unknown: "Sconosciuto",
  }
  const trademarkLine =
    alert.trademarkDetails !== null && alert.trademarkDetails !== ""
      ? `${trademarkLabel[alert.trademarkRisk]} — ${alert.trademarkDetails}`
      : trademarkLabel[alert.trademarkRisk]
  rows.push({
    label: "RISCHIO TRADEMARK",
    value: trademarkLine,
    accent:
      alert.trademarkRisk === "high"
        ? "#ef4444"
        : alert.trademarkRisk === "medium"
          ? "#eab308"
          : "#a3a3a3",
  })

  rows.push({
    label: "MARCATURA CE",
    value: alert.ceComplianceRequired ? "Richiesta" : "Non richiesta",
    accent: alert.ceComplianceRequired ? "#eab308" : "#a3a3a3",
  })

  // Misuro altezza totale
  doc.font(FONT.body).fontSize(10)
  let bodyHeight = 0
  for (const r of rows) {
    bodyHeight += Math.max(
      rowH,
      doc.heightOfString(r.value, {
        width: tableW - padding * 2 - labelColW,
        lineGap: 2,
      }) + 12,
    )
  }
  const totalH = padding * 2 + bodyHeight

  // Background border
  doc
    .save()
    .lineWidth(0.7)
    .strokeColor(BG.hairline)
    .fillColor(BG.surface)
    .rect(PAGE.margin, yStart, tableW, totalH)
    .fillAndStroke()
    .restore()

  let cursorY = yStart + padding
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (r === undefined) continue
    if (i > 0) {
      doc
        .save()
        .lineWidth(0.5)
        .strokeColor(BG.hairline)
        .moveTo(PAGE.margin + padding, cursorY - 4)
        .lineTo(PAGE.margin + tableW - padding, cursorY - 4)
        .stroke()
        .restore()
    }
    doc
      .font(FONT.mono)
      .fontSize(8)
      .fillColor(TEXT.faint)
      .text(r.label, PAGE.margin + padding, cursorY + 2, {
        width: labelColW,
        lineBreak: false,
        characterSpacing: 1.4,
      })
    doc
      .font(FONT.body)
      .fontSize(10)
      .fillColor(r.accent)
      .text(r.value, PAGE.margin + padding + labelColW, cursorY, {
        width: tableW - padding * 2 - labelColW,
        lineBreak: true,
        lineGap: 2,
      })
    const used = doc.heightOfString(r.value, {
      width: tableW - padding * 2 - labelColW,
      lineGap: 2,
    })
    cursorY += Math.max(rowH, used + 12)
  }

  return yStart + totalH
}
