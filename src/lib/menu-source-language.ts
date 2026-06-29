type SourceLanguageInput = {
  metadata?: {
    source_language?: string;
    restaurant?: {
      display_name?: string;
      restaurant_type?: string;
    };
  };
  pages?: Array<{
    page_label?: string;
    dishes?: unknown[];
  }>;
};

const LANGUAGE_EVIDENCE: Record<string, RegExp[]> = {
  it: [
    /\bpizzeria\b/i,
    /\btrattoria\b/i,
    /\bpecora\b/i,
    /\bmargherita\b/i,
    /\bdiavola\b/i,
    /\bgenovese\b/i,
    /\bmarinara\b/i,
    /\bfior\s+di\s+latte\b/i,
    /\bsalame\b/i,
    /\bbasilico\b/i,
    /\bespresso\b/i,
    /\bcappuccino\b/i,
  ],
  fr: [
    /\bbistrot?\b/i,
    /\bbrasserie\b/i,
    /\bfromage\b/i,
    /\bescargots?\b/i,
    /\bjambon\b/i,
    /\bbonjour\b/i,
    /\bs['’]il vous plaît\b/i,
  ],
};

export function resolveMenuSourceLanguage(result: SourceLanguageInput | null | undefined): string {
  const current = result?.metadata?.source_language || "";
  if (!result) return current;

  const text = [
    result.metadata?.restaurant?.display_name,
    result.metadata?.restaurant?.restaurant_type,
    ...(result.pages || []).flatMap((page) => [
      page.page_label,
      ...(page.dishes || []).flatMap((dish) => {
        const record = typeof dish === "object" && dish ? dish as Record<string, unknown> : {};
        return [
          stringifyEvidence(record.name_original),
          stringifyEvidence(record.name_translated),
          stringifyEvidence(record.description),
          stringifyEvidence(record.ingredients),
          stringifyEvidence(record.taste_profile),
          stringifyEvidence(record.category),
          stringifyEvidence(record.cuisine_region),
        ];
      }),
    ]),
  ].filter(Boolean).join(" ");

  if (!text.trim()) return current;

  let bestLang = current;
  let bestScore = 0;
  for (const [lang, patterns] of Object.entries(LANGUAGE_EVIDENCE)) {
    const score = patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  return bestScore >= 2 ? bestLang : current;
}

function stringifyEvidence(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyEvidence).filter(Boolean).join(" ");
  if (typeof value === "object") return Object.values(value).map(stringifyEvidence).filter(Boolean).join(" ");
  return String(value);
}
