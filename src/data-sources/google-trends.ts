// Layer 1 stub: Google Trends via SerpAPI/DataForSEO (CONTEXT.md sez. 7).
// Se SERPAPI_KEY è settata, log TODO e fallback comunque a searchWeb finché
// l'integrazione reale non è in Phase 4.

import { env } from "@/lib/env"
import { searchWeb } from "@/data-sources/web-search"
import type { SearchResult, UserMarket } from "@/agent/types"

export interface FetchGoogleTrendsArgs {
  productName: string
  market: UserMarket
  maxUses?: number
  ttlDays?: number
  signal?: AbortSignal
}

export async function fetchGoogleTrends(
  args: FetchGoogleTrendsArgs,
): Promise<SearchResult> {
  const { productName, market, maxUses, ttlDays, signal } = args

  if (env.SERPAPI_KEY !== undefined) {
    console.log(
      JSON.stringify({
        event: "data_source_todo",
        source: "google_trends_serpapi",
        todo: "Phase 4: integrare SerpAPI/DataForSEO con SERPAPI_KEY",
      }),
    )
  }

  return searchWeb({
    query: `Google Trends interesse di ricerca per "${productName}" nel mercato ${market} ultimi 90 giorni; volume mensile stimato; related rising queries`,
    contextHint: "google_trends",
    maxUses,
    ttlDays,
    signal,
  })
}
