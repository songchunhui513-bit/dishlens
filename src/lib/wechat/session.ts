import { createHmac, timingSafeEqual } from "node:crypto";

export interface WechatSessionPayload {
  sub: string;
  provider: "wechat";
  openid_hash: string;
  unionid_hash?: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signValue(value: string, secret: string): string {
  return base64UrlEncode(createHmac("sha256", secret).update(value).digest());
}

export function hashWechatIdentifier(value: string): string {
  return createHmac("sha256", "dishlens-wechat-public-id").update(value).digest("hex");
}

export function publicWechatUserId(openid: string): string {
  return `wx_${hashWechatIdentifier(openid).slice(0, 24)}`;
}

export function signWechatSession(payload: WechatSessionPayload, secret: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${signValue(unsigned, secret)}`;
}

export function verifyWechatSessionToken(token: string, secret: string): WechatSessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const unsigned = `${header}.${body}`;
  const expected = signValue(unsigned, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(body)) as WechatSessionPayload;
    if (payload.provider !== "wechat") return null;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readBearerToken(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
