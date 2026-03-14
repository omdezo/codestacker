export function paginate(query: Record<string, unknown>) {
  const page = Math.max(1, parseInt((query.page as string) || '1', 10));
  const size = Math.max(1, Math.min(100, parseInt((query.size as string) || '20', 10)));
  return { skip: (page - 1) * size, take: size, page, size };
}

export function parseOrder(
  query: Record<string, unknown>,
  allowedColumns: string[],
  defaultColumn: string,
  defaultOrder: 'asc' | 'desc' = 'asc',
): { column: string; order: 'asc' | 'desc' } {
  const column = allowedColumns.includes(query.sortBy as string)
    ? (query.sortBy as string)
    : defaultColumn;
  const order = (query.order as string) === 'desc' ? 'desc' : defaultOrder;
  return { column, order };
}
