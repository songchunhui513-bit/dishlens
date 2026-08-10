#!/usr/bin/env node

/**
 * Diagnose which image layer a dish will use:
 * local_knowledge -> promoted_generated_cache -> supabase_db -> generated_local_unstable -> ai_pending
 *
 * This intentionally mirrors the production order around matchDishKnowledgeImage()
 * and storageIdForGeneratedDishImage() without importing the Next/TS runtime.
 * Runtime generated files are useful on this machine, but they are not stable
 * across deploys or shared links until they have been synced to Supabase.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DB_PATH = join(ROOT, "public", "dish-knowledge-db.json");
const GENERATED_LOCAL_INDEX_PATH = join(ROOT, "public", "generated-dish-local-index.json");
const GENERATED_CACHE_DIR = join(ROOT, "public", "dishes", "generated-cache");
const GENERATED_DIR = join(ROOT, "public", "generated-dishes");
const DIRECT_LOCAL_ALIASES = [
  { patterns: ["capriccioza", "capricciosa", "pizza capricciosa", "capricciosa pizza"], id: "pizza-capricciosa" },
  { patterns: ["caesar", "caesar salad", "凯撒沙拉"], id: "caesar-salad" },
  { patterns: ["unagi don", "unagi donburi", "unadon", "eel don", "eel rice bowl", "鳗鱼饭", "鳗鱼丼"], id: "unagi-don" },
  { patterns: ["warabimochi", "warabi mochi", "bracken mochi", "bracken starch mochi", "蕨饼"], id: "warabimochi" },
  { patterns: ["cheonggukjang", "fermented soybean stew", "清国酱汤", "清国酱"], id: "cheonggukjang" },
  { patterns: ["doenjang jjigae", "doenjang stew", "soybean paste stew", "大酱汤", "大酱湯"], id: "doenjang-jjigae" },
  { patterns: ["gochujang jjigae", "gochujang stew", "辣椒酱汤", "辣酱汤"], id: "gochujang-jjigae" },
  { patterns: ["galbi", "kalbi", "korean short ribs", "grilled short ribs", "韩式牛排骨", "갈비"], id: "galbi" },
  { patterns: ["galbitang", "short rib soup", "beef short rib soup", "牛排骨汤"], id: "galbitang" },
  { patterns: ["gyoza", "japanese dumplings", "japanese pan fried dumplings", "日式煎饺", "餃子"], id: "gyoza" },
  { patterns: ["hotteok", "korean sweet pancake", "sweet pancake", "韩式糖饼", "호떡"], id: "hotteok" },
  { patterns: ["inari sushi", "fried tofu pouch sushi", "稻荷寿司", "稲荷寿司"], id: "inari-sushi" },
  { patterns: ["jajangmyeon", "jjajangmyeon", "black bean noodles", "korean black bean noodles", "韩式炸酱面", "자장면", "짜장면"], id: "jajangmyeon" },
  { patterns: ["japchae", "glass noodle stir fry", "glass noodle stir-fry", "korean glass noodles", "韩式杂菜", "잡채"], id: "japchae" },
  { patterns: ["jokbal", "braised pig's feet", "braised pigs feet", "korean braised pork trotter", "韩式卤猪蹄", "족발"], id: "jokbal" },
  { patterns: ["kakigori", "japanese shaved ice", "shaved ice", "刨冰", "かき氷"], id: "kakigori" },
  { patterns: ["karaage", "japanese fried chicken", "日式炸鸡块", "唐揚げ"], id: "karaage" },
  { patterns: ["middle eastern muhammara", "muhammara me", "arabic muhammara", "中东核桃辣酱"], id: "muhammara-me" },
  { patterns: ["lebanese muhammara", "muhammara lebanese", "muhammara", "核桃辣酱"], id: "muhammara-lebanese" },
  { patterns: ["turkish baklava", "baklava turkish", "土耳其果仁蜜饼"], id: "baklava-turkish" },
  { patterns: ["middle eastern baklava", "arabic baklava", "baklava me", "中东果仁蜜饼"], id: "baklava-me" },
  { patterns: ["hainan chicken rice", "hainanese chicken rice", "海南鸡饭"], id: "hainanese-chicken-rice" },
  { patterns: ["thai khao man gai", "khao man gai thai", "ข้าวมันไก่", "泰式海南鸡饭", "海南鸡饭 泰式"], id: "khao-man-gai-thai" },
  { patterns: ["japanese curry", "japanese curry rice", "kare raisu", "kare rice", "日式咖喱饭"], id: "japanese-curry" },
  { patterns: ["pizza burrata e prosciutto", "burrata prosciutto pizza", "burrata and prosciutto pizza", "布拉塔火腿披萨"], id: "pizza-burrata-prosciutto" },
  { patterns: ["prosciutto", "prosciutto crudo"], id: "prosciutto-e-melone" },
  { patterns: ["burrata", "burrata con pomodorini", "burrata e pomodorini", "burrata with tomato", "布里塔", "布里亚塔", "布拉塔", "布里塔配小番茄"], id: "burrata-con-pomodorini" },
  { patterns: ["dorayaki", "red bean pancake", "铜锣烧", "铜鑼烧", "どら焼き"], id: "dorayaki" },
  { patterns: ["omurice", "omelette rice", "omelet rice", "蛋包饭", "オムライス"], id: "omurice" },
  { patterns: ["bossam", "bo ssam", "bo-ssam", "boiled pork wraps", "korean boiled pork", "보쌈", "韩式水煮五花肉"], id: "bossam" },
  { patterns: ["onigiri", "rice ball", "japanese rice ball", "おにぎり", "日式饭团"], id: "onigiri" },
  { patterns: ["smorrebrod", "smørrebrød", "open faced rye sandwich", "danish open sandwich", "丹麦开放式三明治"], id: "smorrebrod" },
  { patterns: ["takoyaki", "octopus balls", "たこ焼き", "章鱼烧"], id: "takoyaki" },
  { patterns: ["taiyaki", "tai yaki", "たい焼き", "鲷鱼烧", "日式鲷鱼烧"], id: "taiyaki" },
  { patterns: ["tsukemen", "dipping noodles", "蘸面", "つけ麺"], id: "tsukemen" },
  { patterns: ["tteokguk", "korean rice cake soup", "rice cake soup", "年糕汤", "떡국"], id: "tteokguk" },
  { patterns: ["tteokbokki", "tteok-bokki", "spicy rice cakes", "korean spicy rice cakes", "炒年糕", "韩式炒年糕", "떡볶이"], id: "tteokbokki" },
  { patterns: ["yukgaejang", "korean spicy beef soup", "spicy beef soup", "辣牛肉汤", "육개장"], id: "yukgaejang" },
  { patterns: ["yakisoba", "yaki soba", "japanese fried noodles", "日式炒面", "焼きそば"], id: "yakisoba" },
  { patterns: ["udon", "udon noodles", "乌冬面", "うどん"], id: "udon" },
  { patterns: ["yudofu", "hot tofu", "汤豆腐", "湯豆腐"], id: "yudofu" },
  { patterns: ["anmitsu", "japanese anmitsu", "red bean jelly dessert", "馅蜜", "あんみつ"], id: "anmitsu" },
  { patterns: ["bibim guksu", "spicy mixed noodles", "korean spicy mixed noodles", "韩式拌面", "비빔국수"], id: "bibim-guksu" },
  { patterns: ["bibim naengmyeon", "spicy cold noodles", "korean spicy cold noodles", "韩式拌冷面", "비빔냉면"], id: "bibim-naengmyeon" },
  { patterns: ["bingsu", "patbingsu", "shaved ice dessert", "korean shaved ice", "韩式刨冰", "빙수"], id: "bingsu" },
  { patterns: ["bo luc lac", "bò lúc lắc", "shaking beef", "vietnamese shaking beef", "越式摇摇牛肉"], id: "bo-luc-lac" },
  { patterns: ["mushroom bruschetta", "bruschetta ai funghi", "funghi bruschetta", "蘑菇烤面包", "蘑菇布鲁斯凯塔"], id: "bruschetta-ai-funghi" },
  { patterns: ["bruschetta", "bruschetta al pomodoro", "tomato bruschetta", "番茄烤面包"], id: "bruschetta-al-pomodoro" },
  { patterns: ["bulgogi", "korean bulgogi", "marinated grilled beef", "韩式烤肉", "불고기"], id: "bulgogi" },
  { patterns: ["cao lau", "cao lầu", "hoi an noodles", "会安高楼面"], id: "cao-lau" },
  { patterns: ["cassata siciliana", "sicilian cassata", "cassata", "西西里卡萨塔蛋糕"], id: "cassata-siciliana" },
  { patterns: ["chebakia", "shebakia", "moroccan sesame honey cookie", "花形蜂蜜饼干"], id: "chebakia" },
  { patterns: ["cendol", "chendol", "煎蕊", "煎蕊冰"], id: "chendol" },
  { patterns: ["chicken korma", "creamy chicken curry", "奶油鸡咖喱"], id: "chicken-korma" },
  { patterns: ["chiles en nogada", "chiles nogada", "stuffed poblano peppers in walnut sauce", "核桃酱酿辣椒"], id: "chiles-en-nogada" },
  { patterns: ["churros con chocolate", "churros with chocolate", "吉拿棒配巧克力"], id: "churros-con-chocolate" },
  { patterns: ["kanelbulle", "cinnamon roll", "swedish cinnamon roll", "瑞典肉桂卷"], id: "cinnamon-roll-scandinavian" },
  { patterns: ["cochinillo asado", "roast suckling pig", "spanish suckling pig", "烤乳猪"], id: "cochinillo-asado" },
  { patterns: ["crema catalana", "catalan cream", "加泰罗尼亚焦糖布丁"], id: "crema-catalana" },
  { patterns: ["crostata di marmellata", "jam tart", "italian jam tart", "果酱塔"], id: "crostata-di-marmellata" },
  { patterns: ["dakgalbi", "dak galbi", "spicy stir fried chicken", "spicy stir-fried chicken", "春川辣炒鸡排", "닭갈비"], id: "dakgalbi" },
  { patterns: ["gozleme", "turkish gozleme", "turkish stuffed flatbread", "土耳其馅饼"], id: "gozleme" },
  { patterns: ["temaki", "hand roll", "sushi hand roll", "手巻き", "手卷", "手捲"], id: "temaki" },
  { patterns: ["arroz con mariscos", "seafood rice", "peruvian seafood rice", "秘鲁海鲜饭"], id: "arroz-con-mariscos" },
  { patterns: ["arroz negro", "black rice", "squid ink rice", "墨鱼汁饭"], id: "arroz-negro" },
  { patterns: ["bacalao al pil pil", "cod in garlic emulsion", "pil pil cod", "蒜香鳕鱼"], id: "bacalao-al-pil-pil" },
  { patterns: ["banh trang tron", "bánh tráng trộn", "mixed rice paper salad", "vietnamese rice paper salad", "越南米纸沙拉"], id: "banh-trang-tron" },
  { patterns: ["shahi paneer", "royal paneer curry", "皇室芝士咖喱"], id: "shahi-paneer" },
  { patterns: ["tacos al pastor", "pork pineapple tacos", "pastor taco", "pastor tacos", "牧羊人塔可"], id: "tacos-al-pastor" },
  { patterns: ["tamagoyaki", "japanese omelette", "rolled japanese omelette", "玉子焼き", "日式煎蛋卷"], id: "tamagoyaki" },
  { patterns: ["tebasaki", "nagoya chicken wings", "fried chicken wings", "手羽先", "名古屋炸鸡翅"], id: "tebasaki" },
  { patterns: ["teriyaki chicken", "chicken teriyaki", "照り焼きチキン", "照烧鸡"], id: "teriyaki-chicken" },
  { patterns: ["thai kanom jeen", "kanom jeen", "khanom jeen", "kanom chin", "khanom chin", "ขนมจีน"], id: "kanom-jeen" },
  { patterns: ["kibbeh", "middle eastern kibbeh", "lebanese kibbeh", "kibbeh croquettes", "炸肉丸"], id: "kibbeh-me" },
  { patterns: ["street dumplings", "potstickers", "pan fried dumplings", "pan-fried dumplings", "锅贴", "煎饺"], id: "dumplings-street" },
  { patterns: ["tortellini panna", "tortellini alla panna", "tortellini in cream sauce", "奶油意式馄饨"], id: "tortellini-panna" },
];

function normalizeDishLookupName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .replace(/[™®©]/g, " ")
    .replace(/^\s*(?:no\.?|#)?\s*\d{1,3}\s+[\-.)、]?\s*/i, "")
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

const MENU_MARKER_SUFFIX_TOKENS = new Set([
  "l", "lg", "gf", "gfo", "df", "dfo", "of", "vg", "v", "ve", "vgo", "vgn", "lvg", "lgfo", "ldf", "ldfo", "gfof", "lgeo",
]);

function stripMenuMarkerSuffix(normalized) {
  const parts = String(normalized || "").split(" ").filter(Boolean);
  let end = parts.length;
  while (end > 1 && MENU_MARKER_SUFFIX_TOKENS.has(parts[end - 1])) end--;
  return end < parts.length && end >= 1 ? parts.slice(0, end).join(" ") : normalized;
}

function generatedCacheNameVariants(value) {
  const canonical = canonicalDishNameKey(value);
  const withoutComboWords = canonical
    .replace(/\b(?:meal|combo|set|menu deal|value meal|box meal)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(new Set([
    canonical,
    stripMenuMarkerSuffix(canonical),
    withoutComboWords,
    stripMenuMarkerSuffix(withoutComboWords),
  ].filter((name) => name.length > 3)));
}

function containsCanonicalPhrase(text, pattern) {
  const canonicalPattern = canonicalDishNameKey(pattern);
  if (!canonicalPattern) return false;
  if (/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(canonicalPattern)) {
    return text.includes(canonicalPattern);
  }
  return text === canonicalPattern ||
    text.startsWith(`${canonicalPattern} `) ||
    text.includes(` ${canonicalPattern} `) ||
    text.endsWith(` ${canonicalPattern}`);
}

function slug(value) {
  const raw = String(value || "");
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .toLowerCase()
    .replace(/[€$£¥₹]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?|usd|gbp|元|円|₹)/gi, " ")
    .replace(/[«»"“”'’`´.,;:!?()[\]{}+*/\\|_~^=<>]/g, " ")
    .trim();

  if (!/[a-z0-9]/.test(cleaned)) {
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = (Math.imul(31, h) + raw.charCodeAt(i)) | 0;
    return `dish-${Math.abs(h).toString(36)}`;
  }

  return cleaned
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
  const splitCandidates = String(name || "")
    .split(/\s*(?:\/|\||·{2,}|•{2,})\s*/g)
    .map((part) => normalizeDishLookupName(part).toLowerCase())
    .filter((part) => part.length > 2);
  return Array.from(new Set([
    normalized,
    normalized.toLowerCase(),
    canonical,
    ...splitCandidates,
    canonical ? `${canonical} pizza` : "",
    canonical ? `pizza ${canonical}` : "",
  ].filter(Boolean)));
}

function loadKnowledgeDb() {
  return JSON.parse(readFileSync(DB_PATH, "utf8"));
}

function loadGeneratedLocalIndex() {
  if (!existsSync(GENERATED_LOCAL_INDEX_PATH)) return [];
  return JSON.parse(readFileSync(GENERATED_LOCAL_INDEX_PATH, "utf8"));
}

function isLocalKnowledgeEntry(entry) {
  return typeof entry.card === "string" &&
    entry.card.startsWith("/dishes/") &&
    typeof entry.hero === "string" &&
    entry.hero.startsWith("/dishes/") &&
    existsSync(join(ROOT, "public", entry.card));
}

function isPollinationsUrl(value) {
  return typeof value === "string" && value.includes("image.pollinations.ai");
}

function isRemoteUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function isStableSupabaseImageUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.pathname.startsWith("/storage/v1/object/public/dishes/");
  } catch {
    return false;
  }
}

function matchLocalKnowledge(db, name) {
  const normalizedName = canonicalDishNameKey(name);
  const directId = slug(name);
  const directEntry = db.find((entry) =>
    isLocalKnowledgeEntry(entry) && (
      entry.id === String(name || "").trim() ||
      entry.id === directId ||
      canonicalDishNameKey(entry.id) === normalizedName
    ));
  if (directEntry) return directEntry;

  for (const alias of DIRECT_LOCAL_ALIASES) {
    if (alias.patterns.some((pattern) => containsCanonicalPhrase(normalizedName, pattern))) {
      const entry = db.find((item) => item.id === alias.id);
      if (entry && isLocalKnowledgeEntry(entry)) return entry;
    }
  }

  const candidates = new Set(dishNameLookupCandidates(name).map(canonicalDishNameKey));
  for (const entry of db) {
    if (!isLocalKnowledgeEntry(entry)) continue;
    const names = (entry.names || []).map(canonicalDishNameKey);
    if (names.some((entryName) => entryName && candidates.has(entryName))) return entry;
  }
  return null;
}

function matchPromotedGeneratedCache(index, name) {
  const normalizedQuery = canonicalDishNameKey(name);
  const candidates = new Set(dishNameLookupCandidates(name).flatMap(generatedCacheNameVariants));
  let best = null;
  for (const entry of index) {
    if (!isLocalKnowledgeEntry(entry)) continue;
    const names = (entry.names || []).flatMap(generatedCacheNameVariants);
    const contextTerms = (entry.context_terms || []).map(canonicalDishNameKey).filter(Boolean);
    const hasRequiredContext = contextTerms.length === 0 ||
      contextTerms.some((term) => containsCanonicalPhrase(normalizedQuery, term));
    const matched = names.some((entryName) =>
      entryName &&
      (
        candidates.has(entryName) ||
        (
          hasRequiredContext &&
          (
            normalizedQuery.startsWith(`${entryName} `) ||
            normalizedQuery.includes(` ${entryName} `)
          )
        )
      )
    );
    if (!matched) continue;

    const normalizedEntryId = canonicalDishNameKey(String(entry.id || "").replace(/^local-generated-/, ""));
    const exactNameMatch = (entry.names || []).some((entryName) => canonicalDishNameKey(entryName) === normalizedQuery);
    const variantNameMatch = !exactNameMatch && names.some((entryName) => entryName && candidates.has(entryName));
    const score =
      (exactNameMatch ? 0.96 : variantNameMatch ? 0.955 : 0.94) +
      (normalizedEntryId === normalizedQuery ? 0.04 : 0);
    if (!best || score > best.score) best = { entry, score };
  }
  return best?.entry || null;
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

async function diagnoseName(db, generatedIndex, supabaseRows, name) {
  const local = matchLocalKnowledge(db, name);
  if (local) {
    return { name, layer: "local_knowledge", id: local.id, url: local.card };
  }

  const promoted = matchPromotedGeneratedCache(generatedIndex, name);
  if (promoted) {
    return { name, layer: "promoted_generated_cache", id: promoted.id, url: promoted.card };
  }

  for (const candidate of dishNameLookupCandidates(name)) {
    const row = supabaseRows.get(candidate);
    if (isStableSupabaseImageUrl(row?.ai_image_url)) {
      return { name, layer: "supabase_db", id: candidate, url: row.ai_image_url, image_source: row.image_source || null };
    }
  }

  const storageId = storageIdForGeneratedDishImage(name);
  const generatedWebpPath = join(GENERATED_DIR, `${storageId}.webp`);
  if (existsSync(generatedWebpPath)) {
    return {
      name,
      layer: "generated_local_unstable",
      id: storageId,
      url: `/generated-dishes/${storageId}.webp`,
      action: "sync_to_supabase_for_stable_share_and_deploy",
    };
  }
  const generatedPngPath = join(GENERATED_DIR, `${storageId}.png`);
  if (existsSync(generatedPngPath)) {
    return {
      name,
      layer: "generated_local_unstable",
      id: storageId,
      url: `/generated-dishes/${storageId}.png`,
      action: "sync_to_supabase_for_stable_share_and_deploy",
    };
  }

  return { name, layer: "ai_pending", id: storageId, url: null };
}

function countImageFiles(dirPath) {
  return existsSync(dirPath)
    ? readdirSync(dirPath).filter((file) => /\.(png|webp|jpe?g)$/i.test(file)).length
    : 0;
}

function fileStorageId(file) {
  return file.replace(/\.(png|webp|jpe?g)$/i, "");
}

function countPromotedRuntimeSourceFiles(generatedIndex) {
  if (!existsSync(GENERATED_DIR)) return 0;
  const promotedStorageIds = new Set(
    generatedIndex
      .filter(isLocalKnowledgeEntry)
      .filter((entry) => typeof entry.card === "string" && entry.card.startsWith("/dishes/generated-cache/"))
      .map((entry) => String(entry.id || "").replace(/^local-/, ""))
      .filter(Boolean),
  );
  return readdirSync(GENERATED_DIR)
    .filter((file) => /\.(png|webp|jpe?g)$/i.test(file))
    .filter((file) => promotedStorageIds.has(fileStorageId(file))).length;
}

function referencedStableLocalImageUrls(db, generatedIndex) {
  const urls = new Set();
  for (const entry of [...db, ...generatedIndex]) {
    for (const field of ["card", "hero"]) {
      const value = entry?.[field];
      if (typeof value === "string" && value.startsWith("/dishes/")) {
        urls.add(value);
      }
    }
  }
  return Array.from(urls).sort();
}

function loadGitTrackedPublicDishFiles() {
  try {
    const stdout = execFileSync("git", ["ls-files", "-z", "public/dishes"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return new Set(stdout.split("\0").map((line) => line.trim()).filter(Boolean));
  } catch {
    return null;
  }
}

function diagnoseLocalImageAssets(db, generatedIndex) {
  const urls = referencedStableLocalImageUrls(db, generatedIndex);
  const trackedFiles = loadGitTrackedPublicDishFiles();
  let missing = 0;
  let untracked = 0;

  for (const url of urls) {
    const publicRelativePath = `public${url}`;
    const absolutePath = join(ROOT, publicRelativePath);
    const exists = existsSync(absolutePath);
    if (!exists) missing++;
    if (exists && trackedFiles && !trackedFiles.has(publicRelativePath)) untracked++;
  }

  return {
    total: urls.length,
    missing,
    untracked,
    deployReady: missing === 0 && untracked === 0,
  };
}

function promotedGeneratedCacheCoverage(db, generatedIndex) {
  const promotedEntries = generatedIndex
    .filter(isLocalKnowledgeEntry)
    .filter((entry) => typeof entry.card === "string" && entry.card.startsWith("/dishes/generated-cache/"));
  let duplicateLocal = 0;

  for (const entry of promotedEntries) {
    const names = Array.isArray(entry.names) ? entry.names : [];
    const alreadyCoveredByLocalKnowledge = names.some((name) => matchLocalKnowledge(db, name));
    if (alreadyCoveredByLocalKnowledge) duplicateLocal++;
  }

  return {
    total: promotedEntries.length,
    duplicateLocal,
    uniqueNew: Math.max(0, promotedEntries.length - duplicateLocal),
  };
}

function summarizeKnowledge(db, generatedIndex) {
  let localEntries = 0;
  let pollinationsEntries = 0;
  let otherRemoteEntries = 0;
  for (const entry of db) {
    if (isLocalKnowledgeEntry(entry)) localEntries++;
    else if (isPollinationsUrl(entry.card) || isPollinationsUrl(entry.hero)) pollinationsEntries++;
    else if (isRemoteUrl(entry.card) || isRemoteUrl(entry.hero)) otherRemoteEntries++;
  }
  const promotedCoverage = promotedGeneratedCacheCoverage(db, generatedIndex);
  const promotedGeneratedCache = promotedCoverage.total;
  const promotedGeneratedCacheFiles = countImageFiles(GENERATED_CACHE_DIR);
  const generatedLocalUnstable = countImageFiles(GENERATED_DIR);
  const generatedLocalPromotedSourceFiles = countPromotedRuntimeSourceFiles(generatedIndex);
  const generatedLocalUnstableUnpromoted = Math.max(0, generatedLocalUnstable - generatedLocalPromotedSourceFiles);
  const stableLocalTotal = localEntries + promotedGeneratedCache;
  const stableLocalDedupedTotal = localEntries + promotedCoverage.uniqueNew;
  const localImageAssets = diagnoseLocalImageAssets(db, generatedIndex);

  return {
    total_entries: db.length,
    local_knowledge: localEntries,
    promoted_generated_cache: promotedGeneratedCache,
    promoted_generated_cache_unique_new: promotedCoverage.uniqueNew,
    promoted_generated_cache_duplicate_local: promotedCoverage.duplicateLocal,
    promoted_generated_cache_files: promotedGeneratedCacheFiles,
    pollinations_remote: pollinationsEntries,
    other_remote: otherRemoteEntries,
    ai_pending_or_remote: db.length - localEntries,
    generated_local_unstable: generatedLocalUnstable,
    generated_local_promoted_source_files: generatedLocalPromotedSourceFiles,
    generated_local_unstable_unpromoted: generatedLocalUnstableUnpromoted,
    local_image_assets_total: localImageAssets.total,
    local_image_assets_missing: localImageAssets.missing,
    local_image_assets_untracked: localImageAssets.untracked,
    local_image_assets_deploy_ready: localImageAssets.deployReady,
    local_knowledge_coverage_percent: Math.round((localEntries / Math.max(1, db.length)) * 1000) / 10,
    stable_local_with_promoted_coverage_percent: Math.round((stableLocalTotal / Math.max(1, db.length)) * 1000) / 10,
    stable_local_deduped_coverage_percent: Math.round((stableLocalDedupedTotal / Math.max(1, db.length)) * 1000) / 10,
  };
}

const args = process.argv.slice(2);
const names = args.filter((arg) => !arg.startsWith("--"));
const failOnDeployRisk = args.includes("--fail-on-deploy-risk");
const db = loadKnowledgeDb();
const generatedIndex = loadGeneratedLocalIndex();
let summary = null;

if (args.includes("--summary") || names.length === 0) {
  summary = summarizeKnowledge(db, generatedIndex);
  console.log(JSON.stringify(summary, null, 2));
}

if (names.length > 0) {
  const supabaseRows = await querySupabase(names);
  const rows = [];
  for (const name of names) rows.push(await diagnoseName(db, generatedIndex, supabaseRows, name));
  console.log(JSON.stringify(rows, null, 2));
}

if (failOnDeployRisk) {
  summary = summary || summarizeKnowledge(db, generatedIndex);
  if (!summary.local_image_assets_deploy_ready) {
    console.error([
      "Dish image assets are not deploy-ready.",
      `missing=${summary.local_image_assets_missing}`,
      `untracked=${summary.local_image_assets_untracked}`,
    ].join(" "));
    process.exitCode = 1;
  }
}
