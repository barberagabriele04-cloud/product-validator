"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { LoadingPage } from "@/components/loading-page"
import { ReportPage, type ReportPayload } from "@/components/report"
import type { AnalysisInput, FinalReport } from "@/agent/types"

interface JobResponse {
  jobId: string
  status: "pending" | "running" | "completed" | "failed" | string
  result: FinalReport | null
  errorMessage: string | null
  totalCostEur: number | null
  createdAt: string | null
  startedAt: string | null
  completedAt: string | null
  input: AnalysisInput
}

const POLL_INTERVAL_MS = 2000

export default function AnalyzeJobPage() {
  const params = useParams<{ jobId: string }>()
  const jobIdRaw = params?.jobId
  const jobId = typeof jobIdRaw === "string" ? jobIdRaw : ""
  const [job, setJob] = useState<JobResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (jobId === "") return
    cancelledRef.current = false

    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/job/${jobId}`)
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const data = (await res.json()) as JobResponse
        if (cancelledRef.current) return
        setJob(data)
        if (data.status === "completed" || data.status === "failed") return
        setTimeout(poll, POLL_INTERVAL_MS)
      } catch (err) {
        if (cancelledRef.current) return
        setError(err instanceof Error ? err.message : String(err))
        // riprova fra POLL_INTERVAL_MS — errori di rete transitori sono comuni
        setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    void poll()

    return () => {
      cancelledRef.current = true
    }
  }, [jobId])

  if (jobId === "") {
    return <ErrorState message="Job ID mancante." />
  }

  if (job === null) {
    return <ConnectingState error={error} />
  }

  if (job.status === "failed") {
    return (
      <ErrorState
        message={job.errorMessage ?? "L'analisi non è andata a buon fine."}
      />
    )
  }

  if (job.status === "completed" && job.result !== null) {
    const submittedAt = job.startedAt ?? job.createdAt ?? new Date().toISOString()
    const durationSec =
      job.startedAt !== null && job.completedAt !== null
        ? Math.max(
            0,
            Math.round(
              (new Date(job.completedAt).getTime() -
                new Date(job.startedAt).getTime()) /
                1000,
            ),
          )
        : 0

    const reportPayload: ReportPayload = {
      ...job.result,
      breakdown: {
        demand: job.result.breakdown.demand,
        saturation: job.result.breakdown.saturation,
        // Real backend NON espone breakdown.economics.data: il pannello
        // economico deep-dive non si renderizza per analisi reali finché il
        // backend non lo aggiunge (FRONTEND_BRIEF sez. 9.1).
        economics: job.result.breakdown.economics,
        fit: job.result.breakdown.fit,
        risk: job.result.breakdown.risk,
      },
    }

    return (
      <ReportPage
        data={{
          jobId: job.jobId,
          input: job.input,
          submittedAt,
          durationSec,
          report: reportPayload,
        }}
      />
    )
  }

  // status pending o running → loading page
  return (
    <LoadingPage
      productName={job.input.productName}
      jobId={job.jobId}
      startedAt={job.startedAt}
    />
  )
}

function ConnectingState({ error }: { error: string | null }) {
  return (
    <div
      style={{
        background: "#0a0a0a",
        color: "#fafafa",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        padding: 24,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.28em",
          color: "#22e36a",
        }}
      >
        CONNESSIONE...
      </div>
      {error !== null && (
        <div
          style={{
            fontSize: 12,
            color: "#fca5a5",
            border: "1px solid #ef444466",
            padding: "8px 14px",
            background: "#2a0a0a",
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "#0a0a0a",
        color: "#fafafa",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 560, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.28em",
            color: "#ef4444",
            marginBottom: 16,
          }}
        >
          ANALISI FALLITA
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 36,
            fontWeight: 400,
            color: "#fafafa",
            margin: 0,
            marginBottom: 16,
          }}
        >
          Qualcosa è andato storto.
        </h1>
        <p
          style={{
            color: "#a3a3a3",
            fontSize: 14,
            lineHeight: 1.55,
            marginBottom: 24,
          }}
        >
          {message}
        </p>
        <div
          style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
        >
          <Link
            href="/analyze"
            style={{
              background: "#22e36a",
              color: "#0a0a0a",
              padding: "14px 26px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.18em",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            NUOVA ANALISI →
          </Link>
          <Link
            href="/"
            style={{
              background: "transparent",
              border: "1px solid #1f1f1f",
              color: "#a3a3a3",
              padding: "14px 26px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: "0.18em",
              textDecoration: "none",
            }}
          >
            HOME
          </Link>
        </div>
      </div>
    </div>
  )
}
