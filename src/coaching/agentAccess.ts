import * as Crypto from 'expo-crypto';
import { supabase } from '../data/supabase';

export const coachingAgentEndpoint = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://aafxbjevyxrpgyxikxrg.supabase.co'}/functions/v1/coaching-agent`;

async function authenticatedUserId() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in before configuring an external coach.');
  return data.user.id;
}

export async function rotateCoachingAgentToken() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const ownerId = await authenticatedUserId();
  const bytes = await Crypto.getRandomBytesAsync(32);
  const token = `wpa_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  const tokenHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token);
  const timestamp = new Date().toISOString();
  const existing = await supabase.from('coaching_agent_credentials').select('owner_id').eq('owner_id', ownerId).maybeSingle();
  if (existing.error) throw existing.error;
  const result = existing.data
    ? await supabase.from('coaching_agent_credentials').update({ token_hash: tokenHash, updated_at: timestamp, revoked_at: null }).eq('owner_id', ownerId)
    : await supabase.from('coaching_agent_credentials').insert({ owner_id: ownerId, token_hash: tokenHash, created_at: timestamp, updated_at: timestamp, revoked_at: null });
  if (result.error) throw result.error;
  return token;
}

export async function revokeCoachingAgentToken() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const ownerId = await authenticatedUserId();
  const timestamp = new Date().toISOString();
  const { error } = await supabase.from('coaching_agent_credentials').update({ revoked_at: timestamp, updated_at: timestamp }).eq('owner_id', ownerId);
  if (error) throw error;
}
