import { NextResponse, type NextRequest } from "next/server"
import { AnalysisInputSchema } from "@/agent/schemas"
import { prisma } from "@/lib/db"
import { jobRunner } from "@/lib/job-runner"
import { runAnalysis } from "@/agent/orchestrator"

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: "Body is not valid JSON" },
      { status: 400 },
    )
  }

  const parsed = AnalysisInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const input = parsed.data

  const analysis = await prisma.analysis.create({
    data: {
      productUrl: input.productUrl,
      productName: input.productName,
      productDescription: input.productDescription,
      productCogs: input.productCogs,
      userBudget: input.userBudget,
      userChannel: input.userChannel,
      userMarket: input.userMarket,
      userImageExperience: input.userImageExperience,
      userVideoExperience: input.userVideoExperience,
      status: "pending",
    },
  })

  // Fire-and-forget via jobRunner (vedi src/lib/job-runner.ts per il razionale).
  jobRunner.enqueue(analysis.id, () => runAnalysis(input, analysis.id))

  return NextResponse.json({ jobId: analysis.id })
}
