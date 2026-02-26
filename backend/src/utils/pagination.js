/**
 * Safe pagination parser.
 *
 * Parses `limit` and `offset` from raw query values, enforcing:
 *   - Numeric coercion with safe defaults on NaN / missing
 *   - Maximum cap on limit (default 100)
 *   - Minimum 1 for limit, 0 for offset
 *
 * Usage:
 *   const { limit, offset } = parsePagination(req.query);
 *   query = query.range(offset, offset + limit - 1);
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

export const parsePagination = (query = {}, defaults = {}) => {
  const maxLimit = defaults.maxLimit ?? MAX_LIMIT;
  const defaultLimit = defaults.limit ?? DEFAULT_LIMIT;
  const defaultOffset = defaults.offset ?? DEFAULT_OFFSET;

  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) {
    limit = defaultLimit;
  } else if (limit > maxLimit) {
    limit = maxLimit;
  }

  let offset = parseInt(query.offset, 10);
  if (!Number.isFinite(offset) || offset < 0) {
    offset = defaultOffset;
  }

  return { limit, offset };
};
