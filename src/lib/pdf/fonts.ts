// Registra font TTF nel documento pdfkit. Le 6 famiglie servono per:
// - Fraunces Regular/Medium/Italic: titoli editoriali (verdict, recommendation,
//   score, subtitle italic del gauge)
// - JetBrains Mono Regular/Medium: tag, label di sistema, numerici tabular
// - Inter Regular: body text sans-serif neutro
//
// I file vivono in public/fonts/ — Next.js include la cartella `public/`
// nel build di production, quindi process.cwd() resolve corretto sia in
// `next dev` sia in `next start` post-build.

import { readFileSync } from "node:fs"
import path from "node:path"
import type PDFKit from "pdfkit"

export const FONT = {
  fraunces: "Fraunces",
  frauncesMd: "Fraunces-Md",
  frauncesIt: "Fraunces-It",
  mono: "JetBrains",
  monoMd: "JetBrains-Md",
  body: "Inter",
} as const

interface FontFile {
  name: (typeof FONT)[keyof typeof FONT]
  file: string
}

const FONT_FILES: ReadonlyArray<FontFile> = [
  { name: FONT.fraunces, file: "Fraunces-Regular.ttf" },
  { name: FONT.frauncesMd, file: "Fraunces-Medium.ttf" },
  { name: FONT.frauncesIt, file: "Fraunces-Italic.ttf" },
  { name: FONT.mono, file: "JetBrainsMono-Regular.ttf" },
  { name: FONT.monoMd, file: "JetBrainsMono-Medium.ttf" },
  { name: FONT.body, file: "Inter-Regular.ttf" },
]

export function registerFonts(doc: PDFKit.PDFDocument): void {
  const fontsDir = path.join(process.cwd(), "public", "fonts")
  for (const f of FONT_FILES) {
    const filePath = path.join(fontsDir, f.file)
    const buffer = readFileSync(filePath)
    doc.registerFont(f.name, buffer)
  }
}
