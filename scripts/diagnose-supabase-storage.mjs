#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

async function readLocalEnvFile() {
  try {
    const raw = await readFile(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Optional convenience for local diagnostics.
  }
}

await readLocalEnvFile();

const BUCKET = process.env.DISH_IMAGE_BUCKET || "dishes";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const TEST_WEBP_BASE64 = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=";

function redact(value) {
  if (!value) return "";
  if (value.length <= 10) return "***";
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

function check(ok, message, extra = {}) {
  return { ok, message, ...extra };
}

function isPrivateOrReservedIp(address) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

async function diagnoseNetwork(supabaseUrl) {
  let hostname = "";
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    return check(false, "Supabase URL is not a valid URL", { supabase_url: redact(supabaseUrl) });
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    const reservedAddresses = addresses
      .map((item) => item.address)
      .filter((address) => isPrivateOrReservedIp(address));
    const ok = addresses.length > 0 && reservedAddresses.length === 0;
    return check(ok, ok ? "Supabase host resolves to public addresses" : "Supabase host resolves to private/reserved addresses; check VPN/proxy/DNS routing", {
      hostname,
      addresses: addresses.map((item) => `${item.address}/${item.family}`),
      reserved_addresses: reservedAddresses,
    });
  } catch (error) {
    return check(false, "Supabase host DNS lookup failed", {
      hostname,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const objectPath = `_diagnostics/dishlens-storage-${Date.now()}.webp`;
  const report = {
    ok: false,
    bucket: BUCKET,
    started_at: startedAt,
    checks: {
      config: check(false, "Not checked"),
      network: check(false, "Not checked"),
      bucket: check(false, "Not checked"),
      upload: check(false, "Not checked"),
      public_url: check(false, "Not checked"),
      cleanup: check(false, "Not checked"),
    },
  };

  if (!SUPABASE_URL || !SERVICE_KEY) {
    report.checks.config = check(
      false,
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY for server-side Storage upload.",
      {
        supabase_url_present: Boolean(SUPABASE_URL),
        service_key_present: Boolean(SERVICE_KEY),
      },
    );
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  report.checks.config = check(true, "Supabase admin config present", {
    supabase_url: redact(SUPABASE_URL),
    service_key_present: Boolean(SERVICE_KEY),
  });

  report.checks.network = await diagnoseNetwork(SUPABASE_URL);
  if (!report.checks.network.ok) {
    report.checks.bucket = check(false, "Not checked because network diagnostics failed");
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const client = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: buckets, error } = await client.storage.listBuckets();
    if (error) throw error;
    const bucket = (buckets || []).find((item) => item.name === BUCKET);
    report.checks.bucket = check(Boolean(bucket), bucket ? "Bucket is accessible" : `Bucket '${BUCKET}' was not found`, {
      public: bucket?.public ?? null,
    });
    if (!bucket) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
  } catch (error) {
    report.checks.bucket = check(false, "Bucket lookup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  try {
    const bytes = Buffer.from(TEST_WEBP_BASE64, "base64");
    const { error } = await client.storage.from(BUCKET).upload(objectPath, bytes, {
      contentType: "image/webp",
      upsert: true,
    });
    if (error) throw error;
    report.checks.upload = check(true, "Upload/upsert succeeded", { object_path: objectPath });
  } catch (error) {
    report.checks.upload = check(false, "Upload/upsert failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  try {
    const { data } = client.storage.from(BUCKET).getPublicUrl(objectPath);
    const publicUrl = data?.publicUrl || "";
    let httpStatus = 0;
    if (publicUrl) {
      const res = await fetch(publicUrl, { method: "HEAD" });
      httpStatus = res.status;
    }
    report.checks.public_url = check(Boolean(publicUrl) && httpStatus >= 200 && httpStatus < 400, "Public URL HEAD check finished", {
      public_url: publicUrl,
      http_status: httpStatus,
    });
  } catch (error) {
    report.checks.public_url = check(false, "Public URL check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const { error } = await client.storage.from(BUCKET).remove([objectPath]);
    if (error) throw error;
    report.checks.cleanup = check(true, "Diagnostic object removed");
  } catch (error) {
    report.checks.cleanup = check(false, "Cleanup failed; remove the diagnostic object manually", {
      object_path: objectPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  report.ok = Object.values(report.checks).every((item) => item.ok);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    bucket: BUCKET,
    checks: {
      fatal: check(false, "Storage diagnostics crashed", {
        error: error instanceof Error ? error.message : String(error),
      }),
    },
  }, null, 2));
  process.exitCode = 1;
});
