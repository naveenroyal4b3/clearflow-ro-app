import * as Crypto from 'expo-crypto';
import { GoogleOneTapSignIn, isNoSavedCredentialFoundResponse, isSuccessResponse } from 'react-native-nitro-google-signin';
import { supabase } from './supabase';

export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

// Google's account picker (Credential Manager) returns an ID token that Supabase verifies. Google
// gets the SHA-256 of a one-time nonce and Supabase the nonce itself, which ties the token to this
// attempt. Returns null when the user closes the picker.
export async function signInWithGoogle() {
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  GoogleOneTapSignIn.configure({ webClientId: googleWebClientId, nonce: hashedNonce });
  await GoogleOneTapSignIn.checkPlayServices();
  let response = await GoogleOneTapSignIn.signIn();
  if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.createAccount();
  if (isNoSavedCredentialFoundResponse(response)) response = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (!isSuccessResponse(response)) return null;
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: response.data.idToken, nonce: rawNonce });
  if (error) throw error;
  return data.session;
}
