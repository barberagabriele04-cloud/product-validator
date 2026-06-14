// Categorie ristrette per piattaforma (CONTEXT.md sez. 4).
// Match veto rosso automatico se la categoria del prodotto è ristretta sul
// canale scelto dall'utente.

import type { UserChannel } from "@/agent/types"

export type RestrictedPlatform = "meta" | "tiktok"

export const RESTRICTED_CATEGORIES: Record<RestrictedPlatform, string[]> = {
  meta: [
    "weapons",
    "supplements_health_claims",
    "cbd_cannabis",
    "medical_devices",
    "adult",
    "gambling",
    "tobacco_vape",
    "alcoholics",
    "political_ads",
  ],
  tiktok: [
    "weapons",
    "supplements_health_claims",
    "cbd_cannabis",
    "medical_devices",
    "adult",
    "gambling",
    "tobacco_vape",
    "alcoholics",
    "political_ads",
    "financial_services",
  ],
}

function platformForChannel(
  channel: UserChannel,
): RestrictedPlatform | null {
  if (channel === "shopify_meta") return "meta"
  if (channel === "tiktok_shop" || channel === "shopify_tiktok") return "tiktok"
  // amazon_fba ha le sue policy: gestione in Phase 4.
  return null
}

export function isRestrictedCategory(
  category: string,
  channel: UserChannel,
): boolean {
  const platform = platformForChannel(channel)
  if (platform === null) {
    // TODO Phase 4: integrare lista restricted categories Amazon.
    return false
  }
  return RESTRICTED_CATEGORIES[platform].includes(category)
}

/**
 * Restituisce TUTTE le piattaforme dove la categoria è ristretta,
 * indipendentemente dal canale scelto dall'utente. Usato dal compliance
 * banner per informare l'utente delle alternative.
 */
export function getRestrictedPlatforms(
  category: string,
): RestrictedPlatform[] {
  const result: RestrictedPlatform[] = []
  if (RESTRICTED_CATEGORIES.meta.includes(category)) result.push("meta")
  if (RESTRICTED_CATEGORIES.tiktok.includes(category)) result.push("tiktok")
  return result
}

/**
 * Heuristica: la categoria richiede marcatura CE per import/vendita EU?
 * Conservatore: include elettronica, prodotti a contatto con la pelle, e
 * health-related. Fashion/retail/pets/lifestyle non richiedono CE in
 * generale (esistono eccezioni — il LLM può segnalarle in trademarkDetails
 * o complianceWarnings se rilevanti).
 */
export function ceComplianceRequiredForCategory(category: string): boolean {
  const ceCategories = new Set<string>([
    "tech",
    "home", // include lampade, piccoli elettrodomestici
    "fitness", // wearables, attrezzi elettrici
    "beauty", // cosmetici/skin contact, alcune linee
    "health_wellness", // medical devices, integratori richiedono notifica
    "medical_devices",
  ])
  return ceCategories.has(category)
}
