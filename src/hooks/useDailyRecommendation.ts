"use client";

import { useState, useEffect } from "react";
import { getDailyRecommendation, type RecommendationContext } from "@/lib/recommendation";
import { getWeather, getPosition, getCountryCode } from "@/lib/weather";
import { getCachedRecommendation, setCachedRecommendation } from "@/lib/local-storage";
import type { DishKnowledgeEntry } from "@/lib/dish-knowledge-types";

export function useDailyRecommendation() {
  const [dish, setDish] = useState<DishKnowledgeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextLabel, setContextLabel] = useState("按当前时段推荐");
  const [reason, setReason] = useState("正在为你挑选今日好菜…");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);

      // Check localStorage cache
      const cached = getCachedRecommendation(dateStr);
      if (cached) {
        if (!cancelled) {
          setDish(cached);
          setLoading(false);
        }
        return;
      }

      // Gather context — all optional, graceful degradation
      let temperature: number | undefined;
      let country: string | undefined;
      let placeLabel = "";

      try {
        const pos = await getPosition();
        if (pos && !cancelled) {
          const [weather, countryCode] = await Promise.all([
            getWeather(pos.lat, pos.lon),
            getCountryCode(pos.lat, pos.lon),
          ]);
          if (weather) temperature = weather.temperature;
          if (countryCode) {
            country = countryCode.toUpperCase();
            placeLabel = country;
          }
        }
      } catch {
        // Silently degrade
      }

      if (cancelled) return;

      const ctx: RecommendationContext = {
        hour: now.getHours(),
        dayOfWeek: now.getDay(),
        dateStr,
        temperature,
        country,
      };

      const recommended = await getDailyRecommendation(ctx);
      setCachedRecommendation(dateStr, recommended);

      if (!cancelled) {
        setDish(recommended);
        const timeLabel = getTimeLabel(now.getHours());
        const weatherLabel = temperature == null ? "天气未知" : `${temperature}°C`;
        setContextLabel(`${timeLabel} · ${weatherLabel}${placeLabel ? ` · ${placeLabel}` : ""}`);
        setReason(buildReason(recommended, temperature, now.getHours()));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { dish, loading, contextLabel, reason };
}

function getTimeLabel(hour: number): string {
  if (hour >= 6 && hour < 10) return "早间";
  if (hour >= 10 && hour < 15) return "午间";
  if (hour >= 15 && hour < 18) return "下午茶";
  return "晚餐";
}

function buildReason(dish: DishKnowledgeEntry, temperature: number | undefined, hour: number): string {
  const zhName = dish.names.find((name) => /[一-鿿]/.test(name)) || dish.names[0] || "这道菜";
  const taste = dish.taste_profile.slice(0, 2).join("、");
  if (temperature != null && temperature < 10) {
    return `天气偏冷，${zhName}的${taste || "温暖浓郁"}风味更适合暖胃，也适合作为今天的稳妥选择。`;
  }
  if (temperature != null && temperature > 28) {
    return `天气偏热，${zhName}相对清爽开胃，适合现在点来降低用餐负担。`;
  }
  if (hour >= 15 && hour < 18 && dish.category === "dessert") {
    return `下午想要一点轻松甜味，${zhName}适合与咖啡或茶一起分享。`;
  }
  return dish.recommendation.zh || `现在这个时段适合点${zhName}，${dish.description.zh}`;
}
