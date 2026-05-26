#!/usr/bin/env node

/**
 * Diagnose which image layer a dish will use:
 * local_knowledge -> generated_local -> supabase_db -> ai_pending
 *
 * This intentionally mirrors the production order around matchDishKnowledgeImage()
 * and storageIdForGeneratedDishImage() without importing the Next/TS runtime.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DB_PATH = join(ROOT, "public", "dish-knowledge-db.json");
const GENERATED_DIR = join(ROOT, "public", "generated-dishes");

function normalizeDishLookupName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.·•]{2,}.*$/g, "")
    .replace(/[€$£¥₹]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?|usd|gbp|元|円|₹)/gi, " ")
    .replace(/[«»"“”'’`´.,;:!?()[\]{}+*/\\|_~^=<>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalDishNameKey(name) {
  return normalizeDishLookupName(name)
    .replace(/^(la|le|les|l|il|lo|gli|i|el|the)\s+/i, "")
    .replace(/\b(pizza|pasta|dish|plate|menu|meal)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function storageIdForGeneratedDishImage(name) {
  return `generated-${slug(canonicalDishNameKey(name) || name) || "dish"}`;
}

function dishNameLookupCandidates(name) {
  const normalized = normalizeDishLookupName(name);
  const canonical = canonicalDishNameKey(name);
  return Array.from(new Set([
    String(name || "").trim(),
    normalized,
    canonical,
    canonical ? `${canonical} pizza` : "",
    canonical ? `pizza ${canonical}` : "",
  ].filter(Boolean)));
}

function loadKnowledgeDb() {
  return JSON.parse(readFileSync(DB_PATH, "utf8"));
}

function isLocalKnowledgeEntry(entry) {
  return typeof entry.card === "string" &&
    entry.card.startsWith("/dishes/") &&
    typeof entry.hero === "string" &&
    entry.hero.startsWith("/dishes/") &&
    existsSync(join(ROOT, "public", entry.card));
}

function matchLocalKnowledge(db, name) {
  const candidates = new Set(dishNameLookupCandidates(name).map(canonicalDishNameKey));
  for (const entry of db) {
    if (!isLocalKnowledgeEntry(entry)) continue;
    const names = (entry.names || []).map(canonicalDishNameKey);
    if (names.some((entryName) => entryName && candidates.has(entryName))) return entry;
  }
  return null;
}

async function querySupabase(names) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Map();

  const candidates = Array.from(new Set(names.flatMap(dishNameLookupCandidates)));
  if (candidates.length === 0) return new Map();

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from("dishes")
    .select("name_original, ai_image_url, image_source")
    .in("name_original", candidates)
    .limit(500);
  if (error || !data) return new Map();

  return new Map(data.map((row) => [row.name_original, row]));
}

async function diagnoseName(db, supabaseRows, name) {
  const local = matchLocalKnowledge(db, name);
  if (local) {
    return { name, layer: "local_knowledge", id: local.id, url: local.card };
  }

  const storageId = storageIdForGeneratedDishImage(name);
  const generatedPath = join(GENERATED_DIR, `${storageId}.png`);
  if (existsSync(generatedPath)) {
    return { name, layer: "generated_local", id: storageId, url: `/generated-dishes/${storageId}.png` };
  }

  for (const candidate of dishNameLookupCandidates(name)) {
    const row = supabaseRows.get(candidate);
    if (row?.ai_image_url) {
      return { name, layer: "supabase_db", id: candidate, url: row.ai_image_url, image_source: row.image_source || null };
    }
  }

  return { name, layer: "ai_pending", id: storageId, url: null };
}

function summarizeKnowledge(db) {
  let localEntries = 0;
  let remoteEntries = 0;
  for (const entry of db) {
    if (isLocalKnowledgeEntry(entry)) localEntries++;
    else remoteEntries++;
  }
  return { total_entries: db.length, local_knowledge: localEntries, ai_pending_or_remote: remoteEntries };
}

const args = process.argv.slice(2);
const names = args.filter((arg) => !arg.startsWith("--"));
const db = loadKnowledgeDb();

if (args.includes("--summary") || names.length === 0) {
  console.log(JSON.stringify(summarizeKnowledge(db), null, 2));
}

if (names.length > 0) {
  const supabaseRows = await querySupabase(names);
  const rows = [];
  for (const name of names) rows.push(await diagnoseName(db, supabaseRows, name));
  console.log(JSON.stringify(rows, null, 2));
}
