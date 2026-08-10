#!/usr/bin/env node

/**
 * Promote trustworthy runtime-generated dish images into the local static dish
 * library. This is the offline-safe path for speed: local images work even when
 * Supabase, Wan, or Pollinations are unavailable.
 *
 * Default mode is a dry run. Use --apply to write public/dishes/generated-cache
 * images and public/generated-dish-local-index.json. Use --reviewed-ids=...
 * only after a manual contact-sheet review of unmapped named candidates.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import sharp from "sharp";

const ROOT = join(import.meta.dirname, "..");
const GENERATED_DIR = join(ROOT, "public", "generated-dishes");
const PROMOTED_DIR = join(ROOT, "public", "dishes", "generated-cache");
const INDEX_PATH = join(ROOT, "public", "generated-dish-local-index.json");
const DB_PATH = join(ROOT, "public", "dish-knowledge-db.json");
const TASK_CACHE_DIR = join(ROOT, ".cache", "tasks");
const MAX_DIM = Number.parseInt(process.env.PROMOTED_DISH_MAX_DIM || "768", 10) || 768;
const WEBP_QUALITY = Number.parseInt(process.env.PROMOTED_DISH_WEBP_QUALITY || "82", 10) || 82;
const PROMOTION_BLOCKLIST = new Set([
  // Visual audit: this generated asset looks like a pizza, not a prosciutto plate.
  "generated-prosciutto-gfo-df",
  // Visual audit: this looks like an apple cocktail, not apple sorbet with Calvados.
  "generated-pommeau-glace",
  // Duplicate OCR variants already covered by canonical promoted cache entries.
  "generated-angelochu-anchovy",
  "generated-miso-chickpea-v-l",
  "generated-albacore-tuna-lof",
  "generated-caesar",
  "generated-capriccioza",
  "generated-heirloom-tomato-lvg",
  // Visual audit: the generated image is a dark sauce/dessert cup, not beef steak.
  "generated-beef-steak",
  // Visual audit: brand/signature labels are too menu-specific for global reuse.
  "generated-borgo-signature",
  "generated-la-burrata-du-moment-l-inspiration-du-chef-mauro",
  "generated-long-paddock-driftwood-lgeo",
  // Visual audit: seafood platter image with an unusably generic OCR/storage label.
  "generated-bottle",
  // Visual audit: generic stuffed bread roll, unsafe as a global dish image.
  "generated-bread-roll",
  // Visual audit: looks like cheese toast rather than clear cheesy garlic bread.
  "generated-cheesy-garlic-bread",
  // Visual audit: looks like a roasted chicken leg, not chicken piccata.
  "generated-chicken-piccata",
  // Visual audit: generic section labels must not become global dish images.
  "generated-dessert",
  "generated-desserts",
  "generated-drinks",
  "generated-main-course",
  "generated-main-courses",
  // Visual audit: ambiguous marinara image looks like seafood pasta and could steal pizza/sauce matches.
  "generated-marinara",
]);
const PROMOTION_NAME_BLOCKLIST = new Set([
  // These labels only make sense inside their original section. Promoting them
  // globally would make dishes like "vegan burger" match a porridge image.
  "plain",
  "vegan",
  "overnight",
]);

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERBOSE = args.includes("--verbose");
const UNSTABLE_REPORT = args.includes("--unstable-report");
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const idsArg = args.find((arg) => arg.startsWith("--ids="));
const reviewedIdsArg = args.find((arg) => arg.startsWith("--reviewed-ids="));
const contactSheetArg = args.find((arg) => arg.startsWith("--contact-sheet="));
const CONTACT_SHEET_PATH = contactSheetArg?.split("=").slice(1).join("=") || "";
const LIMIT = Number.parseInt(limitArg?.split("=")[1] || "0", 10) || 0;
const TARGET_IDS = new Set(
  (idsArg?.split("=")[1] || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
const REVIEWED_IDS = new Set(
  (reviewedIdsArg?.split("=")[1] || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

function fileStorageId(file) {
  return basename(file, extname(file));
}

function isGeneratedImageFile(file) {
  return /\.(webp|png|jpe?g)$/i.test(file);
}

function listGeneratedImageFiles() {
  if (!existsSync(GENERATED_DIR)) return [];
  return readdirSync(GENERATED_DIR)
    .filter(isGeneratedImageFile)
    .sort((a, b) => a.localeCompare(b));
}

function normalizePublicGeneratedUrl(value) {
  if (typeof value !== "string") return "";
  try {
    const parsed = value.startsWith("http") ? new URL(value) : null;
    return parsed?.pathname || value;
  } catch {
    return value;
  }
}

function localizedName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.en || value.zh || Object.values(value)[0] || "";
}

function normalizedPromotionName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[€$£¥₹]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?|usd|gbp|元|円|₹)/gi, " ")
    .replace(/[«»"“”'’`´.,;:!?()[\]{}+*/\\|_~^=<>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugForKnowledgeMatch(value) {
  return normalizedPromotionName(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferredNameKeyFromStorageId(storageId) {
  if (!storageId.startsWith("generated-")) return "";
  const key = storageId.slice("generated-".length);
  if (!key || /^dish-[a-z0-9]+$/i.test(key)) return "";
  return key;
}

function isGenericPromotionName(item) {
  const originalName = normalizedPromotionName(item.name_original);
  if (PROMOTION_NAME_BLOCKLIST.has(originalName)) return true;

  const translatedName = normalizedPromotionName(item.name_translated);
  return !originalName && PROMOTION_NAME_BLOCKLIST.has(translatedName);
}

function loadKnowledgeDb() {
  try {
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isLocalKnowledgeEntry(entry) {
  return typeof entry?.card === "string" &&
    entry.card.startsWith("/dishes/") &&
    existsSync(join(ROOT, "public", entry.card));
}

function buildKnowledgeMatchMap(db) {
  const map = new Map();
  for (const entry of db) {
    const keys = new Set([
      entry.id,
      ...(Array.isArray(entry.names) ? entry.names : []),
    ].map(slugForKnowledgeMatch).filter(Boolean));
    for (const key of keys) {
      if (!map.has(key)) map.set(key, entry);
    }
  }
  return map;
}

function collectDishes(result) {
  if (!result || !Array.isArray(result.pages)) return [];
  return result.pages.flatMap((page) => Array.isArray(page?.dishes) ? page.dishes : []);
}

function collectTaskCacheDishMap() {
  const map = new Map();
  if (!existsSync(TASK_CACHE_DIR)) return map;

  for (const file of readdirSync(TASK_CACHE_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(TASK_CACHE_DIR, file), "utf8"));
      const result = parsed?.task?.result || parsed?.result;
      for (const dish of collectDishes(result)) {
        const url = normalizePublicGeneratedUrl(dish?.ai_image_url || dish?.image_url);
        const match = url.match(/\/generated-dishes\/([^/?#]+\.(?:webp|png|jpe?g))/i);
        if (!match) continue;
        const storageId = fileStorageId(match[1]);
        if (!storageId || map.has(storageId)) continue;
        map.set(storageId, {
          storageId,
          name_original: String(dish.name_original || "").trim(),
          name_translated: localizedName(dish.name_translated).trim(),
          category: dish.category || "main",
        });
      }
    } catch {
      continue;
    }
  }

  return map;
}

function generatedFileForStorageId(storageId) {
  for (const ext of ["webp", "png", "jpg", "jpeg"]) {
    const file = `${storageId}.${ext}`;
    if (existsSync(join(GENERATED_DIR, file))) return file;
  }
  return "";
}

async function readIndex() {
  try {
    const parsed = JSON.parse(await readFile(INDEX_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function optimizeToPromotedWebp(sourcePath, outputPath) {
  const buffer = await readFile(sourcePath);
  const optimized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_DIM,
      height: MAX_DIM,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();
  await writeFile(outputPath, optimized);
  return optimized.length;
}

function indexEntryFor(item) {
  const publicPath = `/dishes/generated-cache/${item.storageId}.webp`;
  const names = Array.from(new Set([
    item.name_original,
    item.name_translated,
  ].filter(Boolean)));
  return {
    id: `local-${item.storageId}`,
    names,
    category: item.category || "main",
    card: publicPath,
    hero: publicPath,
    source: "task_cache_generated",
  };
}

function categoryForPromotionName(value) {
  const name = normalizedPromotionName(value);
  if (/coffee|espresso|latte|tea|cappuccino|infusion|juice|drink|beer|wine|cocktail/.test(name)) return "drink";
  if (/soup|broth|bisque|consomme/.test(name)) return "soup";
  if (/cake|dessert|nutella|pudding|mochi|ice|tiramisu|chocolate|sweet|fritter|porridge/.test(name)) return "dessert";
  if (/salmon|calamari|prawn|shrimp|scallop|oyster|tuna|fish|seafood/.test(name)) return "seafood";
  if (/pizza|pepperoni|pugliese|sicilian|neapolitan/.test(name)) return "pizza";
  if (/pasta|pappardelle|papalina|funghetto|spaghetti|tagliatelle|rigatoni/.test(name)) return "pasta";
  if (/vegetable|salad|baby vegetables|greens/.test(name)) return "vegetable";
  if (/lamb|chicken|rib eye|kangaroo|steak|breast|mortadella|bologne/.test(name)) return "meat";
  return "main";
}

function buildPromotionAudit(generatedFiles, taskMap, existingById, knowledgeMap) {
  const audit = {
    total_generated_files: generatedFiles.length,
    task_cache_mapped_images: taskMap.size,
    generated_files_with_task_cache: 0,
    already_indexed: 0,
    already_promoted_source_files: 0,
    review_ready_mapped: 0,
    skipped_generic_name: 0,
    blocked_by_id: 0,
    unmapped_generated_files: 0,
    unmapped_remote_knowledge_matches: 0,
    unmapped_local_knowledge_duplicates: 0,
    unmapped_hashed_storage_ids: 0,
    next_action_for_review_ready: "manual_visual_review_then_run_with_apply",
    next_action_for_unmapped: "recover_task_cache_evidence_before_promoting",
    next_action_for_unmapped_knowledge_matches: "manual_visual_review_then_promote_to_knowledge_or_delete_duplicate",
    samples: {
      review_ready_mapped: [],
      unmapped_generated_files: [],
      unmapped_remote_knowledge_matches: [],
      unmapped_local_knowledge_duplicates: [],
      unmapped_hashed_storage_ids: [],
      blocked_by_id: [],
      skipped_generic_name: [],
    },
  };

  for (const file of generatedFiles) {
    const storageId = fileStorageId(file);
    const item = taskMap.get(storageId);
    const entryId = `local-${storageId}`;
    const promotedPath = join(PROMOTED_DIR, `${storageId}.webp`);
    const alreadyIndexed = existingById.has(entryId) && existsSync(promotedPath);

    if (alreadyIndexed) {
      audit.already_indexed++;
      audit.already_promoted_source_files++;
      continue;
    }

    if (PROMOTION_BLOCKLIST.has(storageId)) {
      audit.blocked_by_id++;
      if (audit.samples.blocked_by_id.length < 8) audit.samples.blocked_by_id.push(storageId);
      continue;
    }

    if (!item) {
      audit.unmapped_generated_files++;
      const inferredKey = inferredNameKeyFromStorageId(storageId);
      if (!inferredKey) {
        audit.unmapped_hashed_storage_ids++;
        if (audit.samples.unmapped_hashed_storage_ids.length < 8) audit.samples.unmapped_hashed_storage_ids.push(storageId);
      } else {
        const knowledgeEntry = knowledgeMap.get(slugForKnowledgeMatch(inferredKey));
        if (knowledgeEntry) {
          const sample = {
            storage_id: storageId,
            inferred_key: inferredKey,
            knowledge_id: knowledgeEntry.id,
          };
          if (isLocalKnowledgeEntry(knowledgeEntry)) {
            audit.unmapped_local_knowledge_duplicates++;
            if (audit.samples.unmapped_local_knowledge_duplicates.length < 8) {
              audit.samples.unmapped_local_knowledge_duplicates.push(sample);
            }
          } else {
            audit.unmapped_remote_knowledge_matches++;
            if (audit.samples.unmapped_remote_knowledge_matches.length < 8) {
              audit.samples.unmapped_remote_knowledge_matches.push(sample);
            }
          }
        }
      }
      if (audit.samples.unmapped_generated_files.length < 8) audit.samples.unmapped_generated_files.push(storageId);
      continue;
    }

    audit.generated_files_with_task_cache++;

    if (isGenericPromotionName(item)) {
      audit.skipped_generic_name++;
      if (audit.samples.skipped_generic_name.length < 8) audit.samples.skipped_generic_name.push(storageId);
      continue;
    }

    audit.review_ready_mapped++;
    if (audit.samples.review_ready_mapped.length < 8) {
      audit.samples.review_ready_mapped.push({
        storage_id: storageId,
        name_original: item.name_original,
      });
    }
  }

  return audit;
}

function classifyUnstableGeneratedFile(file, taskMap, existingById, knowledgeMap) {
  const storageId = fileStorageId(file);
  const item = taskMap.get(storageId);
  const entryId = `local-${storageId}`;
  const promotedPath = join(PROMOTED_DIR, `${storageId}.webp`);
  const alreadyIndexed = existingById.has(entryId) && existsSync(promotedPath);

  if (alreadyIndexed) {
    return {
      file,
      storage_id: storageId,
      status: "already_promoted_source_file",
      next_action: "no_action_needed_stable_generated_cache_exists",
    };
  }

  if (PROMOTION_BLOCKLIST.has(storageId)) {
    return {
      file,
      storage_id: storageId,
      status: "blocked_by_id",
      next_action: "keep_blocked_do_not_promote_without_new_visual_review",
    };
  }

  if (item) {
    if (isGenericPromotionName(item)) {
      return {
        file,
        storage_id: storageId,
        name_original: item.name_original,
        status: "skipped_generic_name",
        next_action: "do_not_promote_global_generic_section_label",
      };
    }
    return {
      file,
      storage_id: storageId,
      name_original: item.name_original,
      name_translated: item.name_translated,
      status: "review_ready_mapped",
      next_action: "manual_visual_review_then_run_with_apply",
    };
  }

  const inferredKey = inferredNameKeyFromStorageId(storageId);
  if (!inferredKey) {
    return {
      file,
      storage_id: storageId,
      status: "unmapped_hashed_storage_id",
      next_action: "recover_task_cache_evidence_before_promoting",
    };
  }

  const knowledgeEntry = knowledgeMap.get(slugForKnowledgeMatch(inferredKey));
  if (knowledgeEntry) {
    return {
      file,
      storage_id: storageId,
      inferred_key: inferredKey,
      knowledge_id: knowledgeEntry.id,
      status: isLocalKnowledgeEntry(knowledgeEntry)
        ? "unmapped_local_knowledge_duplicate"
        : "unmapped_remote_knowledge_match",
      next_action: isLocalKnowledgeEntry(knowledgeEntry)
        ? "safe_cleanup_candidate_existing_local_knowledge_covers_it"
        : "manual_visual_review_then_promote_to_knowledge_or_delete_duplicate",
    };
  }

  return {
    file,
    storage_id: storageId,
    inferred_key: inferredKey,
    status: "unmapped_named_without_knowledge_match",
    next_action: "manual_visual_review_then_restore_task_evidence_or_backfill_knowledge",
  };
}

function buildUnstableReport(generatedFiles, taskMap, existingById, knowledgeMap) {
  const items = generatedFiles
    .filter((file) => TARGET_IDS.size === 0 || TARGET_IDS.has(fileStorageId(file)))
    .map((file) => classifyUnstableGeneratedFile(file, taskMap, existingById, knowledgeMap));
  const unstableItems = items.filter((item) => item.status !== "already_promoted_source_file");
  const limit = LIMIT > 0 ? LIMIT : 25;
  const limitedItems = unstableItems.slice(0, limit);
  const reviewCandidates = buildReviewCandidates(unstableItems).slice(0, limit);
  return {
    total_unstable_unpromoted: unstableItems.length,
    returned_items: limitedItems.length,
    limit,
    next_action: "manual_visual_review_then_restore_task_evidence_or_backfill_knowledge",
    review_candidates: reviewCandidates,
    unstable_unpromoted_items: limitedItems,
    items: limitedItems,
  };
}

function candidateNameFromItem(item) {
  const directName = item.name_original || item.name_translated;
  if (directName) return directName;
  const key = item.inferred_key || String(item.storage_id || "").replace(/^generated-/, "");
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function reviewPriorityForStatus(status) {
  if (status === "review_ready_mapped") return 1;
  if (status === "unmapped_named_without_knowledge_match") return 2;
  if (status === "unmapped_remote_knowledge_match") return 3;
  return 9;
}

function buildReviewCandidates(items) {
  return items
    .filter((item) => [
      "review_ready_mapped",
      "unmapped_named_without_knowledge_match",
      "unmapped_remote_knowledge_match",
    ].includes(item.status))
    .map((item) => ({
      ...item,
      candidate_name: candidateNameFromItem(item),
      thumbnail_path: join(GENERATED_DIR, item.file),
      review_priority: reviewPriorityForStatus(item.status),
      next_action: "manual_visual_review_contact_sheet",
    }))
    .sort((a, b) =>
      a.review_priority - b.review_priority ||
      a.candidate_name.localeCompare(b.candidate_name) ||
      a.storage_id.localeCompare(b.storage_id)
    );
}

function buildReviewedCandidateItems(generatedFiles, taskMap, existingById, knowledgeMap, reviewedIds) {
  if (reviewedIds.size === 0) return [];
  return generatedFiles
    .map((file) => classifyUnstableGeneratedFile(file, taskMap, existingById, knowledgeMap))
    .filter((item) => reviewedIds.has(item.storage_id))
    .filter((item) => [
      "already_promoted_source_file",
      "review_ready_mapped",
      "unmapped_named_without_knowledge_match",
      "unmapped_remote_knowledge_match",
    ].includes(item.status))
    .map((item) => {
      const name = candidateNameFromItem(item);
      return {
        storageId: item.storage_id,
        name_original: name,
        name_translated: "",
        category: categoryForPromotionName(name),
        promotion_note: "manual_visual_review_verified",
      };
    });
}

function escapeSvgText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortLabel(value, max = 30) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function renderContactSheet(items, outputPath) {
  const candidates = items.filter((item) => item.thumbnail_path && existsSync(item.thumbnail_path));
  const cols = 4;
  const tileW = 240;
  const tileH = 286;
  const padding = 24;
  const rows = Math.max(1, Math.ceil(Math.max(1, candidates.length) / cols));
  const width = padding * 2 + cols * tileW;
  const height = padding * 2 + rows * tileH;
  const composites = [];

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * tileW;
    const y = padding + row * tileH;
    const image = await sharp(item.thumbnail_path, { failOn: "none" })
      .rotate()
      .resize(184, 184, { fit: "cover" })
      .png()
      .toBuffer();
    const label = Buffer.from(`
      <svg width="${tileW}" height="${tileH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="${tileW - 12}" height="${tileH - 12}" rx="18" fill="#FFF5E9" stroke="#D4A574" stroke-width="2"/>
        <text x="18" y="218" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="#2F2A26">${escapeSvgText(shortLabel(item.candidate_name))}</text>
        <text x="18" y="244" font-family="Arial, sans-serif" font-size="12" fill="#7E7167">${escapeSvgText(shortLabel(item.storage_id, 34))}</text>
        <text x="18" y="266" font-family="Arial, sans-serif" font-size="12" fill="#4CAF50">${escapeSvgText(shortLabel(item.status, 28))}</text>
      </svg>
    `);
    composites.push({ input: label, left: x, top: y });
    composites.push({ input: image, left: x + 18, top: y + 18 });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#F8EFE4",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);

  return {
    path: outputPath,
    items: candidates.length,
    kind: "manual_visual_review_contact_sheet",
  };
}

async function main() {
  const taskMap = collectTaskCacheDishMap();
  const generatedFiles = listGeneratedImageFiles();
  const knowledgeMap = buildKnowledgeMatchMap(loadKnowledgeDb());
  const existingIndex = await readIndex();
  const existingById = new Map(
    existingIndex
      .filter((entry) => !PROMOTION_BLOCKLIST.has(String(entry.id || "").replace(/^local-/, "")))
      .map((entry) => [entry.id, entry]),
  );

  let candidates = Array.from(taskMap.values())
    .filter((item) =>
      item.name_original &&
      generatedFileForStorageId(item.storageId) &&
      !PROMOTION_BLOCKLIST.has(item.storageId)
    );
  if (TARGET_IDS.size > 0) candidates = candidates.filter((item) => TARGET_IDS.has(item.storageId));
  const reviewedCandidates = buildReviewedCandidateItems(generatedFiles, taskMap, existingById, knowledgeMap, REVIEWED_IDS);
  if (REVIEWED_IDS.size > 0) candidates = reviewedCandidates;
  const candidateIds = new Set(candidates.map((item) => item.storageId));
  for (const item of reviewedCandidates) {
    if (!candidateIds.has(item.storageId)) candidates.push(item);
  }
  if (LIMIT > 0) candidates = candidates.slice(0, LIMIT);

  const report = {
    ok: true,
    dry_run: !APPLY,
    task_cache_mapped_images: taskMap.size,
    candidates: candidates.length,
    promoted_dir: "/dishes/generated-cache",
    audit: buildPromotionAudit(generatedFiles, taskMap, existingById, knowledgeMap),
    summary: {
      would_promote: 0,
      promoted: 0,
      failed: 0,
      already_indexed: 0,
      skipped_generic_name: 0,
      reviewed_candidates: reviewedCandidates.length,
    },
    results: [],
  };

  if (UNSTABLE_REPORT || CONTACT_SHEET_PATH) {
    report.unstable_report = buildUnstableReport(generatedFiles, taskMap, existingById, knowledgeMap);
  }

  if (CONTACT_SHEET_PATH) {
    report.contact_sheet = await renderContactSheet(
      report.unstable_report.review_candidates,
      CONTACT_SHEET_PATH,
    );
  }

  if (APPLY) await mkdir(PROMOTED_DIR, { recursive: true });

  for (const item of candidates) {
    if (isGenericPromotionName(item)) {
      report.summary.skipped_generic_name++;
      if (VERBOSE) {
        report.results.push({
          storage_id: item.storageId,
          name_original: item.name_original,
          status: "skipped_generic_name",
        });
      }
      continue;
    }

    const entry = indexEntryFor(item);
    const sourceFile = generatedFileForStorageId(item.storageId);
    const sourcePath = join(GENERATED_DIR, sourceFile);
    const outputPath = join(PROMOTED_DIR, `${item.storageId}.webp`);
    const alreadyIndexed = existingById.has(entry.id) && existsSync(outputPath);

    try {
      if (!APPLY) {
        if (alreadyIndexed) {
          report.summary.already_indexed++;
        } else {
          report.summary.would_promote++;
        }
      } else {
        if (!alreadyIndexed) {
          await optimizeToPromotedWebp(sourcePath, outputPath);
          report.summary.promoted++;
        } else {
          report.summary.already_indexed++;
        }
        existingById.set(entry.id, entry);
      }

      if (VERBOSE || alreadyIndexed) {
        report.results.push({
          storage_id: item.storageId,
          name_original: item.name_original,
          card: entry.card,
          status: alreadyIndexed ? "already_indexed" : APPLY ? "promoted" : "would_promote",
        });
      }
    } catch (error) {
      report.ok = false;
      report.summary.failed++;
      report.results.push({
        storage_id: item.storageId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (APPLY) {
    const nextIndex = Array.from(existingById.values()).sort((a, b) => a.id.localeCompare(b.id));
    await writeFile(INDEX_PATH, `${JSON.stringify(nextIndex, null, 2)}\n`);
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.log(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
