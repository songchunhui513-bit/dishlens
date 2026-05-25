export interface DishKnowledgeEntry {
  id: string;
  names: string[];
  cuisine: string;
  category: string;
  description: { zh: string; en: string };
  recommendation: { zh: string; en: string };
  good_for: string;
  caution: string;
  ingredients: string[];
  allergens: string[];
  taste_profile: string[];
  calories: number | null;
  spice_level: number | null;
  reviews: Array<{ rating: number; content: string }>;
  card: string;
  hero: string;
}
