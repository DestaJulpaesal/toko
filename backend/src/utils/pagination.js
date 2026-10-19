export function parsePagination(query, { defaultPageSize = 50, maxPageSize = 200 } = {}) {
  const requestedPage = Number.parseInt(String(query.page || '1'), 10);
  const requestedPageSize = Number.parseInt(String(query.pageSize || defaultPageSize), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(maxPageSize, Math.max(1, requestedPageSize))
    : defaultPageSize;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
