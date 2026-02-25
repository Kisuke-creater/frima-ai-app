import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { getFirebaseDb } from "./firebase";
import type { Marketplace, ShippingSpec } from "./simulation/types";

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
  createdAt?: Timestamp;
  soldAt?: Timestamp | null;
  soldPrice?: number | null;
  shippingSpec?: ShippingSpec;
}

export function getFirestoreClientErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") {
      return "Firestore access was denied. Check Firestore Security Rules and make sure the signed-in user is allowed to read/write items.";
    }
    if (error.code === "unauthenticated") {
      return "You are not authenticated. Please sign in again and retry.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected Firestore error occurred.";
}

// 商品一覧取得
export async function getItems(uid: string): Promise<Item[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "users", uid, "items"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
}

// 商品追加
export async function addItem(
  item: Omit<Item, "id" | "createdAt" | "soldAt" | "soldPrice">
): Promise<string> {
  const db = getFirebaseDb();
  const docRef = await addDoc(collection(db, "users", item.uid, "items"), {
    ...item,
    status: "listed",
    createdAt: serverTimestamp(),
    soldAt: null,
    soldPrice: null,
  });
  return docRef.id;
}

// 売れた！マーク
export async function markAsSold(
  uid: string,
  itemId: string,
  soldPrice: number
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, "users", uid, "items", itemId);
  await updateDoc(ref, {
    status: "sold",
    soldAt: serverTimestamp(),
    soldPrice,
  });
}

export async function deleteItems(uid: string, itemIds: string[]): Promise<void> {
  const db = getFirebaseDb();
  await Promise.all(
    itemIds.map((itemId) => deleteDoc(doc(db, "users", uid, "items", itemId)))
  );
}

export async function updateItemSimulationInputs(
  uid: string,
  itemId: string,
  payload: {
    marketplace?: Marketplace;
    shippingSpec?: ShippingSpec;
  }
): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, "users", uid, "items", itemId);
  const updatePayload: Record<string, unknown> = {};

  if (payload.marketplace) {
    updatePayload.marketplace = payload.marketplace;
  }
  if (payload.shippingSpec) {
    updatePayload.shippingSpec = payload.shippingSpec;
  }

  if (Object.keys(updatePayload).length === 0) return;
  await updateDoc(ref, updatePayload);
}
