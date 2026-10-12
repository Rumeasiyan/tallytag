export class ApiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

export type Condition = "working" | "needs_repair" | "unserviceable" | "missing";
export const CONDITIONS: Condition[] = ["working", "needs_repair", "unserviceable", "missing"];
export type Status = "found" | "missing" | "extra";

export interface Item {
  tagNumber: string;
  description: string;
  category: string;
  building: string;
  floor: string;
  room: string;
  status: Status;
  condition: Condition | null;
  notes: string;
  photoId: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
  conflict: boolean;
  onList: boolean;
}

export interface Counts {
  total: number;
  found: number;
  missing: number;
  extra: number;
  needsAttention: number;
  conflicts: number;
}

export function countItems(items: Item[]): Counts {
  const c: Counts = { total: 0, found: 0, missing: 0, extra: 0, needsAttention: 0, conflicts: 0 };
  for (const it of items) {
    c.total++;
    c[it.status]++;
    if (it.condition === "needs_repair" || it.condition === "unserviceable" || it.condition === "missing") c.needsAttention++;
    if (it.conflict) c.conflicts++;
  }
  return c;
}

export interface Member {
  memberId: string;
  name: string;
  joinedAt: string;
  checks: number;
}

type Opts = { method?: string; token?: string; body?: unknown; raw?: BodyInit; contentType?: string };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts.raw !== undefined) {
    body = opts.raw;
    if (opts.contentType) headers["Content-Type"] = opts.contentType;
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { method: opts.method || (body ? "POST" : "GET"), headers, body });
  } catch {
    throw new ApiError("network", 0);
  }
  if (!res.ok) {
    let code = "generic";
    try {
      code = (await res.json()).error.code;
    } catch {}
    throw new ApiError(code, res.status);
  }
  if (res.headers.get("content-type")?.includes("application/json")) return (await res.json()) as T;
  return (await res.blob()) as unknown as T;
}

export function errorKey(e: unknown): string {
  const code = e instanceof ApiError ? e.code : "generic";
  return `err.${code}`;
}
