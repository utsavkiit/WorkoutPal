import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';
import * as Linking from 'expo-linking';
import { createClient, Session } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key && !url.includes('your-project'));
export const supabase = isSupabaseConfigured ? createClient(url!, key!, {
  auth: { storage: globalThis.localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
}) : null;

export const magicLinkRedirect = Linking.createURL('auth/callback');
console.log('[debug] magicLinkRedirect =', JSON.stringify(magicLinkRedirect));

export async function sendMagicLink(email: string) {
  if (!supabase) throw new Error('Add Supabase credentials to .env first.');
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: magicLinkRedirect } });
  if (error) throw error;
}

export async function handleAuthUrl(urlToHandle: string) {
  if (!supabase) return;
  const parsed = Linking.parse(urlToHandle.replace('#', '?'));
  const params = parsed.queryParams ?? {};
  const accessToken = typeof params.access_token === 'string' ? params.access_token : undefined;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : undefined;
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
    return;
  }
  // PKCE links contain a code and are exchanged by the auth client.
  if (typeof params.code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
  }
}

export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
