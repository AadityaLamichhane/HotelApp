import { throwNotFoundError } from "@/utils/error";

/**
 * Template service — replace the in-memory Map with drizzle Model calls.
 * Throw with throwErrorOnValidation / throwNotFoundError / throwUnauthorizedError
 * so the central errorHandler maps them to 422 / 404 / 401.
 */
const store = new Map<number, { id: number; name: string; description?: string | null }>();
let seq = 1;

const list = async (query: any) => {
  const page = Number(query?.page) || 1;
  const limit = Number(query?.limit) || 10;
  const items = [...store.values()].slice((page - 1) * limit, page * limit);
  return { items, page, limit, total: store.size };
};

const create = async (input: { name: string; description?: string | null }) => {
  const row = { id: seq++, ...input };
  store.set(row.id, row);
  return row;
};

const update = async (id: number, input: any) => {
  const existing = store.get(Number(id));
  if (!existing) throwNotFoundError("Item");
  const row = { ...existing, ...input };
  store.set(Number(id), row);
  return row;
};

const remove = async (id: number) => {
  const existing = store.get(Number(id));
  if (!existing) throwNotFoundError("Item");
  store.delete(Number(id));
  return existing;
};

export default { list, create, update, remove };
