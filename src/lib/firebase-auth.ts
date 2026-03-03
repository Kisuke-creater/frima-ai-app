import {
  createUserWithEmailAndPassword,
  getIdTokenResult,
  onIdTokenChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

import {
  getFirebaseAuth,
  getGoogleAuthProvider,
  isFirebaseError,
} from "./firebase-client";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

function mapAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

function mapAuthErrorMessage(error: unknown): string {
  if (!isFirebaseError(error)) {
    return error instanceof Error ? error.message : "Authentication failed.";
  }

  switch (error.code) {
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "auth/email-already-in-use":
      return "このメールアドレスは既に利用されています。";
    case "auth/weak-password":
      return "パスワードが弱すぎます。8文字以上を推奨します。";
    case "auth/popup-closed-by-user":
      return "Googleログインがキャンセルされました。";
    case "auth/popup-blocked":
      return "ポップアップがブロックされました。ブラウザ設定を確認してください。";
    default:
      return error.message;
  }
}

function toExpiresInSeconds(expirationTime?: string): number {
  if (!expirationTime) return 3600;
  const expiresAt = new Date(expirationTime).getTime();
  if (!Number.isFinite(expiresAt)) return 3600;
  const seconds = Math.floor((expiresAt - Date.now()) / 1000);
  return Math.max(60, seconds);
}

async function createSession(user: User): Promise<{
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}> {
  const tokenResult = await getIdTokenResult(user);
  return {
    accessToken: tokenResult.token,
    expiresIn: toExpiresInSeconds(tokenResult.expirationTime),
    user: mapAuthUser(user),
  };
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<{ accessToken: string; expiresIn: number; user: AuthUser }> {
  try {
    const credential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password,
    );
    return createSession(credential.user);
  } catch (error: unknown) {
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function signInWithGooglePopup(): Promise<{
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}> {
  try {
    const credential = await signInWithPopup(
      getFirebaseAuth(),
      getGoogleAuthProvider(),
    );
    return createSession(credential.user);
  } catch (error: unknown) {
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  emailRedirectTo?: string,
): Promise<{ accessToken: string | null; expiresIn: number | null; user: AuthUser | null }> {
  try {
    const credential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email,
      password,
    );

    if (emailRedirectTo) {
      await sendEmailVerification(credential.user, {
        url: emailRedirectTo,
        handleCodeInApp: false,
      }).catch(() => {
        // Continue even when email verification cannot be sent.
      });
    }

    const session = await createSession(credential.user);
    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      user: session.user,
    };
  } catch (error: unknown) {
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function getCurrentSession(): Promise<{
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
} | null> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return null;
  return createSession(user);
}

export function subscribeAuthUser(
  callback: (nextUser: AuthUser | null) => void,
): () => void {
  return onIdTokenChanged(getFirebaseAuth(), (nextUser) => {
    callback(nextUser ? mapAuthUser(nextUser) : null);
  });
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}
