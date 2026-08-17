const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function normalizeLogin(login) {
  return String(login ?? '').trim().toLowerCase();
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(blob) {
  const binary = atob(blob);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function fingerprintAesKey(fingerprintString, usage) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(fingerprintString)
  );
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, usage);
}

export async function hmacLogin(login, password) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(normalizeLogin(login))
  );
  return toHex(signature);
}

export async function wrapPassword(password, fingerprintString) {
  const key = await fingerprintAesKey(fingerprintString, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(password)
  );
  const packed = new Uint8Array(iv.length + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64(packed);
}

export async function unwrapPassword(blob, fingerprintString) {
  const packed = base64ToBytes(blob);
  if (packed.byteLength <= 12) {
    throw new Error('Некорректный секрет сессии');
  }
  const iv = packed.slice(0, 12);
  const data = packed.slice(12);
  const key = await fingerprintAesKey(fingerprintString, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  return decoder.decode(plaintext);
}
