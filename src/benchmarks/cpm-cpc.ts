// Benchmark CPM/CPA/CVR (CONTEXT.md sez. 4).
// Tutti i valori in USD: la conversione EUR è responsabilità del worker
// chiamante via USD_EUR di src/lib/utils.ts. NON mischiare valute qui.

import type { UserChannel, UserMarket } from "@/agent/types"

// --- CPM TikTok in-feed (USD per 1000 impression) ---

export const CPM_BENCHMARKS_TIKTOK_USD: Record<string, number> = {
  retail: 7.9,
  beauty: 7.4,
  health_wellness: 9.2,
  pets: 8.1,
  home: 9.5,
  fashion: 11.0,
  tech: 10.5,
  fitness: 9.8,
}
export const CPM_TIKTOK_DEFAULT_USD = 9.16

// Triple Whale specifico ecommerce — più alto perché dataset selezionato
// (alta intent, conversion-driven).
export const CPM_BENCHMARKS_TRIPLE_WHALE_USD = 13.26

// --- CPM Meta (USD), per market ---

export const CPM_BENCHMARKS_META_USD: Record<UserMarket, number> = {
  IT: 8.5,
  EU: 9.0,
  US: 14.19,
  GLOBAL: 10,
}

// Variazioni Meta per categoria (CONTEXT.md non specifica market — applichiamo
// come override sul market default: se la categoria ha override, vince).
export const CPM_META_CATEGORY_OVERRIDE_USD: Record<string, number> = {
  beauty: 9.5,
  fashion: 11,
  tech: 10,
}

// --- CVR ecommerce ---

export const CVR_BENCHMARKS: Record<"tiktok" | "meta", number> = {
  tiktok: 0.02,
  meta: 0.025,
}
export const CVR_DEFAULT = 0.022

// --- CPA TikTok ecommerce (USD) ---

export const CPA_BENCHMARKS_TIKTOK_USD: Record<string, number> = {
  pets: 13.46,
  health_wellness: 16.87,
  beauty: 18.82,
  home: 22,
  fashion: 25,
  tech: 28,
}
export const CPA_TIKTOK_DEFAULT_USD = 32.74

// --- Helper di lookup ---

function logMissingCategory(
  helper: string,
  channel: string,
  category: string,
  fallback: number,
): void {
  console.log(
    JSON.stringify({
      event: "benchmark_category_fallback",
      helper,
      channel,
      category,
      fallback,
    }),
  )
}

export type CpmChannel = "tiktok" | "meta"

export function lookupCpmUsd(args: {
  channel: CpmChannel
  category: string
  market?: UserMarket
}): number {
  const { channel, category, market = "GLOBAL" } = args
  if (channel === "tiktok") {
    const v = CPM_BENCHMARKS_TIKTOK_USD[category]
    if (v !== undefined) return v
    logMissingCategory("lookupCpmUsd", "tiktok", category, CPM_TIKTOK_DEFAULT_USD)
    return CPM_TIKTOK_DEFAULT_USD
  }
  // Meta: l'override per categoria ha precedenza sul default per market.
  const override = CPM_META_CATEGORY_OVERRIDE_USD[category]
  if (override !== undefined) return override
  const marketDefault = CPM_BENCHMARKS_META_USD[market]
  return marketDefault
}

export function lookupCpaTiktokUsd(category: string): number {
  const v = CPA_BENCHMARKS_TIKTOK_USD[category]
  if (v !== undefined) return v
  logMissingCategory(
    "lookupCpaTiktokUsd",
    "tiktok",
    category,
    CPA_TIKTOK_DEFAULT_USD,
  )
  return CPA_TIKTOK_DEFAULT_USD
}

export function lookupCvr(channel: CpmChannel): number {
  return CVR_BENCHMARKS[channel]
}

// Mapping da UserChannel a CpmChannel per uso interno worker.
// amazon_fba non ha CPM: i worker che lo gestiscono devono saltare il calcolo.
export function userChannelToCpmChannel(
  userChannel: UserChannel,
): CpmChannel | null {
  if (userChannel === "tiktok_shop") return "tiktok"
  if (userChannel === "shopify_tiktok") return "tiktok"
  if (userChannel === "shopify_meta") return "meta"
  return null
}
