const DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1";
const WAN_MODEL = process.env.WAN_MODEL || "wanx2.1-t2i-turbo";
const IMAGE_PROVIDER = process.env.IMAGE_PROVIDER || "wan";
const POLL_INTERVAL = 3000;
const POLL_TIMEOUT = 60_000;

function getApiKey(): string {
  const key = process.env.QWEN_API_KEY || "";
  if (!key) throw new Error("QWEN_API_KEY is required for image generation");
  return key;
}

function buildPrompt(dish: {
  name_original: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
}): string {
  const translated = typeof dish.name_translated === "string"
    ? dish.name_translated
    : (dish.name_translated as Record<string, string>)?.zh || "";
  const name = translated || dish.name_original;
  const desc = typeof dish.description === "string"
    ? dish.description
    : (dish.description as Record<string, string>)?.zh || "";
  const parts = [
    `专业美食摄影，${name}`,
    dish.name_original !== name ? `（${dish.name_original}）` : "",
    "俯拍45度角度",
    dish.ingredients?.length ? `，主食材：${dish.ingredients.join("、")}` : "",
    desc ? `，${desc}` : "",
    "，自然光，餐厅级摆盘，白色或深色简约餐盘，浅景深，菜品居中构图，高清细节",
  ];
  return parts.join("");
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function buildFreeImageUrl(dish: {
  name_original: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
}): string {
  const prompt = `${buildPrompt(dish)}，realistic food photo, no text, no logo, no watermark`.slice(0, 420);
  const params = new URLSearchParams({
    width: "1024",
    height: "1024",
    model: "flux",
    seed: String(hashSeed(dish.name_original)),
    nologo: "true",
    safe: "true",
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

interface WanTaskResult {
  url: string;
}

async function createTask(prompt: string): Promise<string> {
  const res = await fetch(`${DASHSCOPE_BASE}/services/aigc/text2image/image-synthesis`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${getApiKey()}`,
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: WAN_MODEL,
      input: { prompt },
      parameters: { size: "1024*1024", n: 1 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wan createTask failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const taskId = data.output?.task_id;
  if (!taskId) throw new Error(`Wan createTask returned no task_id: ${JSON.stringify(data)}`);
  return taskId;
}

async function pollTask(taskId: string): Promise<WanTaskResult | null> {
  const deadline = Date.now() + POLL_TIMEOUT;

  while (Date.now() < deadline) {
    const res = await fetch(`${DASHSCOPE_BASE}/tasks/${taskId}`, {
      headers: { "Authorization": `Bearer ${getApiKey()}` },
    });

    if (!res.ok) {
      throw new Error(`Wan pollTask failed (${res.status})`);
    }

    const data = await res.json();
    const status: string = data.output?.task_status;

    if (status === "SUCCEEDED") {
      const url = data.output?.results?.[0]?.url;
      if (!url) throw new Error("Wan succeeded but no URL in response");
      return { url };
    }

    if (status === "FAILED") {
      const msg = data.output?.message || "unknown error";
      console.error(`Wan task ${taskId} failed: ${msg}`);
      return null;
    }

    // PENDING or RUNNING — wait and retry
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }

  console.error(`Wan task ${taskId} timed out after ${POLL_TIMEOUT}ms`);
  return null;
}

export async function generateDishImage(dish: {
  name_original: string;
  name_translated?: string | Record<string, string>;
  description?: string | Record<string, string>;
  ingredients?: string[];
}): Promise<string | null> {
  if (IMAGE_PROVIDER === "pollinations") {
    return buildFreeImageUrl(dish);
  }

  try {
    const prompt = buildPrompt(dish);
    const taskId = await createTask(prompt);
    const result = await pollTask(taskId);
    return result?.url || buildFreeImageUrl(dish);
  } catch (err) {
    console.error("generateDishImage error:", err);
    return null;
  }
}

export async function generateImagesForDishes(
  dishes: Array<{
    id?: string;
    name_original: string;
    name_translated?: string | Record<string, string>;
    description?: string | Record<string, string>;
    ingredients?: string[];
    ai_image_url?: string | null;
  }>,
  onImageReady?: (index: number, url: string) => void,
  concurrency = 3,
): Promise<void> {
  const queue = dishes
    .map((dish, i) => ({ dish, index: i }))
    .filter(({ dish }) => !dish.ai_image_url);

  let running = 0;
  let idx = 0;

  await new Promise<void>((resolve) => {
    function next() {
      while (running < concurrency && idx < queue.length) {
        const item = queue[idx++];
        running++;
        generateDishImage(item.dish)
          .then((url) => {
            if (url && onImageReady) onImageReady(item.index, url);
          })
          .catch(() => {})
          .finally(() => {
            running--;
            if (queue.length >= idx && running === 0) resolve();
            else next();
          });
      }
      if (queue.length === 0 || (idx >= queue.length && running === 0)) resolve();
    }
    next();
  });
}
