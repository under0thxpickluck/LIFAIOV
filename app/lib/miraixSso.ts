// app/lib/miraixSso.ts — MIRAIX SSOトークン署名（poripori 側 verifySsoToken と形式互換）
// HMAC-SHA256 / base64url。ペイロードとエンコーディングを変えるときは両側同時に変えること。
export type SsoPayload = {
  gasGroup: '' | '5000'
  loginId: string
  email?: string
  iat: number
  exp: number
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

export async function signSsoToken(secret: string, payload: SsoPayload): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return `${body}.${b64url(new Uint8Array(sig))}`
}
