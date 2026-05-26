// AI provider selector: Qwen (Alibaba) > DeepSeek > Gemini (Google) > Ollama (local)

function provider(): "qwen" | "deepseek" | "gemini" | "ollama" {
  if (process.env.QWEN_API_KEY) return "qwen";
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "ollama";
}

let _mod: typeof import("./qwen") | typeof import("./deepseek") | typeof import("./gemini") | typeof import("./ollama") | null = null;

async function load() {
  if (_mod) return _mod;
  const p = provider();
  if (p === "qwen") _mod = await import("./qwen");
  else if (p === "deepseek") _mod = await import("./deepseek");
  else if (p === "gemini") _mod = await import("./gemini");
  else _mod = await import("./ollama");
  return _mod;
}

export async function analyzeMenuImage(base64Image: string, rich?: boolean, mimeType?: string) {
  return (await load()).analyzeMenuImage(base64Image, rich, mimeType);
}

export async function refineTranslation(dish: {
  name_original: string;
  name_translated: string;
  description: string;
  source_language: string;
}) {
  return (await load()).refineTranslation(dish);
}

export async function summarizeReviews(
  dishName: string,
  reviews: Array<{ rating: number; content: string }>
) {
  return (await load()).summarizeReviews(dishName, reviews);
}

export async function moderateReview(text: string) {
  return (await load()).moderateReview(text);
}

// Pure utility — works regardless of provider
export { hasChinese } from "./qwen";
