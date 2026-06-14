// Layer 1 stub: Meta Ad Library API (CONTEXT.md sez. 7).
// Se META_ACCESS_TOKEN è settata, log TODO e fallback a searchWeb fino a
// integrazione Phase 4.

import { env } from "@/lib/env"
import { searchWeb } from "@/data-sources/web-search"
import type { SearchResult, UserMarket } from "@/agent/types"

export interface FetchMetaAdsArgs {
  productName: string
  market: UserMarket
  maxUses?: number
  ttlDays?: number
  signal?: AbortSignal
}

export async function fetchMetaAds(
  args: FetchMetaAdsArgs,
): Promise<SearchResult> {
  const { productName, market, maxUses, ttlDays, signal } = args

  if (env.META_ACCESS_TOKEN !== undefined) {
    console.log(
      JSON.stringify({
        event: "data_source_todo",
        source: "meta_ad_library",
        todo: "Phase 4: integrare Meta Ad Library API con META_ACCESS_TOKEN",
      }),
    )
  }

  return searchWeb({
    query: `Meta Ad Library: ads attive per "${productName}" nel mercato ${market}, conteggio totale, durata media in giorni, brand dominanti se presenti`,
    contextHint: "meta_ad_library",
    maxUses,
    ttlDays,
    signal,
  })
}
