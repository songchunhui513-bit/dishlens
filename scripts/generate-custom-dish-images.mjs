#!/usr/bin/env node
// Generate curated local dish images that are not yet in the 1022-entry database.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const envPath = join(import.meta.dirname, "..", ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

const API_KEY = process.env.QWEN_API_KEY;
if (!API_KEY) {
  console.error("QWEN_API_KEY not set");
  process.exit(1);
}

const WAN_MODEL = process.env.WAN_MODEL || "wanx2.1-t2i-turbo";
const DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1";
const OUT_DIR = join(import.meta.dirname, "..", "public", "dishes");

const STYLE_SPEC = [
  "realistic restaurant food photography",
  "accurate ingredients and plating for the named dish",
  "single finished dish as the main subject",
  "45-degree overhead angle, warm natural light, white or neutral ceramic plate",
  "crisp appetizing texture, food magazine quality, high detail",
  "clean composition, no text, no logo, no watermark, no hands, no people, no menu",
].join(", ");

const NEGATIVE_PROMPT = [
  "text",
  "logo",
  "watermark",
  "menu",
  "hands",
  "people",
  "cartoon",
  "illustration",
  "wrong ingredients",
  "duplicate plates",
].join(", ");

const CUSTOM_DISHES = [
  {
    id: "pizza-genovese",
    prompt: [
      "Pizza Genovese, Italian pizza with basil pesto, Fior di latte mozzarella, Grana Padano shavings",
      STYLE_SPEC,
      "visible green pesto, melted mozzarella, thin blistered crust",
    ].join(", "),
  },
];

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
      parameters: { size: "1024*1024", n: 1, negative_prompt: NEGATIVE_PROMPT },
    }),
  });
  if (!res.ok) throw new Error(`Wan create failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.output?.task_id;
}

async function pollImageTask(taskId) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${DASHSCOPE_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`Wan poll failed (${res.status})`);
    const data = await res.json();
    const status = data.output?.task_status;
    if (status === "SUCCEEDED") return data.output?.results?.[0]?.url;
    if (status === "FAILED") throw new Error(`Wan task failed: ${data.output?.message}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Wan poll timeout");
}

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

mkdirSync(OUT_DIR, { recursive: true });

for (const dish of CUSTOM_DISHES) {
  const out = join(OUT_DIR, `${dish.id}.png`);
  if (existsSync(out) && !process.argv.includes("--force")) {
    console.log(`skip existing ${dish.id}`);
    continue;
  }
  console.log(`generating ${dish.id}`);
  const taskId = await createImageTask(dish.prompt);
  const imageUrl = await pollImageTask(taskId);
  await downloadImage(imageUrl, out);
  console.log(`saved ${out}`);
}
