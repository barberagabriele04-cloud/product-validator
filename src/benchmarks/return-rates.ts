// Tassi di reso per categoria (CONTEXT.md sez. 4).
// Valori frazionari (0.05 = 5%). Soglia veto a 20%.

export const RETURN_RATES_BY_CATEGORY: Record<string, number> = {
  home: 0.05,
  lifestyle: 0.05,
  tech: 0.12,
  fashion: 0.10,
  beauty: 0.06,
  fitness: 0.08,
  pets: 0.04,
}

export const RETURN_RATE_DEFAULT = 0.10

export const RETURN_RATE_VETO_THRESHOLD = 0.20

export function lookupReturnRate(category: string): number {
  const v = RETURN_RATES_BY_CATEGORY[category]
  if (v !== undefined) return v
  console.log(
    JSON.stringify({
      event: "benchmark_category_fallback",
      helper: "lookupReturnRate",
      category,
      fallback: RETURN_RATE_DEFAULT,
    }),
  )
  return RETURN_RATE_DEFAULT
}
