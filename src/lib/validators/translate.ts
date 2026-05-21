import { z } from "zod";

export const DishSchema = z.object({
  name_original: z.string(),
  name_translated: z.string(),
  description: z.string(),
  ingredients: z.array(z.string()),
  allergens: z.array(z.string()),
  taste_profile: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const TranslateRequestSchema = z.object({
  target_lang: z.string().default("zh"),
  dietary: z.array(z.string()).default([]),
  user_allergens: z.array(z.string()).default([]),
});

export const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().min(10).max(500),
  photos: z.array(z.string()).default([]),
});

export type DishData = z.infer<typeof DishSchema>;
