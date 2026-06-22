import type { CreateItemResponse, ItemDetail, ItemStatus, ItemSummary, SourceType } from "../shared/types.js";

export interface AppConfig {
  appPublicUrl: string;
  authEnabled: boolean;
  clerkPublishableKey: string | null;
}

export interface ItemFilters {
  query: string;
  status: ItemStatus | "all";
  source: SourceType | "all";
}

let tokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null): void {
  tokenProvider = provider;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = tokenProvider ? await tokenProvider() : null;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getAppConfig(): Promise<AppConfig> {
  return request<AppConfig>("/api/config");
}

export async function getMe(): Promise<{ user: { userId: string; email: string | null } | null; authEnabled: boolean }> {
  return request<{ user: { userId: string; email: string | null } | null; authEnabled: boolean }>("/api/me");
}

export async function listItems(filters: ItemFilters): Promise<ItemSummary[]> {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("query", filters.query.trim());
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.source !== "all") params.set("source", filters.source);

  const result = await request<{ items: ItemSummary[] }>(`/api/items?${params}`);
  return result.items;
}

export async function createItem(url: string): Promise<CreateItemResponse> {
  return request<CreateItemResponse>("/api/items", {
    method: "POST",
    body: JSON.stringify({ url })
  });
}

export async function getItem(id: string): Promise<ItemDetail> {
  const result = await request<{ item: ItemDetail }>(`/api/items/${id}`);
  return result.item;
}

export async function reprocessItem(id: string): Promise<ItemDetail> {
  const result = await request<{ item: ItemDetail }>(`/api/items/${id}/reprocess`, {
    method: "POST",
    body: JSON.stringify({})
  });
  return result.item;
}

export async function deleteItem(id: string): Promise<void> {
  await request<void>(`/api/items/${id}`, {
    method: "DELETE"
  });
}
