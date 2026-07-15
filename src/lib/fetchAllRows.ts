// Supabase/PostgREST caps each request at 1000 rows by default. For large
// organisations (thousands of participants/dons), fetch every page instead
// of silently truncating the result.
const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) return { data: all, error: error.message }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return { data: all, error: null }
}
