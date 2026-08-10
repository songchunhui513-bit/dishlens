#!/usr/bin/env node

/**
 * Build a prioritized backfill plan for knowledge-base dish images.
 *
 * Pollinations URLs are not reliable enough for a 600+ image backfill. This
 * script ranks remote-image dishes so a stable generator can produce the next
 * local batch first: user-seen dishes, common menu staples, and categories that
 * often look wrong or load slowly when generated on demand.
 *
 * Usage:
 *   node scripts/plan-knowledge-image-backfill.mjs --limit=50
 *   node scripts/plan-knowledge-image-backfill.mjs --format=ids --limit=20
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const KNOWLEDGE_PATH = join(ROOT, "public", "dish-knowledge-db.json");
const GENERATED_INDEX_PATH = join(ROOT, "public", "generated-dish-local-index.json");
const TASK_CACHE_DIR = join(ROOT, ".cache", "tasks");

const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const formatArg = args.find((arg) => arg.startsWith("--format="));
const LIMIT = Number.parseInt(limitArg?.split("=")[1] || "50", 10) || 50;
const FORMAT = formatArg?.split("=")[1] || "json";

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[€$£¥₹]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?|usd|gbp|元|円|₹)/gi, " ")
    .replace(/[«»"“”'’`´.,;:!?()[\]{}+*/\\|_~^=<>-]/g, " ")
    .replace(/\b(?:la|le|les|l|il|lo|gli|i|el|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableHash(value) {
  let hash = 0;
  for (const char of String(value || "")) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function safeLocalDishFilename(value) {
  const slug = normalizeName(value)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || `dish-${stableHash(value)}`}.webp`;
}

function localDishImagePath(entry) {
  return `/dishes/${safeLocalDishFilename(entry.id)}`;
}

function localized(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.zh || value.en || Object.values(value)[0] || "";
}

function collectDishes(result) {
  if (!result || !Array.isArray(result.pages)) return [];
  return result.pages.flatMap((page) => Array.isArray(page?.dishes) ? page.dishes : []);
}

function loadTaskMentionCounts() {
  const counts = new Map();
  if (!existsSync(TASK_CACHE_DIR)) return counts;

  for (const file of readdirSync(TASK_CACHE_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(TASK_CACHE_DIR, file), "utf8"));
      const result = parsed?.task?.result || parsed?.result;
      for (const dish of collectDishes(result)) {
        const keys = [
          dish?.name_original,
          localized(dish?.name_translated),
        ].map(normalizeName).filter(Boolean);
        for (const key of new Set(keys)) counts.set(key, (counts.get(key) || 0) + 1);
      }
    } catch {
      continue;
    }
  }

  return counts;
}

function isRemoteImage(entry) {
  return String(entry.card || "").includes("pollinations.ai") ||
    String(entry.hero || "").includes("pollinations.ai");
}

function isLocalImage(entry) {
  return String(entry.card || "").startsWith("/dishes/") &&
    String(entry.hero || "").startsWith("/dishes/");
}

function normalizedEntryNames(entry) {
  return new Set([entry.id, ...(entry.names || [])].map(normalizeName).filter(Boolean));
}

function hasEquivalentLocalImage(entry, localImageEntries) {
  const names = normalizedEntryNames(entry);
  if (names.size === 0) return false;
  return localImageEntries.some((localEntry) => {
    if (localEntry.id === entry.id) return false;
    for (const localName of normalizedEntryNames(localEntry)) {
      if (names.has(localName)) return true;
    }
    return false;
  });
}

function hasEquivalentPlannedImage(entry, plannedEntries) {
  const names = normalizedEntryNames(entry);
  if (names.size === 0) return false;
  return plannedEntries.some((plannedEntry) => {
    for (const plannedName of normalizedEntryNames(plannedEntry)) {
      if (names.has(plannedName)) return true;
    }
    return false;
  });
}

function loadGeneratedIndexIds() {
  if (!existsSync(GENERATED_INDEX_PATH)) return new Set();
  try {
    const index = JSON.parse(readFileSync(GENERATED_INDEX_PATH, "utf8"));
    return new Set(index.map((entry) => String(entry.id || "").replace(/^local-/, "")));
  } catch {
    return new Set();
  }
}

function categoryWeight(entry) {
  const text = [entry.category, ...(entry.names || []), entry.description?.en, entry.description?.zh]
    .join(" ")
    .toLowerCase();
  if (/drink|coffee|tea|lassi|smoothie|juice|beverage|饮/.test(text)) return 34;
  if (/soup|broth|stew|pho|ramen|汤/.test(text)) return 32;
  if (/pizza|burger|sandwich|wrap|meal|combo/.test(text)) return 30;
  if (/seafood|fish|shrimp|prawn|crab|oyster|scallop|clam|鱼|虾|蟹|蚝|贝/.test(text)) return 28;
  if (/dessert|cake|pudding|ice cream|gelato|sweet|甜/.test(text)) return 22;
  if (/noodle|rice|pasta|面|饭|粉/.test(text)) return 20;
  return 16;
}

function commonStapleWeight(entry) {
  const text = (entry.names || []).join(" ").toLowerCase();
  if (/\b(?:naan|garlic naan|pho|ramen|tikka masala|biryani|pad thai|mango lassi|masala chai|tiramisu|carbonara|margherita|burger|sandwich)\b/.test(text)) {
    return 25;
  }
  return 0;
}

function mentionCountForEntry(entry, counts) {
  let total = 0;
  for (const name of entry.names || []) total += counts.get(normalizeName(name)) || 0;
  return total;
}

const db = JSON.parse(readFileSync(KNOWLEDGE_PATH, "utf8"));
const taskMentionCounts = loadTaskMentionCounts();
const generatedIndexIds = loadGeneratedIndexIds();
const localImageEntries = db.filter(isLocalImage);

const rankedRemoteEntries = db
  .filter((entry) =>
    !isLocalImage(entry) &&
    isRemoteImage(entry) &&
    !generatedIndexIds.has(entry.id) &&
    !hasEquivalentLocalImage(entry, localImageEntries))
  .map((entry) => {
    const task_mentions = mentionCountForEntry(entry, taskMentionCounts);
    const score =
      task_mentions * 100 +
      commonStapleWeight(entry) +
      categoryWeight(entry);
    return {
      id: entry.id,
      names: entry.names || [],
      cuisine: entry.cuisine || "",
      category: entry.category || "",
      task_mentions,
      priority_score: score,
      recommended_source: "generate_with_stable_model",
      output_path: localDishImagePath(entry),
    };
  })
  .sort((a, b) => b.priority_score - a.priority_score || a.id.localeCompare(b.id));

const candidates = [];
for (const entry of rankedRemoteEntries) {
  if (hasEquivalentPlannedImage(entry, candidates)) continue;
  candidates.push(entry);
  if (candidates.length >= Math.max(1, LIMIT)) break;
}

if (FORMAT === "ids") {
  console.log(candidates.map((entry) => entry.id).join(","));
} else {
  console.log(JSON.stringify({
    total_remote_candidates: db.filter((entry) => !isLocalImage(entry) && isRemoteImage(entry)).length,
    generated_cache_entries: generatedIndexIds.size,
    returned: candidates.length,
    candidates,
  }, null, 2));
}
