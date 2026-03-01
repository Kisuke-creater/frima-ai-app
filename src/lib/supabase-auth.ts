export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthErrorBody {
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
}

interface AuthSessionResponse {
  access_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
    };
  };
}

interface AuthConfig {
  url: string;
  anonKey: string;
}

function getAuthConfig(): AuthConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return { url, anonKey };
}

export function buildGoogleOAuthUrl(redirectTo: string): string {
  const { url, anonKey } = getAuthConfig();
  const configuredRedirectTo = process.env.NEXT_PUBLIC_AUTH_REDIRECT_TO;
  const resolvedRedirectTo = configuredRedirectTo?.trim() || redirectTo;
  const params = new URLSearchParams({
    provider: "google",
    redirect_to: resolvedRedirectTo,
    flow_type: "implicit",
  });

  return `${url}/auth/v1/authorize?${params.toString()}&apikey=${encodeURIComponent(
    anonKey
  )}`;
}

async function parseError(response: Response): Promise<string> {
  const body = (await response
    .json()
    .catch(() => null)) as AuthErrorBody | null;
  return (
    body?.error_description ||
    body?.msg ||
    body?.message ||
    body?.error ||
    `Request failed (${response.status})`
  );
}

function mapAuthUser(user: AuthSessionResponse["user"]): AuthUser {
  return {
    uid: user?.id ?? "",
    email: user?.email ?? null,
    displayName: user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null,
  };
}

export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<{ accessToken: string; expiresIn: number; user: AuthUser }> {
  const { url, anonKey } = getAuthConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as AuthSessionResponse;
  if (!data.access_token || !data.expires_in || !data.user?.id) {
    throw new Error("Sign-in response is missing required fields.");
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    user: mapAuthUser(data.user),
  };
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  emailRedirectTo?: string
): Promise<{ accessToken: string | null; expiresIn: number | null; user: AuthUser | null }> {
  const { url, anonKey } = getAuthConfig();
  const payload: Record<string, unknown> = { email, password };
  if (emailRedirectTo) {
    payload.email_redirect_to = emailRedirectTo;
  }

  const headers: Record<string, string> = {
    apikey: anonKey,
    "Content-Type": "application/json",
  };
  if (emailRedirectTo) {
    headers.redirect_to = emailRedirectTo;
  }

  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as AuthSessionResponse;
  return {
    accessToken: data.access_token ?? null,
    expiresIn: data.expires_in ?? null,
    user: data.user?.id ? mapAuthUser(data.user) : null,
  };
}

export async function getUserFromAccessToken(
  accessToken: string
): Promise<AuthUser> {
  const { url, anonKey } = getAuthConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    id?: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
    };
  };

  if (!data.id) {
    throw new Error("Authenticated user ID was not returned.");
  }

  return {
    uid: data.id,
    email: data.email ?? null,
    displayName: data.user_metadata?.full_name ?? data.user_metadata?.name ?? null,
  };
}

export async function signOutWithAccessToken(
  accessToken: string
): Promise<void> {
  const { url, anonKey } = getAuthConfig();
  await fetch(`${url}/auth/v1/logout`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
