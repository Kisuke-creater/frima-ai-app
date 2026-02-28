import type { Marketplace, ShippingSpec } from "./simulation/types";

import { getAuthTokenFromCookie } from "./auth-cookie";

interface SupabaseErrorBody {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

export interface TimestampLike {
  toDate: () => Date;
}

export interface Item {
  id?: string;
  uid: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  marketplace?: Marketplace;
  status: "listed" | "sold";
  createdAt?: TimestampLike;
  soldAt?: TimestampLike | null;
  soldPrice?: number | null;
  shippingSpec?: ShippingSpec;
}

interface ItemRow {
  id: string;
  uid: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  marketplace: Marketplace | null;
  status: "listed" | "sold";
  created_at: string | null;
  sold_at: string | null;
  sold_price: number | null;
  shipping_spec: ShippingSpec | null;
}

function toTimestampLike(
  value: string | null | undefined
): TimestampLike | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    toDate: () => date,
  };
}

function mapItemRow(row: ItemRow): Item {
  const createdAt = toTimestampLike(row.created_at);
  return {
    id: row.id,
    uid: row.uid,
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.condition,
    price: row.price,
    marketplace: row.marketplace ?? undefined,
    status: row.status,
    createdAt: createdAt ?? undefined,
    soldAt: toTimestampLike(row.sold_at),
    soldPrice: row.sold_price,
    shippingSpec: row.shipping_spec ?? undefined,
  };
}

function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  itemsTable: string;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const itemsTable = process.env.NEXT_PUBLIC_SUPABASE_ITEMS_TABLE ?? "items";

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey, itemsTable };
}

async function requestSupabase<T>(
  query: URLSearchParams,
  init: RequestInit
): Promise<T> {
  const { url, anonKey, itemsTable } = getSupabaseConfig();
  const accessToken = getAuthTokenFromCookie();
  if (!accessToken) {
    throw new Error("Authentication is required. Please sign in again.");
  }
  const headers = new Headers(init.headers);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(
    `${url}/rest/v1/${itemsTable}?${query.toString()}`,
    {
      ...init,
      headers,
    }
  );

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as SupabaseErrorBody | null;

    const parts = [
      errorBody?.message,
      errorBody?.details,
      errorBody?.hint,
      errorBody?.code ? `code: ${errorBody.code}` : null,
    ].filter(Boolean);

    throw new Error(
      parts.length > 0
        ? parts.join(" / ")
        : `Supabase request failed (${response.status})`
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function getDatabaseClientErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "An unexpected database error occurred.";
}

export const getFirestoreClientErrorMessage = getDatabaseClientErrorMessage;

export async function getItems(_uid: string): Promise<Item[]> {
  void _uid;
  const query = new URLSearchParams({
    select:
      "id,uid,title,description,category,condition,price,marketplace,status,created_at,sold_at,sold_price,shipping_spec",
    order: "created_at.desc",
  });

  const rows = await requestSupabase<ItemRow[]>(query, { method: "GET" });
  return rows.map(mapItemRow);
}

export async function addItem(
  item: Omit<Item, "id" | "createdAt" | "soldAt" | "soldPrice">
): Promise<string> {
  const query = new URLSearchParams({
    select: "id",
  });

  const rows = await requestSupabase<Array<{ id: string }>>(query, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      title: item.title,
      description: item.description,
      category: item.category,
      condition: item.condition,
      price: item.price,
      marketplace: item.marketplace ?? null,
      status: "listed",
      created_at: new Date().toISOString(),
      sold_at: null,
      sold_price: null,
      shipping_spec: item.shippingSpec ?? null,
    }),
  });

  const insertedId = rows[0]?.id;
  if (!insertedId) {
    throw new Error("Failed to insert item into Supabase.");
  }
  return insertedId;
}

export async function markAsSold(
  _uid: string,
  itemId: string,
  soldPrice: number
): Promise<void> {
  const query = new URLSearchParams({
    id: `eq.${itemId}`,
  });

  await requestSupabase<void>(query, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      status: "sold",
      sold_at: new Date().toISOString(),
      sold_price: soldPrice,
    }),
  });
}

export async function deleteItems(_uid: string, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;

  const quotedIds = itemIds
    .map((id) => `"${id.replace(/"/g, '\\"')}"`)
    .join(",");

  const query = new URLSearchParams({
    id: `in.(${quotedIds})`,
  });

  await requestSupabase<void>(query, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

export async function updateItemSimulationInputs(
  _uid: string,
  itemId: string,
  payload: {
    marketplace?: Marketplace;
    shippingSpec?: ShippingSpec;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};

  if (payload.marketplace) {
    updatePayload.marketplace = payload.marketplace;
  }
  if (payload.shippingSpec) {
    updatePayload.shipping_spec = payload.shippingSpec;
  }

  if (Object.keys(updatePayload).length === 0) return;

  const query = new URLSearchParams({
    id: `eq.${itemId}`,
  });

  await requestSupabase<void>(query, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(updatePayload),
  });
}

