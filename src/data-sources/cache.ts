// Cache aggressiva su SQLite (CONTEXT.md sez. 7). TTL configurabile, default
// 7 giorni per dati di mercato. Chiave normalizzata via hashInput per essere
// stabile su input semanticamente identici.
//
// Solo Prisma Client API — niente raw SQL — per restare DB-agnostic.

import { prisma } from "@/lib/db"
import { hashInput } from "@/lib/utils"

const DEFAULT_TTL_DAYS = 7
const MS_PER_DAY = 24 * 60 * 60 * 1000

function logCache(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload))
}

export async function cacheGet<T>(rawKey: unknown): Promise<T | null> {
  const key = hashInput(rawKey)
  const entry = await prisma.cache.findUnique({ where: { key } })
  if (entry === null) {
    logCache({ event: "cache_miss", key })
    return null
  }
  if (entry.expiresAt.getTime() <= Date.now()) {
    // Lazy expiration: cancella e tratta come miss.
    await prisma.cache.delete({ where: { key } })
    logCache({ event: "cache_expired", key })
    return null
  }
  let parsed: T
  try {
    parsed = JSON.parse(entry.value) as T
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logCache({ event: "cache_parse_error", key, error: message })
    await prisma.cache.delete({ where: { key } })
    return null
  }
  logCache({ event: "cache_hit", key })
  return parsed
}

export async function cacheSet(
  rawKey: unknown,
  value: unknown,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<void> {
  if (!(ttlDays > 0)) {
    // Non scriviamo entry con TTL <=0 o NaN.
    logCache({ event: "cache_set_skipped", reason: "invalid_ttl", ttlDays })
    return
  }
  const key = hashInput(rawKey)
  const expiresAt = new Date(Date.now() + ttlDays * MS_PER_DAY)
  const json = JSON.stringify(value)
  await prisma.cache.upsert({
    where: { key },
    create: { key, value: json, expiresAt },
    update: { value: json, expiresAt },
  })
  logCache({ event: "cache_set", key, ttlDays })
}
