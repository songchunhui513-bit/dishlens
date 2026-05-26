const LEADING_ARTICLES = /^(la|le|les|l|il|lo|gli|i|el|the)\s+/i;
const GENERIC_DISH_WORDS = /\b(pizza|pasta|dish|plate|menu|meal)\b/gi;

export function normalizeDishLookupName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*(?:no\.?|#)?\s*\d{1,3}\s+[\-.)、]?\s*/i, "")
    .replace(/[.·•]{2,}.*$/g, "")
    .replace(/[€$£¥₹]\s*\d+(?:[,.]\d+)?|\d+(?:[,.]\d+)?\s*(?:€|eur|euros?|usd|gbp|元|円|₹)/gi, " ")
    .replace(/[«»"“”'’`´.,;:!?()[\]{}+*/\\|_~^=<>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalDishNameKey(name: string): string {
  return normalizeDishLookupName(name)
    .replace(LEADING_ARTICLES, "")
    .replace(GENERIC_DISH_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function dishNameLookupCandidates(name: string): string[] {
  const normalized = normalizeDishLookupName(name);
  const canonical = canonicalDishNameKey(name);
  const candidates = [
    name.trim(),
    normalized,
    canonical,
    canonical ? `${canonical} pizza` : "",
    canonical ? `pizza ${canonical}` : "",
  ];
  return Array.from(new Set(candidates.filter(Boolean)));
}
