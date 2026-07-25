// Supabase/PostgREST caps each request at 1000 rows by default. For large
// organisations (thousands of participants/dons), fetch every page instead
// of silently truncating the result.
const PAGE_SIZE = 1000

// Pages are fetched in parallel batches rather than one at a time — for an
// organisation with e.g. 15 000 rows (16 pages), awaiting each page
// sequentially means 16 round-trips back to back. A trailing page or two
// near the end of a batch may come back empty once the data is exhausted;
// that's a small, bounded cost worth the reduction in wall-clock latency.
const BATCH_SIZE = 4

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = []
  let from = 0
  let done = false

  while (!done) {
    const batchStarts = Array.from({ length: BATCH_SIZE }, (_, i) => from + i * PAGE_SIZE)
    const results = await Promise.all(batchStarts.map((start) => page(start, start + PAGE_SIZE - 1)))

    for (const { data, error } of results) {
      if (error) return { data: all, error: error.message }
      all.push(...(data ?? []))
      if (!data || data.length < PAGE_SIZE) done = true
    }

    from += BATCH_SIZE * PAGE_SIZE
  }

  return { data: all, error: null }
}
