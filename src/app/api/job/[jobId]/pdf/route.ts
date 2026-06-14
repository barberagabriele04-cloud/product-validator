// Endpoint download PDF del report. Non chiama Claude — rendering deterministico
// dei dati già in DB. Forza Node runtime perché pdfkit usa fs/buffer.

import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { generateReportPdf } from "@/lib/pdf/report-generator"
import { FinalReportSchema } from "@/agent/schemas"
import type { AnalysisInput } from "@/agent/types"

export const runtime = "nodejs"

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await ctx.params

  const analysis = await prisma.analysis.findUnique({
    where: { id: jobId },
  })
  if (analysis === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (analysis.status !== "completed" || analysis.result === null) {
    return NextResponse.json(
      {
        error: "Report not ready",
        status: analysis.status,
      },
      { status: 409 },
    )
  }

  let parsedResult: unknown
  try {
    parsedResult = JSON.parse(analysis.result)
  } catch {
    return NextResponse.json(
      { error: "Stored report is corrupted" },
      { status: 500 },
    )
  }

  const reportParse = FinalReportSchema.safeParse(parsedResult)
  if (!reportParse.success) {
    return NextResponse.json(
      {
        error: "Stored report does not match current FinalReport schema",
        details: reportParse.error.flatten(),
      },
      { status: 500 },
    )
  }
  const report = reportParse.data

  const input: AnalysisInput = {
    productUrl: analysis.productUrl ?? undefined,
    productName: analysis.productName,
    productDescription: analysis.productDescription ?? undefined,
    productCogs: analysis.productCogs ?? undefined,
    userBudget: analysis.userBudget,
    userChannel: analysis.userChannel as AnalysisInput["userChannel"],
    userMarket: analysis.userMarket as AnalysisInput["userMarket"],
    userImageExperience:
      analysis.userImageExperience as AnalysisInput["userImageExperience"],
    userVideoExperience:
      analysis.userVideoExperience as AnalysisInput["userVideoExperience"],
  }

  const startedAt = analysis.startedAt
  const completedAt = analysis.completedAt
  const durationSec =
    startedAt !== null && completedAt !== null
      ? Math.max(
          0,
          Math.round((completedAt.getTime() - startedAt.getTime()) / 1000),
        )
      : 0

  const createdAtIso = (startedAt ?? analysis.createdAt).toISOString()

  const pdfBuffer = await generateReportPdf({
    report,
    input,
    jobId: analysis.id,
    createdAtIso,
    durationSec,
  })

  const dateStr = new Date(createdAtIso).toISOString().slice(0, 10)
  const filename = `ai-udit_${slugify(input.productName)}_${dateStr}.pdf`

  // NextResponse a runtime accetta Buffer/Uint8Array senza problemi, ma il
  // TypeScript di lib.dom narrowed BodyInit non include esplicitamente
  // Uint8Array. Cast pragmatico via `as unknown as BodyInit`.
  const body = new Uint8Array(
    pdfBuffer.buffer,
    pdfBuffer.byteOffset,
    pdfBuffer.byteLength,
  ) as unknown as BodyInit

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
      "Cache-Control": "private, max-age=300",
    },
  })
}
