// Layer 2 stub: Apify actors per TikTok hashtags e Shopify stores
// (CONTEXT.md sez. 7). Se APIFY_TOKEN è settata, log TODO e fallback a
// searchWeb fino a integrazione Phase 4.

import { env } from "@/lib/env"
import { searchWeb } from "@/data-sources/web-search"
import type { SearchResult } from "@/agent/types"

function logApifyTodoIfConfigured(actor: string): void {
  if (env.APIFY_TOKEN !== undefined) {
    console.log(
      JSON.stringify({
        event: "data_source_todo",
        source: `apify_${actor}`,
        todo: "Phase 4: lanciare Apify actor con APIFY_TOKEN",
      }),
    )
  }
}

export interface FetchApifyArgs {
  productName: string
  maxUses?: number
  ttlDays?: number
  signal?: AbortSignal
}

export async function fetchTikTokHashtags(
  args: FetchApifyArgs,
): Promise<SearchResult> {
  logApifyTodoIfConfigured("tiktok_hashtags")
  return searchWeb({
    query: `TikTok: hashtag rilevanti per "${args.productName}" 2026, views totali per hashtag, momentum (rising/stable/declining), creator engagement`,
    contextHint: "tiktok_hashtags",
    maxUses: args.maxUses,
    ttlDays: args.ttlDays,
    signal: args.signal,
  })
}

export async function fetchShopifyStores(
  args: FetchApifyArgs,
): Promise<SearchResult> {
  logApifyTodoIfConfigured("shopify_stores")
  return searchWeb({
    query: `Stima store Shopify che vendono "${args.productName}" 2026: numero approssimativo, eventuali brand consolidati, presenza di leader di mercato`,
    contextHint: "shopify_stores",
    maxUses: args.maxUses,
    ttlDays: args.ttlDays,
    signal: args.signal,
  })
}
