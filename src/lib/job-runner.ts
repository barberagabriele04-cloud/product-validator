/**
 * Astrazione fire-and-forget per task in background.
 *
 * Esiste perché su lambda serverless (Vercel/AWS) il fire-and-forget viene
 * **terminato** quando il request handler risponde al client: ogni Promise
 * non-awaited viene uccisa quando la lambda chiude. Questo distruggerebbe
 * il flusso di analisi che parte dopo l'enqueue dalla route POST /api/analyze.
 *
 * Per Vercel/Lambda: sostituire LocalJobRunner con un'implementazione che
 * usi Inngest, QStash o BullMQ — basta cambiare il singleton `jobRunner`
 * sotto, niente da toccare nel business logic dei worker o dell'orchestrator.
 */
export interface JobRunner {
  enqueue(jobId: string, fn: () => Promise<void>): void
}

export class LocalJobRunner implements JobRunner {
  enqueue(jobId: string, fn: () => Promise<void>): void {
    Promise.resolve()
      .then(() => fn())
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        const stack = err instanceof Error ? err.stack : undefined
        console.log(
          JSON.stringify({
            event: "job_error",
            jobId,
            error: message,
            stack,
          }),
        )
      })
  }
}

export const jobRunner: JobRunner = new LocalJobRunner()
