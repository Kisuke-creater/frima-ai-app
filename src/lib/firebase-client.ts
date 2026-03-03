import {
  FirebaseError,
  type FirebaseApp,
  getApp,
  getApps,
  initializeApp,
} from "firebase/app";
import { type Auth, getAuth, GoogleAuthProvider } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";

const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const FIREBASE_AUTH_DOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const FIREBASE_APP_ID = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const FIREBASE_STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const FIREBASE_MESSAGING_SENDER_ID =
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;

let firebaseApp: FirebaseApp | null = null;
let googleProvider: GoogleAuthProvider | null = null;

function getMissingFirebaseEnvKeys(): string[] {
  const missing: string[] = [];
  if (!FIREBASE_API_KEY) missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!FIREBASE_AUTH_DOMAIN) missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!FIREBASE_PROJECT_ID) missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!FIREBASE_APP_ID) missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");
  return missing;
}

function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;

  const missingKeys = getMissingFirebaseEnvKeys();
  if (missingKeys.length > 0) {
    throw new Error(`${missingKeys.join(", ")} is not set.`);
  }

  firebaseApp =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: FIREBASE_API_KEY,
          authDomain: FIREBASE_AUTH_DOMAIN,
          projectId: FIREBASE_PROJECT_ID,
          appId: FIREBASE_APP_ID,
          storageBucket: FIREBASE_STORAGE_BUCKET,
          messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
        });

  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export function getGoogleAuthProvider(): GoogleAuthProvider {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
  }
  return googleProvider;
}

export function isFirebaseError(error: unknown): error is FirebaseError {
  return error instanceof FirebaseError;
}
