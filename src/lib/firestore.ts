import type { Marketplace, ShippingSpec } from "./simulation/types";

import { FirebaseError } from "firebase/app";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { getFirebaseAuth, getFirebaseDb } from "./firebase-client";

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

interface ItemDocument {
  uid: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  marketplace?: Marketplace | null;
  status: "listed" | "sold";
  createdAt?: Timestamp | null;
  soldAt?: Timestamp | null;
  soldPrice?: number | null;
  shippingSpec?: ShippingSpec | null;
}

export interface ImportItemInput {
  uid: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  marketplace?: Marketplace;
  status?: "listed" | "sold";
  soldPrice?: number | null;
  createdAt?: Date | null;
  soldAt?: Date | null;
  shippingSpec?: ShippingSpec;
}

function getUserItemsCollection(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "items");
}

function getUserItemDoc(uid: string, itemId: string) {
  return doc(getFirebaseDb(), "users", uid, "items", itemId);
}

function mapItemDocument(id: string, row: ItemDocument): Item {
  return {
    id,
    uid: row.uid,
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.condition,
    price: row.price,
    marketplace: row.marketplace ?? undefined,
    status: row.status,
    createdAt: row.createdAt ?? undefined,
    soldAt: row.soldAt ?? null,
    soldPrice: row.soldPrice ?? null,
    shippingSpec: row.shippingSpec ?? undefined,
  };
}

function sortByCreatedAtDesc(items: Item[]): Item[] {
  return items.sort((a, b) => {
    const aTime = a.createdAt?.toDate().getTime() ?? 0;
    const bTime = b.createdAt?.toDate().getTime() ?? 0;
    return bTime - aTime;
  });
}

async function getCurrentUid(): Promise<string> {
  const auth = getFirebaseAuth();
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }

  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error("Authentication is required. Please sign in again."));
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      clearTimeout(timeoutId);
      unsubscribe();
      if (!nextUser?.uid) {
        reject(new Error("Authentication is required. Please sign in again."));
        return;
      }
      resolve(nextUser.uid);
    });
  });
}

async function assertOwnedUser(uid: string): Promise<void> {
  const currentUid = await getCurrentUid();
  if (currentUid !== uid) {
    throw new Error("Authenticated user does not match requested user.");
  }
}

async function assertItemOwnership(uid: string, itemId: string): Promise<void> {
  const ref = getUserItemDoc(uid, itemId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Item not found.");
  }

  const data = snap.data() as Partial<ItemDocument>;
  if (data.uid && data.uid !== uid) {
    throw new Error("You do not have permission to modify this item.");
  }
}

export function getDatabaseClientErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "permission-denied":
        return "権限がありません。Firestore Rulesを確認してください。";
      case "unavailable":
        return "データベースに接続できません。時間を置いて再試行してください。";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected database error occurred.";
}

export const getFirestoreClientErrorMessage = getDatabaseClientErrorMessage;

const MAX_BATCH_WRITE_COUNT = 450;

export async function getItems(uid: string): Promise<Item[]> {
  await assertOwnedUser(uid);

  const snapshot = await getDocs(getUserItemsCollection(uid));
  const items = snapshot.docs.map((row) =>
    mapItemDocument(row.id, row.data() as ItemDocument),
  );

  return sortByCreatedAtDesc(items);
}

export async function addItem(
  item: Omit<Item, "id" | "createdAt" | "soldAt" | "soldPrice">,
): Promise<string> {
  await assertOwnedUser(item.uid);

  const docRef = await addDoc(getUserItemsCollection(item.uid), {
    uid: item.uid,
    title: item.title,
    description: item.description,
    category: item.category,
    condition: item.condition,
    price: item.price,
    marketplace: item.marketplace ?? null,
    status: "listed",
    createdAt: serverTimestamp(),
    soldAt: null,
    soldPrice: null,
    shippingSpec: item.shippingSpec ?? null,
  });

  return docRef.id;
}

export async function importItems(uid: string, items: ImportItemInput[]): Promise<void> {
  if (items.length === 0) return;

  await assertOwnedUser(uid);

  for (const item of items) {
    if (item.uid !== uid) {
      throw new Error("CSV内のユーザーIDが現在のログインユーザーと一致しません。");
    }
  }

  for (let index = 0; index < items.length; index += MAX_BATCH_WRITE_COUNT) {
    const batch = writeBatch(getFirebaseDb());
    const chunk = items.slice(index, index + MAX_BATCH_WRITE_COUNT);

    chunk.forEach((item) => {
      const status = item.status === "sold" ? "sold" : "listed";
      const soldPrice = status === "sold" ? (item.soldPrice ?? item.price) : null;

      batch.set(doc(getUserItemsCollection(uid)), {
        uid: item.uid,
        title: item.title,
        description: item.description,
        category: item.category,
        condition: item.condition,
        price: item.price,
        marketplace: item.marketplace ?? null,
        status,
        createdAt: item.createdAt ? Timestamp.fromDate(item.createdAt) : serverTimestamp(),
        soldAt:
          status === "sold"
            ? item.soldAt
              ? Timestamp.fromDate(item.soldAt)
              : serverTimestamp()
            : null,
        soldPrice,
        shippingSpec: item.shippingSpec ?? null,
      });
    });

    await batch.commit();
  }
}

export async function markAsSold(
  uid: string,
  itemId: string,
  soldPrice: number,
): Promise<void> {
  await assertOwnedUser(uid);
  await assertItemOwnership(uid, itemId);

  await updateDoc(getUserItemDoc(uid, itemId), {
    status: "sold",
    soldAt: serverTimestamp(),
    soldPrice,
  });
}

export async function deleteItems(uid: string, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;

  await assertOwnedUser(uid);

  const batch = writeBatch(getFirebaseDb());
  await Promise.all(itemIds.map((itemId) => assertItemOwnership(uid, itemId)));

  itemIds.forEach((itemId) => {
    batch.delete(getUserItemDoc(uid, itemId));
  });

  await batch.commit();
}

export async function updateItemSimulationInputs(
  uid: string,
  itemId: string,
  payload: {
    marketplace?: Marketplace;
    shippingSpec?: ShippingSpec;
  },
): Promise<void> {
  await assertOwnedUser(uid);
  await assertItemOwnership(uid, itemId);

  const updatePayload: Record<string, unknown> = {};

  if (payload.marketplace) {
    updatePayload.marketplace = payload.marketplace;
  }
  if (payload.shippingSpec) {
    updatePayload.shippingSpec = payload.shippingSpec;
  }

  if (Object.keys(updatePayload).length === 0) return;

  await updateDoc(getUserItemDoc(uid, itemId), updatePayload);
}
