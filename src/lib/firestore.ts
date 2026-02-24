import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";

export interface Item {
  id?: string;
  uid: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: number;
  status: "listed" | "sold";
  createdAt?: Timestamp;
  soldAt?: Timestamp | null;
}

// 商品一覧取得
export async function getItems(uid: string): Promise<Item[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, "items"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Item));
}

// 商品追加
export async function addItem(
  item: Omit<Item, "id" | "createdAt" | "soldAt">
): Promise<string> {
  const db = getFirebaseDb();
  const docRef = await addDoc(collection(db, "items"), {
    ...item,
    status: "listed",
    createdAt: serverTimestamp(),
    soldAt: null,
  });
  return docRef.id;
}

// 売れた！マーク
export async function markAsSold(itemId: string): Promise<void> {
  const db = getFirebaseDb();
  const ref = doc(db, "items", itemId);
  await updateDoc(ref, {
    status: "sold",
    soldAt: serverTimestamp(),
  });
}
