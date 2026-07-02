import type { CreateItemResponse, ItemDetail, ItemStatus, ItemSummary, SourceType } from "../shared/types.js";

export interface AppConfig {
  appPublicUrl: string;
  authEnabled: boolean;
  authProvider: "none" | "password" | "clerk";
  clerkPublishableKey: string | null;
}

export interface AppUser {
  userId: string;
  email: string | null;
  authMethod: "local" | "password" | "extension-token" | "clerk";
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
  const headers = new Headers(options?.headers);
  if (options?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const { headers: _headers, ...requestOptions } = options ?? {};
  const response = await fetch(url, {
    credentials: "include",
    ...requestOptions,
    headers
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

export async function getMe(): Promise<{ user: AppUser | null; authEnabled: boolean; authProvider: AppConfig["authProvider"] }> {
  return request<{ user: AppUser | null; authEnabled: boolean; authProvider: AppConfig["authProvider"] }>("/api/me");
}

export async function loginWithPassword(password: string): Promise<{ user: AppUser; authEnabled: boolean; authProvider: AppConfig["authProvider"] }> {
  return request<{ user: AppUser; authEnabled: boolean; authProvider: AppConfig["authProvider"] }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export async function logout(): Promise<void> {
  await request<void>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({})
  });
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
