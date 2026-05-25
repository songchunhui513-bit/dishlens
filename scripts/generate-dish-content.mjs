#!/usr/bin/env node
// Generate rich content + AI images for the dish knowledge database
// Usage:
//   node scripts/generate-dish-content.mjs                 # generate all
//   node scripts/generate-dish-content.mjs --cuisine french # single cuisine
//   node scripts/generate-dish-content.mjs --start 0 --count 50  # range
//   node scripts/generate-dish-content.mjs --content-only   # skip image generation
//   node scripts/generate-dish-content.mjs --images-only    # skip content generation
//   node scripts/generate-dish-content.mjs --images-only --ids pizza-margherita,pizza-diavola

import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

// Load .env.local manually
const envPath = join(import.meta.dirname, "..", ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

const API_KEY = process.env.QWEN_API_KEY;
if (!API_KEY) { console.error("QWEN_API_KEY not set"); process.exit(1); }

const WAN_MODEL = process.env.WAN_MODEL || "wanx2.1-t2i-turbo";
const DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1";
const OUT_DIR = join(import.meta.dirname, "..", "public", "dishes");
const PROGRESS_FILE = join(import.meta.dirname, "..", ".dish-gen-progress.json");
const JSON_OUT = join(import.meta.dirname, "..", "public", "dish-knowledge-db.json");

const CONTENT_CONCURRENCY = 5;
const IMAGE_CONCURRENCY = 1;
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 90_000;

const DISH_IMAGE_STYLE_SPEC = [
  "realistic restaurant food photography",
  "accurate ingredients and plating for the named dish",
  "single finished dish as the main subject",
  "45-degree overhead angle, warm natural light, white or neutral ceramic plate",
  "crisp appetizing texture, food magazine quality, high detail",
  "clean composition, no text, no logo, no watermark, no hands, no people, no menu",
].join(", ");

const DISH_IMAGE_NEGATIVE_PROMPT = [
  "text",
  "logo",
  "watermark",
  "menu",
  "hands",
  "people",
  "cartoon",
  "illustration",
  "plastic toy food",
  "wrong ingredients",
  "messy plating",
  "duplicate plates",
].join(", ");

// ── Parse args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flagValue = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const cuisineFilter = flagValue("cuisine");
const idsFilter = flagValue("ids")?.split(",").map((id) => id.trim()).filter(Boolean) || [];
const startIdx = parseInt(flagValue("start") || "0", 10);
const countLimit = parseInt(flagValue("count") || "0", 10);
const contentOnly = hasFlag("content-only");
const imagesOnly = hasFlag("images-only");

// ── Load dish database ─────────────────────────────────────────────
const DB_FILE = join(import.meta.dirname, "dish-database.mjs");
if (!existsSync(DB_FILE)) {
  console.error(`Dish database not found: ${DB_FILE}`);
  console.error("Run the 1000-dish compilation first.");
  process.exit(1);
}

const dbContent = readFileSync(DB_FILE, "utf-8");
const dishesMatch = dbContent.match(/export const dishes = (\[[\s\S]*\]);?\s*$/m);
if (!dishesMatch) {
  console.error("Could not parse dishes array from database file");
  process.exit(1);
}
const allDishes = eval(dishesMatch[1]);

// Filter dishes
let dishes = allDishes;
if (cuisineFilter) dishes = dishes.filter(d => d.cuisine === cuisineFilter);
if (idsFilter.length > 0) dishes = dishes.filter(d => idsFilter.includes(d.id));
if (countLimit > 0) dishes = dishes.slice(startIdx, startIdx + countLimit);
else if (startIdx > 0) dishes = dishes.slice(startIdx);

console.log(`\n🍽️  Dish Content + Image Generator`);
console.log(`   Total dishes in DB: ${allDishes.length}`);
console.log(`   Selected: ${dishes.length} dishes${cuisineFilter ? ` (${cuisineFilter})` : ""}`);
console.log(`   Mode: ${contentOnly ? "content only" : imagesOnly ? "images only" : "content + images"}`);
console.log(`   Model: ${WAN_MODEL}\n`);

// ── Progress tracking ──────────────────────────────────────────────
let progress = {};
if (existsSync(PROGRESS_FILE)) {
  try { progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")); } catch {}
}

function saveProgress() {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Qwen content generation ────────────────────────────────────────
async function generateContent(dish) {
  if (progress[dish.id]?.content && !hasFlag("force")) {
    return progress[dish.id].content;
  }

  const prompt = `You are a professional food writer creating a dish knowledge card for a menu translation app.

Given this dish:
- English name: ${dish.name_en}
- Original name: ${dish.name_original}
- Chinese name: ${dish.name_zh}
- Cuisine: ${dish.cuisine}
- Category: ${dish.category}

Generate a JSON object with these fields (ALL descriptions in Chinese 中文):

{
  "description_zh": "25-50字中文描述：主食材+烹饪方式+口感+风味特征",
  "description_en": "English description: main ingredients + cooking method + taste/texture, 15-30 words",
  "recommendation_zh": "20-30字中文推荐理由：什么人适合点这道菜",
  "recommendation_en": "Who should order this and why, 10-20 words",
  "good_for_zh": "10-20字中文：适合的用餐场景（前菜/主菜/分享/独食/配菜）",
  "caution_zh": "10-20字中文注意事项（油腻/过敏原/分量/辣度）",
  "ingredients": ["主要食材1", "主要食材2", ...],
  "allergens": ["过敏原1", ...],
  "taste_profile": ["口感标签1", "口感标签2", ...],
  "calories": 大约卡路里数字,
  "spice_level": 0-5数字,
  "reviews": [
    {"rating": 4或5, "content": "15-25字中文好评：具体夸了什么"},
    {"rating": 3或4, "content": "15-25字中文中评或另一种好评"}
  ]
}

Taste profile tags: 鲜香/浓郁/清淡/酸甜/辣/酥脆/软糯/清爽/烟熏/奶香/咸鲜/甜/苦/酸/鲜/嫩/脆/糯/滑/弹
Allergen tags: 牛奶/鸡蛋/花生/坚果/海鲜/贝类/鱼/大豆/小麦/芝麻/甲壳类

Output ONLY the JSON object, no markdown fences.`;

  const res = await fetch(`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen-plus",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.4,
    }),
  });

  if (!res.ok) throw new Error(`Qwen content failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  let text = data.choices?.[0]?.message?.content || "";

  // Clean markdown fences
  text = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");

  try {
    const content = JSON.parse(text);
    progress[dish.id] = progress[dish.id] || {};
    progress[dish.id].content = content;
    saveProgress();
    return content;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const content = JSON.parse(match[0]);
      progress[dish.id] = progress[dish.id] || {};
      progress[dish.id].content = content;
      saveProgress();
      return content;
    }
    throw new Error(`Content parse failed for ${dish.id}: ${text.slice(0, 200)}`);
  }
}

function hashSeed(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildFreeImageUrl(dish, content = {}) {
  const ingredients = Array.isArray(content.ingredients) ? content.ingredients.slice(0, 5).join(", ") : "";
  const prompt = [
    `professional food photography of ${dish.name_en || dish.name_original}`,
    dish.name_zh ? `Chinese dish name ${dish.name_zh}` : "",
    content.description_en || content.description_zh || "",
    ingredients ? `key ingredients: ${ingredients}` : "",
    "realistic restaurant plating, natural light, appetizing, no text, no logo, no watermark",
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 420);
  const params = new URLSearchParams({
    width: "1024",
    height: "1024",
    model: "flux",
    seed: String(hashSeed(dish.id)),
    nologo: "true",
    safe: "true",
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

// ── Wan image generation ───────────────────────────────────────────
async function createImageTask(prompt) {
  const res = await fetch(`${DASHSCOPE_BASE}/services/aigc/text2image/image-synthesis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: WAN_MODEL,
      input: { prompt },
      parameters: {
        size: "1024*1024",
        n: 1,
        negative_prompt: DISH_IMAGE_NEGATIVE_PROMPT,
      },
    }),
  });
  if (!res.ok) throw new Error(`Wan create failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.output?.task_id;
}

async function pollImageTask(taskId) {
  const deadline = Date.now() + POLL_TIMEOUT;
  while (Date.now() < deadline) {
    const res = await fetch(`${DASHSCOPE_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`Wan poll failed (${res.status})`);
    const data = await res.json();
    const status = data.output?.task_status;
    if (status === "SUCCEEDED") return data.output?.results?.[0]?.url;
    if (status === "FAILED") throw new Error(`Wan task failed: ${data.output?.message}`);
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error("Wan poll timeout");
}

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok) return false;
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function generateImage(dish, content) {
  if (progress[dish.id]?.image && !hasFlag("force")) {
    return progress[dish.id].image;
  }

  const ingredients = content?.ingredients?.join(", ") || "";
  const name = dish.name_en || dish.name_original;
  const zhName = dish.name_zh || "";

  const prompt = [
    `${name}${zhName ? ` (${zhName})` : ""}`,
    DISH_IMAGE_STYLE_SPEC,
    ingredients ? `key ingredients: ${ingredients}` : "",
  ].filter(Boolean).join(", ");

  const taskId = await createImageTask(prompt);
  const imageUrl = await pollImageTask(taskId);
  if (!imageUrl) return null;

  const localPath = join(OUT_DIR, `${dish.id}.png`);
  await downloadImage(imageUrl, localPath);

  const imagePath = `/dishes/${dish.id}.png`;
  progress[dish.id] = progress[dish.id] || {};
  progress[dish.id].image = imagePath;
  saveProgress();
  return imagePath;
}

// ── Batch runner with concurrency ──────────────────────────────────
async function runBatch(items, fn, concurrency, label) {
  let idx = 0;
  let running = 0;
  let completed = 0;
  let failed = 0;

  return new Promise((resolve) => {
    function next() {
      while (running < concurrency && idx < items.length) {
        const item = items[idx++];
        running++;
        fn(item, idx - 1)
          .then(() => {
            completed++;
            if (completed % 10 === 0) {
              console.log(`  ${label}: ${completed}/${items.length} done, ${failed} failed`);
            }
          })
          .catch((err) => {
            failed++;
            console.error(`  ${label} failed [${item.id || item.dish?.id}]: ${err.message}`);
          })
          .finally(() => {
            running--;
            if (idx >= items.length && running === 0) resolve();
            else next();
          });
      }
      if (items.length === 0) resolve();
    }
    next();
  });
}

// ── Output final JSON database ─────────────────────────────────────
function outputDatabase() {
  const entries = [];
  for (const dish of allDishes) {
    const p = progress[dish.id];
    if (!p?.content && !p?.image) continue;

    const c = p.content || {};
    const img = p.image || buildFreeImageUrl(dish, c);

    entries.push({
      id: dish.id,
      names: [dish.name_original, dish.name_en, dish.name_zh].filter(Boolean),
      cuisine: dish.cuisine,
      category: dish.category,
      description: { zh: c.description_zh || "", en: c.description_en || "" },
      recommendation: { zh: c.recommendation_zh || "", en: c.recommendation_en || "" },
      good_for: c.good_for_zh || "",
      caution: c.caution_zh || "",
      ingredients: c.ingredients || [],
      allergens: c.allergens || [],
      taste_profile: c.taste_profile || [],
      calories: c.calories || null,
      spice_level: c.spice_level ?? null,
      reviews: c.reviews || [],
      card: img,
      hero: img,
    });
  }

  writeFileSync(JSON_OUT, JSON.stringify(entries));
  console.log(`\n✅ Database written to ${JSON_OUT}`);
  console.log(`   ${entries.length} entries, ${(JSON.stringify(entries).length / 1024).toFixed(0)}KB`);
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Phase 1: Generate content
  if (!imagesOnly) {
    console.log(`\n📝 Phase 1: Generating rich content for ${dishes.length} dishes...`);
    const contentItems = dishes.map(d => ({ dish: d, id: d.id }));
    await runBatch(
      contentItems,
      async ({ dish }) => {
        await generateContent(dish);
      },
      CONTENT_CONCURRENCY,
      "Content"
    );
    console.log(`✅ Content generation complete`);
  }

  // Phase 2: Generate images
  if (!contentOnly) {
    console.log(`\n🎨 Phase 2: Generating AI images for ${dishes.length} dishes...`);
    const imageItems = dishes.map(d => ({
      dish: d,
      id: d.id,
      content: progress[d.id]?.content,
    }));
    await runBatch(
      imageItems,
      async ({ dish, content }) => {
        await generateImage(dish, content);
      },
      IMAGE_CONCURRENCY,
      "Image"
    );
    console.log(`✅ Image generation complete`);
  }

  // Phase 3: Output database
  outputDatabase();

  console.log(`\n✨ All done!`);
  console.log(`   Progress saved to: ${PROGRESS_FILE}`);
  console.log(`   Images saved to: ${OUT_DIR}`);
  console.log(`   Database output: ${JSON_OUT}`);
}

main().catch(console.error);
