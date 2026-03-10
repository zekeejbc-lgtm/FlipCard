const SECURE_SESSION_KEY = 'cumlaude_secure_session_key';
const SECURE_LOCAL_KEY = 'cumlaude_secure_local_key';
const SECURE_SESSION_PREFIX = 'cumlaude_secure_';
const SECURE_LOCAL_PREFIX = 'cumlaude_secure_local_';

type SecureEnvelope = {
  v: 1;
  iv: string;
  data: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getSecureCryptoKey(storage: Storage, keyName: string) {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;

  let encodedKey = storage.getItem(keyName);
  if (!encodedKey) {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    encodedKey = bytesToBase64(rawKey);
    storage.setItem(keyName, encodedKey);
  }

  return crypto.subtle.importKey(
    'raw',
    base64ToBytes(encodedKey),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function setSecureItem(storage: Storage, prefix: string, cryptoKeyName: string, itemKey: string, value: unknown) {
  try {
    const cryptoKey = await getSecureCryptoKey(storage, cryptoKeyName);
    if (!cryptoKey) {
      storage.setItem(`${prefix}${itemKey}`, JSON.stringify(value));
      return;
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const payload = new TextEncoder().encode(JSON.stringify(value));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, payload);
    const envelope: SecureEnvelope = {
      v: 1,
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(encrypted))
    };

    storage.setItem(`${prefix}${itemKey}`, JSON.stringify(envelope));
  } catch (error) {
    console.warn('Failed to write secure storage item:', error);
  }
}

async function getSecureItem<T>(storage: Storage, prefix: string, cryptoKeyName: string, itemKey: string): Promise<T | null> {
  const raw = storage.getItem(`${prefix}${itemKey}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.iv || !parsed?.data) {
      return parsed as T;
    }

    const cryptoKey = await getSecureCryptoKey(storage, cryptoKeyName);
    if (!cryptoKey) return null;

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(parsed.iv) },
      cryptoKey,
      base64ToBytes(parsed.data)
    );

    return JSON.parse(new TextDecoder().decode(decrypted)) as T;
  } catch (error) {
    console.warn('Failed to read secure storage item:', error);
    storage.removeItem(`${prefix}${itemKey}`);
    return null;
  }
}

export async function setSecureSessionItem(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  await setSecureItem(sessionStorage, SECURE_SESSION_PREFIX, SECURE_SESSION_KEY, key, value);
}

export async function getSecureSessionItem<T>(key: string) {
  if (typeof window === 'undefined') return null;
  return getSecureItem<T>(sessionStorage, SECURE_SESSION_PREFIX, SECURE_SESSION_KEY, key);
}

export async function setSecureLocalItem(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  await setSecureItem(localStorage, SECURE_LOCAL_PREFIX, SECURE_LOCAL_KEY, key, value);
}

export async function getSecureLocalItem<T>(key: string) {
  if (typeof window === 'undefined') return null;
  return getSecureItem<T>(localStorage, SECURE_LOCAL_PREFIX, SECURE_LOCAL_KEY, key);
}
