import { NextRequest, NextResponse } from "next/server";
import {
  hashWechatIdentifier,
  publicWechatUserId,
  signWechatSession,
} from "@/lib/wechat/session";

interface Code2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json({ error: "Missing wx.login code" }, { status: 400 });
  }

  const appid = process.env.WECHAT_MINIPROGRAM_APPID;
  const secret = process.env.WECHAT_MINIPROGRAM_SECRET;
  const sessionSecret = process.env.WECHAT_SESSION_JWT_SECRET;

  if (!appid || !secret || !sessionSecret) {
    return NextResponse.json(
      { error: "WeChat mini program login is not configured" },
      { status: 503 },
    );
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return NextResponse.json({ error: "WeChat login service unavailable" }, { status: 502 });
  }

  const data = (await response.json()) as Code2SessionResponse;
  if (data.errcode || !data.openid) {
    return NextResponse.json(
      { error: data.errmsg || "Invalid WeChat login code" },
      { status: 401 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const userId = publicWechatUserId(data.openid);
  const token = signWechatSession(
    {
      sub: userId,
      provider: "wechat",
      openid_hash: hashWechatIdentifier(data.openid),
      unionid_hash: data.unionid ? hashWechatIdentifier(data.unionid) : undefined,
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    },
    sessionSecret,
  );

  return NextResponse.json({
    token,
    expires_in: SESSION_TTL_SECONDS,
    user: {
      id: userId,
      provider: "wechat",
      has_profile: false,
    },
  });
}
