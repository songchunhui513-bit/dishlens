// AI provider selector: Qwen (Alibaba) > Gemini (Google) > Ollama (local)

function provider(): "qwen" | "gemini" | "ollama" {
  if (process.env.QWEN_API_KEY) return "qwen";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "ollama";
}

let _mod: typeof import("./qwen") | typeof import("./gemini") | typeof import("./ollama") | null = null;

async function load() {
  if (_mod) return _mod;
  const p = provider();
  if (p === "qwen") _mod = await import("./qwen");
  else if (p === "gemini") _mod = await import("./gemini");
  else _mod = await import("./ollama");
  return _mod;
}

export async function analyzeMenuImage(base64Image: string) {
  return (await load()).analyzeMenuImage(base64Image);
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
