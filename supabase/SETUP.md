# Supabase Setup (DB + Auth + Permissions + API)

## 1. Environment Variables

Set these in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_AUTH_REDIRECT_TO=http://localhost:3000/login
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_ITEMS_TABLE=items
```

## 2. Database + Permissions (RLS)

Run [items.sql](/c:/Users/kisuk/dev/frima-ai-app2/supabase/items.sql) in Supabase SQL Editor.

This creates:

1. `public.items` table
2. index on `(uid, created_at desc)`
3. RLS policies for `authenticated` users only
4. owner-only access (`uid = auth.uid()`)

## 3. Authentication

In Supabase Dashboard:

1. Go to `Authentication > Providers`
2. Enable `Email` (and `Google` if needed)
3. Go to `Authentication > Sign In / Providers > Email` and enable email confirmation (confirm email)
4. In `Authentication > URL Configuration`, set:
   - Site URL: your actual app URL
   - Redirect URLs:
     - `http://localhost:3000/login` (PC local)
     - `http://<your-pc-lan-ip>:3000/login` (mobile on same Wi-Fi)
     - `https://your-domain/login` (production)
5. If mobile still fails, open in Safari/Chrome directly (not in-app browser).

## 4. API

No custom backend is required for `items`.
This app uses Supabase PostgREST directly:

1. Endpoint: `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/items`
2. Auth: `Authorization: Bearer <user_access_token>`
3. RLS enforces per-user access automatically

## 5. Current App Behavior

1. Sign-in uses Supabase Auth (`/auth/v1/*`)
2. Access token is stored in cookie `auth-token`
3. `src/lib/firestore.ts` sends the user token to Supabase REST API
4. If token is missing, DB requests fail with auth-required error
