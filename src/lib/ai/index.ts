// AI provider selector with per-request fallback.

type ProviderName = "qwen" | "deepseek" | "gemini" | "ollama";
type ProviderModule =
  | typeof import("./qwen")
  | typeof import("./deepseek")
  | typeof import("./gemini")
  | typeof import("./ollama");

const modules = new Map<ProviderName, ProviderModule>();

function hasProviderConfig(provider: ProviderName): boolean {
  if (provider === "qwen") return Boolean(process.env.QWEN_API_KEY);
  if (provider === "deepseek") return Boolean(process.env.DEEPSEEK_API_KEY);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  return Boolean(process.env.OLLAMA_BASE_URL);
}

function providerOrder(): ProviderName[] {
  const configured = (process.env.MENU_AI_PROVIDER || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ProviderName => ["qwen", "deepseek", "gemini", "ollama"].includes(item));
  const defaults: ProviderName[] = ["qwen", "deepseek", "gemini", "ollama"];
  const ordered = [...configured, ...defaults].filter((provider, index, arr) => arr.indexOf(provider) === index);
  const available = ordered.filter(hasProviderConfig);
  return available.length ? available : ["ollama"];
}

async function load(provider: ProviderName): Promise<ProviderModule> {
  const cached = modules.get(provider);
  if (cached) return cached;
  let mod: ProviderModule;
  if (provider === "qwen") mod = await import("./qwen");
  else if (provider === "deepseek") mod = await import("./deepseek");
  else if (provider === "gemini") mod = await import("./gemini");
  else mod = await import("./ollama");
  modules.set(provider, mod);
  return mod;
}

export async function analyzeMenuImage(base64Image: string, rich?: boolean, mimeType?: string, targetLang = "zh") {
  let lastError: unknown = null;
  for (const provider of providerOrder()) {
    try {
      return await (await load(provider)).analyzeMenuImage(base64Image, rich, mimeType, targetLang);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Provider ${provider} failed during menu analysis: ${message}`);
    }
  }
  throw new Error(`All menu AI providers failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function analyzeMenuImageFast(base64Image: string, rich?: boolean, mimeType?: string, targetLang = "zh") {
  let lastError: unknown = null;
  for (const provider of providerOrder()) {
    try {
      const mod = await load(provider);
      const fastAnalyze = "analyzeMenuImageFast" in mod
        ? (mod as typeof import("./qwen")).analyzeMenuImageFast
        : mod.analyzeMenuImage;
      return await fastAnalyze(base64Image, rich, mimeType, targetLang);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Provider ${provider} failed during fast menu analysis: ${message}`);
    }
  }
  throw new Error(`All fast menu AI providers failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function refineTranslation(dish: {
  name_original: string;
  name_translated: string;
  description: string;
  source_language: string;
}, targetLang = "zh") {
  let lastError: unknown = null;
  for (const provider of providerOrder()) {
    try {
      return await (await load(provider)).refineTranslation(dish, targetLang);
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Provider ${provider} failed during translation refinement: ${message}`);
    }
  }
  throw new Error(`All text AI providers failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function summarizeReviews(
  dishName: string,
  reviews: Array<{ rating: number; content: string }>
) {
  return (await load(providerOrder()[0])).summarizeReviews(dishName, reviews);
}

export async function moderateReview(text: string) {
  return (await load(providerOrder()[0])).moderateReview(text);
}

// Pure utility — works regardless of provider
export { hasChinese } from "./qwen";
