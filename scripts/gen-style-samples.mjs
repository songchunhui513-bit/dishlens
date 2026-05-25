#!/usr/bin/env node
// Generate style sample images for user to compare
// Usage: node scripts/gen-style-samples.mjs

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
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

const MODEL = process.env.WAN_MODEL || "wanx2.1-t2i-turbo";
const OUT_DIR = join(import.meta.dirname, "..", "public", "dishes", "style-samples");

const styles = [
  {
    id: "style-a",
    name: "专业美食摄影",
    prompt: "Foie Gras, professional food photography, 45-degree overhead angle, warm natural light, white minimalist plate, shallow depth of field, restaurant plating, garnish with fig and brioche toast, HD detail, food magazine cover quality",
  },
  {
    id: "style-b",
    name: "暗调质感",
    prompt: "Foie Gras, dark moody food photography, top-down flat lay, dark slate plate, dramatic side lighting, deep shadows, black background, charcoal grilled marks, luxury dining atmosphere, cinematic food styling, michelin star presentation",
  },
  {
    id: "style-c",
    name: "明亮清新",
    prompt: "Foie Gras, bright clean food photography, overhead view, white marble table, soft diffused daylight, fresh herbs garnish, light and airy aesthetic, pastel color palette, modern healthy eating style, minimal clean composition",
  },
  {
    id: "style-d",
    name: "中式美食海报",
    prompt: "鹅肝酱，精致中式美食摄影，俯拍45度，暖色调灯光，深色陶瓷盘，点缀鲜花和金箔，国宴级摆盘，浅景深，高清细节，中国风美食杂志风格",
  },
];

async function createTask(prompt) {
  const res = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: MODEL,
      input: { prompt },
      parameters: { size: "1024*1024", n: 1 },
    }),
  });
  if (!res.ok) throw new Error(`Create failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.output?.task_id;
}

async function pollTask(taskId) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const res = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`Poll failed (${res.status})`);
    const data = await res.json();
    const status = data.output?.task_status;
    if (status === "SUCCEEDED") return data.output?.results?.[0]?.url;
    if (status === "FAILED") throw new Error(`Task failed: ${data.output?.message}`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("Poll timeout");
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) return false;
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return true;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n🎨 Generating style samples for Foie Gras...`);
  console.log(`📐 Model: ${MODEL}\n`);

  for (const style of styles) {
    const outPath = join(OUT_DIR, `${style.id}.png`);
    if (existsSync(outPath)) {
      console.log(`⏭️  ${style.name} → already exists`);
      continue;
    }

    try {
      console.log(`⏳ ${style.name} — submitting task...`);
      const taskId = await createTask(style.prompt);
      console.log(`   Task ID: ${taskId}`);
      const imageUrl = await pollTask(taskId);
      if (imageUrl) {
        await downloadFile(imageUrl, outPath);
        console.log(`   ✅ saved to ${outPath}`);
      }
    } catch (err) {
      console.error(`   ❌ ${style.name} failed: ${err.message}`);
    }
  }

  console.log(`\n✨ Done! Check public/dishes/style-samples/ for results.`);
  console.log(`Open in browser to compare styles:\n`);
  for (const s of styles) {
    console.log(`  ${s.id}: ${s.name}`);
  }
}

main().catch(console.error);
