import { env } from "@/lib/env"

export class Semaphore {
  private permits: number
  private readonly queue: Array<() => void> = []

  constructor(maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error(`Semaphore: maxConcurrent must be a positive integer, got ${maxConcurrent}`)
    }
    this.permits = maxConcurrent
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    const next = this.queue.shift()
    if (next !== undefined) {
      // Trasferisci il permit direttamente al waiter — non incrementare permits.
      next()
    } else {
      this.permits++
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try {
      return await fn()
    } finally {
      this.release()
    }
  }
}

export const claudeSemaphore = new Semaphore(env.CLAUDE_MAX_CONCURRENT)
