import { z } from "zod"

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "required"),
  DATABASE_URL: z.string().min(1, "required"),
  CLAUDE_MAX_CONCURRENT: z.coerce.number().int().positive().default(4),
  APIFY_TOKEN: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  SERPAPI_KEY: z.string().optional(),
  KEEPA_KEY: z.string().optional(),
})

const parsed = EnvSchema.safeParse(process.env)

if (!parsed.success) {
  const fieldErrors = parsed.error.flatten().fieldErrors
  const lines = Object.entries(fieldErrors)
    .map(([key, messages]) => `  - ${key}: ${(messages ?? []).join(", ")}`)
    .join("\n")
  throw new Error(`Invalid environment variables:\n${lines}`)
}

export const env = parsed.data
export type Env = typeof env
