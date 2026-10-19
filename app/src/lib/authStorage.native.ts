import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase keeps its sign-in session in the iOS Keychain or Android Keystore (plan/15), never in
 * plain files. A session can exceed SecureStore's per-item size, so it is stored in chunks.
 */
const CHUNK = 1800;
const base = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

async function count(key: string): Promise<number> {
  return Number(await SecureStore.getItemAsync(`${base(key)}.n`)) || 0;
}

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = await count(key);
    if (!n) return null;
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${base(key)}.${i}`);
      if (part === null) return null;
      out += part;
    }
    return out;
  },
  async setItem(key: string, value: string): Promise<void> {
    const old = await count(key);
    const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [''];
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(`${base(key)}.${i}`, parts[i]!);
    await SecureStore.setItemAsync(`${base(key)}.n`, String(parts.length));
    for (let i = parts.length; i < old; i++) await SecureStore.deleteItemAsync(`${base(key)}.${i}`);
  },
  async removeItem(key: string): Promise<void> {
    const n = await count(key);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${base(key)}.${i}`);
    await SecureStore.deleteItemAsync(`${base(key)}.n`);
  },
};
