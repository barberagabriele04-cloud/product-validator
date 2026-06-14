import Anthropic from "@anthropic-ai/sdk"
import { env } from "@/lib/env"
import { claudeSemaphore } from "@/lib/concurrency"
import { sleep, USD_EUR } from "@/lib/utils"

export type ModelAlias = "sonnet-4-5" | "haiku-4-5"

const MODEL_MAP: Record<ModelAlias, string> = {
  "sonnet-4-5": "claude-sonnet-4-5",
  "haiku-4-5": "claude-haiku-4-5",
}

const PRICING_USD_PER_MTOK: Record<ModelAlias, { input: number; output: number }> = {
  "sonnet-4-5": { input: 3, output: 15 },
  "haiku-4-5": { input: 1, output: 5 },
}

const RETRYABLE_STATUSES = new Set<number>([429, 500, 502, 503, 504])
const NON_RETRYABLE_STATUSES = new Set<number>([400, 401, 403, 404])
const RETRYABLE_NETWORK_CODES = new Set<string>(["ECONNRESET", "ETIMEDOUT"])

const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 2000
const DEFAULT_MAX_TOKENS = 4096

const client = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
  maxRetries: 0,
})

/**
 * Server-side tool come `web_search_20250305`. La sua shape non è tipizzata
 * dall'SDK 0.32.1 (manca `input_schema`, ha invece `type` con la versione del
 * tool). Lo accettiamo qui e lo passiamo al messages.create con un cast: il
 * runtime API accetta entrambe le forme nello stesso array `tools`.
 */
export interface ServerTool {
  type: string
  name: string
  [key: string]: unknown
}

export type ClaudeTool = Anthropic.Tool | ServerTool

export interface CallClaudeArgs {
  model: ModelAlias
  prompt: string
  system?: string
  tools?: ClaudeTool[]
  toolChoice?: Anthropic.ToolChoice
  maxTokens?: number
  /**
   * AbortSignal opzionale propagato all'SDK Anthropic via RequestOptions.
   * Quando aborted, la richiesta in volo viene cancellata e il retry loop
   * esce immediatamente senza ulteriori tentativi né delay.
   */
  signal?: AbortSignal
}

export interface CallClaudeUsage {
  inputTokens: number
  outputTokens: number
  costEur: number
}

export interface CallClaudeResult {
  content: Anthropic.ContentBlock[]
  usage: CallClaudeUsage
}

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

// Helper indiretto per leggere `signal.aborted` ed evitare il narrowing
// aggressivo di TS che mantiene `false | undefined` dopo il primo check.
function isSignalAborted(signal: AbortSignal | undefined): boolean {
  return signal !== undefined && signal.aborted
}

function getNetworkErrorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined
  const e = err as { code?: unknown; cause?: unknown }
  if (typeof e.code === "string") return e.code
  if (e.cause && typeof e.cause === "object") {
    const code = (e.cause as { code?: unknown }).code
    if (typeof code === "string") return code
  }
  return undefined
}

interface RetryDecision {
  retry: boolean
  reason: string
}

function classifyError(err: unknown): RetryDecision {
  if (err instanceof Anthropic.APIError) {
    const status = err.status
    if (typeof status === "number") {
      if (NON_RETRYABLE_STATUSES.has(status)) return { retry: false, reason: `http_${status}` }
      if (RETRYABLE_STATUSES.has(status)) return { retry: true, reason: `http_${status}` }
      // Status non listato (es. 408, 5xx fuori dal set): conservativo, non ritentare.
      return { retry: false, reason: `http_${status}_unhandled` }
    }
    // APIError senza status: errore di rete avvolto (APIConnectionError).
    const code = getNetworkErrorCode(err)
    if (code !== undefined && RETRYABLE_NETWORK_CODES.has(code)) {
      return { retry: true, reason: `network_${code}` }
    }
    if (err instanceof Anthropic.APIConnectionError) {
      // Connection error generico: ritenta una volta soltanto via backoff.
      return { retry: true, reason: "network_connection" }
    }
    return { retry: false, reason: "api_error_no_status" }
  }
  const code = getNetworkErrorCode(err)
  if (code !== undefined && RETRYABLE_NETWORK_CODES.has(code)) {
    return { retry: true, reason: `network_${code}` }
  }
  return { retry: false, reason: "unknown" }
}

function lookupHeader(
  headers: Record<string, string | null | undefined> | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined
  const target = name.toLowerCase()
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      const value = headers[key]
      return typeof value === "string" ? value : undefined
    }
  }
  return undefined
}

function parseRetryAfter(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10) * 1000
  }
  const dateMs = Date.parse(trimmed)
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }
  return undefined
}

function getRetryAfterMs(err: unknown): number | undefined {
  if (!(err instanceof Anthropic.APIError)) return undefined
  return parseRetryAfter(lookupHeader(err.headers, "retry-after"))
}

function exponentialBackoffMs(attempt: number): number {
  const base = BASE_DELAY_MS * Math.pow(2, attempt)
  return base + Math.random() * base
}

function computeCostEur(model: ModelAlias, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING_USD_PER_MTOK[model]
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  return costUsd * USD_EUR
}

export async function callClaude(args: CallClaudeArgs): Promise<CallClaudeResult> {
  const {
    model,
    prompt,
    system,
    tools,
    toolChoice,
    maxTokens = DEFAULT_MAX_TOKENS,
    signal,
  } = args
  const apiModel = MODEL_MAP[model]

  return claudeSemaphore.run(async () => {
    let lastError: unknown
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Fast-fail se il caller ha abortito mentre eravamo in coda al semaforo
      // o tra i retry: non sprechiamo un altro tentativo né delay di backoff.
      if (isSignalAborted(signal)) {
        throw new Error("callClaude aborted via signal")
      }
      const start = Date.now()
      try {
        const response = await client.messages.create(
          {
            model: apiModel,
            max_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
            system,
            // Il SDK 0.32.1 tipa `tools` come `Anthropic.Tool[]` (solo client tools),
            // ma l'API accetta anche server tools come web_search. Cast accettato.
            tools: tools as Anthropic.Tool[] | undefined,
            tool_choice: toolChoice,
          },
          { signal },
        )

        const inputTokens = response.usage.input_tokens
        const outputTokens = response.usage.output_tokens
        const costEur = computeCostEur(model, inputTokens, outputTokens)
        const durationMs = Date.now() - start

        logJson({
          event: "claude_call",
          model,
          inputTokens,
          outputTokens,
          costEur,
          durationMs,
        })

        return {
          content: response.content,
          usage: { inputTokens, outputTokens, costEur },
        }
      } catch (err) {
        lastError = err
        // Su abort segnalato dal caller: NON ritentare. Risolve il cost-leak
        // dei worker che timeoutano: la richiesta SDK è già cancellata, e
        // qui evitiamo retry/backoff su un signal ormai aborted.
        if (
          isSignalAborted(signal) ||
          err instanceof Anthropic.APIUserAbortError
        ) {
          throw err
        }
        const decision = classifyError(err)
        const isLastAttempt = attempt === MAX_ATTEMPTS - 1
        if (!decision.retry || isLastAttempt) throw err

        const retryAfterMs = getRetryAfterMs(err)
        const delayMs = retryAfterMs ?? exponentialBackoffMs(attempt)

        logJson({
          event: "claude_retry",
          attempt: attempt + 1,
          reason: decision.reason,
          delayMs,
          usedRetryAfter: retryAfterMs !== undefined,
        })

        await sleep(delayMs)
      }
    }
    // Il loop o ritorna o fa throw; questo è un guardrail.
    throw lastError instanceof Error ? lastError : new Error("callClaude failed without explicit error")
  })
}
