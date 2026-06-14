import { createHash } from "node:crypto"
import type { QuantitativeEstimate } from "@/agent/types"

export const USD_EUR = 0.92

/**
 * Risolve un QuantitativeEstimate in un numero "best-effort":
 * - observed: ritorna value
 * - estimated_range: ritorna la media (min + max) / 2
 * - unknown: ritorna 0 (caller decide se nascondere il dato)
 *
 * Usato dall'aggregator per popolare breakdown.economics.data con valori
 * numerici puri da display, perdendo info di tipo (observed vs stimato).
 * Il caller mantiene la sorgente strutturata su WorkerOutput<EconomicsData>
 * per audit/debug.
 */
export function resolveQuantitativeEstimate(qe: QuantitativeEstimate): number {
  switch (qe.type) {
    case "observed":
      return qe.value
    case "estimated_range":
      return (qe.min + qe.max) / 2
    case "unknown":
      return 0
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Esegue una factory async con timeout e cancellazione effettiva.
 *
 * La factory riceve un `AbortSignal` che viene aborted al timeout. Chi usa
 * il signal deve propagarlo all'SDK Anthropic (RequestOptions.signal) o ad
 * altre chiamate cancellabili, così quando il timeout scatta la richiesta
 * sottostante viene davvero abortita — niente più late completions billable
 * che continuano in background dopo il timeout.
 *
 * Se la factory completa prima del timeout, il timer viene cancellato.
 * Se la factory throws per altri motivi (non per abort), l'errore è
 * preservato as-is.
 */
export function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ms)

  return new Promise<T>((resolve, reject) => {
    factory(controller.signal)
      .then((value) => {
        clearTimeout(timeoutId)
        resolve(value)
      })
      .catch((err: unknown) => {
        clearTimeout(timeoutId)
        if (controller.signal.aborted) {
          reject(
            new Error(
              `Timeout after ${ms}ms${label !== undefined ? ` (${label})` : ""}`,
            ),
          )
        } else {
          reject(err)
        }
      })
  })
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null"
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => stableStringify(v)).join(",") + "]"
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return (
    "{" +
    keys
      .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
      .join(",") +
    "}"
  )
}

export function hashInput(input: unknown): string {
  return createHash("sha256")
    .update(stableStringify(input))
    .digest("hex")
    .slice(0, 16)
}

type ClassValue = string | undefined | false | null

export function cn(...classes: ClassValue[]): string {
  return classes.filter((c): c is string => Boolean(c)).join(" ")
}
