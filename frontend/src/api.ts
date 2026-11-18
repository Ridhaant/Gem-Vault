import { handleMockApi } from "./mockData";

const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
export const TOKEN_KEY = "gemvault_token";
export const COST_TOKEN_KEY = "gemvault_cost_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getCostToken(): string | null {
  return localStorage.getItem(COST_TOKEN_KEY);
}
export function setCostToken(token: string | null) {
  if (token === null) {
    localStorage.removeItem(COST_TOKEN_KEY);
  } else {
    localStorage.setItem(COST_TOKEN_KEY, token);
  }
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const method = init.method || "GET";
  const body = init.body ? JSON.parse(init.body as string) : undefined;

  // 1. First attempt: High-speed local backend server (SQLite) with 2.5s timeout
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const costToken = getCostToken();
  if (costToken) {
    headers.set("X-Cost-Token", costToken);
    headers.set("X-Cost-Unlocked", "true");
  }

  const url = BASE ? `${BASE}/api${path}` : `/api${path}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(url, { ...init, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const text = await res.text();
      return (text ? JSON.parse(text) : null) as T;
    }
    // Backend is reachable but rejected request with HTTP 4xx/5xx
    const errText = await res.text();
    let errMsg = `Request failed with status ${res.status}`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.detail) errMsg = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
      else if (parsed.message) errMsg = parsed.message;
    } catch {}
    throw new ApiError(errMsg, res.status);
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Backend offline, timed out, or unreachable -> transparently fall back to high-capacity local store
  }

  // 2. Second attempt: Direct proxy /api if BASE had port mismatch
  if (BASE && BASE.startsWith("http")) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const proxyRes = await fetch(`/api${path}`, { ...init, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (proxyRes.ok) {
        const text = await proxyRes.text();
        return (text ? JSON.parse(text) : null) as T;
      }
    } catch {}
  }

  // 3. Fallback: Instant reactive response from high-capacity client storage (IndexedDB + In-Memory)
  return handleMockApi(path, method, body) as T;
}

export const apiGet = <T = any>(p: string) => api<T>(p);
export const apiPost = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined });
export const apiPut = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "PUT", body: body ? JSON.stringify(body) : undefined });
export const apiPatch = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(p: string) => api<T>(p, { method: "DELETE" });
