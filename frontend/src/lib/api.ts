/**
 * Typed fetch client for the FastAPI backend.
 *
 * - Always sends cookies (`credentials: include`) so the httpOnly JWT works.
 * - Attaches the active workspace header when one is set.
 * - Normalises FastAPI error envelopes into `ApiError`.
 */

import type { ApiErrorBody } from "@/lib/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WORKSPACE_KEY = "finsight.workspaceId";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(WORKSPACE_KEY);
}

export function setActiveWorkspaceId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(WORKSPACE_KEY, id);
  else window.localStorage.removeItem(WORKSPACE_KEY);
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the X-Workspace-Id header (auth + workspace bootstrap calls). */
  noWorkspace?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

async function buildUrl(path: string, query?: RequestOptions["query"]): Promise<string> {
  const url = new URL(path.startsWith("http") ? path : `${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, noWorkspace, query, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (!noWorkspace) {
    const workspaceId = getActiveWorkspaceId();
    if (workspaceId) requestHeaders.set("X-Workspace-Id", workspaceId);
  }

  const response = await fetch(await buildUrl(path, query), {
    ...rest,
    headers: requestHeaders,
    credentials: "include",
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const envelope = payload as Partial<ApiErrorBody> | null;
    const message =
      envelope?.error?.message ??
      (typeof payload === "string" && payload
        ? payload
        : `Request failed with status ${response.status}`);
    const code = envelope?.error?.code ?? "unknown_error";
    throw new ApiError(response.status, code, message);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

export const API_BASE = BASE_URL;
