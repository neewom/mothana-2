// Pagination côté Edge Functions : PostgREST plafonne chaque requête à 1 000 lignes ; au-delà,
// une campagne serait silencieusement tronquée. Pages lues l'une après l'autre (volumes
// modestes, pas besoin du parallélisme de src/lib/fetchAllRows.ts) ; la requête fournie doit
// imposer un ordre stable (ex. .order('id')). Module pur : testé par Vitest
// (src/lib/fetchAllRowsDeno.test.ts).

export const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize: number = PAGE_SIZE,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) return { data: all, error }
    all.push(...(data ?? []))
    if (!data || data.length < pageSize) return { data: all, error: null }
  }
}
