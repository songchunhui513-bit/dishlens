"use client";

import { useState, useEffect } from "react";
import { getDailyRecommendation, type RecommendationContext } from "@/lib/recommendation";
import { getWeather, getPosition, getCountryCode } from "@/lib/weather";
import { getCachedRecommendation, setCachedRecommendation } from "@/lib/local-storage";
import type { DishKnowledgeEntry } from "@/lib/dish-knowledge-types";
import type { RestaurantSource } from "@/lib/location-recommendation";

export function useDailyRecommendation(uiLang: "zh" | "en" = "zh") {
  const [dish, setDish] = useState<DishKnowledgeEntry | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextLabel, setContextLabel] = useState(() => uiLang === "en" ? "Recommended for now" : "按当前时段推荐");
  const [reason, setReason] = useState(() => uiLang === "en" ? "Picking a good dish for today..." : "正在为你挑选今日好菜…");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) {
        setContextLabel(uiLang === "en" ? "Recommended for now" : "按当前时段推荐");
        setReason(uiLang === "en" ? "Picking a good dish for today..." : "正在为你挑选今日好菜…");
      }

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);

      // Use the cached dish immediately, but still refresh nearby restaurant context.
      const cached = getCachedRecommendation(dateStr);
      if (cached && !cancelled) setDish(cached);

      // Gather context — all optional, graceful degradation
      let temperature: number | undefined;
      let country: string | undefined;
      let placeLabel = "";
      let nearbyRestaurant: RestaurantSource | null = null;

      try {
        const demoMode = isLocationRecommendationDemo();
        const browserPosition = await getPosition().catch(() => null);
        const pos = browserPosition || (demoMode ? { lat: 48.8566, lon: 2.3522 } : null);
        if (pos && !cancelled) {
          const [weather, countryCode] = await Promise.all([
            getWeather(pos.lat, pos.lon),
            getCountryCode(pos.lat, pos.lon),
          ]);
          if (weather) temperature = weather.temperature;
          const resolvedCountry = countryCode || (demoMode ? "FR" : "");
          if (resolvedCountry) {
            country = resolvedCountry.toUpperCase();
            placeLabel = country;
          }
          nearbyRestaurant = await fetchNearbyRestaurant(pos.lat, pos.lon, country, uiLang);
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

      const recommended = cached || await getDailyRecommendation(ctx);
      if (!cached) setCachedRecommendation(dateStr, recommended);

      if (!cancelled) {
        setDish(recommended);
        setRestaurant(nearbyRestaurant);
        const timeLabel = getTimeLabel(now.getHours(), uiLang);
        const weatherLabel = temperature == null ? (uiLang === "en" ? "Unknown weather" : "天气未知") : `${temperature}°C`;
        setContextLabel(`${timeLabel} · ${weatherLabel}${placeLabel ? ` · ${placeLabel}` : ""}`);
        setReason(buildReason(recommended, temperature, now.getHours(), uiLang, nearbyRestaurant));
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [uiLang]);

  return { dish, restaurant, loading, contextLabel, reason };
}

function getTimeLabel(hour: number, uiLang: "zh" | "en"): string {
  if (uiLang === "en") {
    if (hour >= 6 && hour < 10) return "Morning";
    if (hour >= 10 && hour < 15) return "Midday";
    if (hour >= 15 && hour < 18) return "Afternoon tea";
    return "Dinner";
  }
  if (hour >= 6 && hour < 10) return "早间";
  if (hour >= 10 && hour < 15) return "午间";
  if (hour >= 15 && hour < 18) return "下午茶";
  return "晚餐";
}

async function fetchNearbyRestaurant(lat: number, lon: number, country: string | undefined, uiLang: "zh" | "en"): Promise<RestaurantSource | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      locale: uiLang,
    });
    if (country) params.set("country", country);
    if (isLocationRecommendationDemo()) {
      params.set("demo", "1");
    }
    const res = await fetch(`/api/v1/recommendations/location?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.restaurant || null;
  } catch {
    return null;
  }
}

function isLocationRecommendationDemo(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("location-rec-demo") === "1";
}

function buildReason(dish: DishKnowledgeEntry, temperature: number | undefined, hour: number, uiLang: "zh" | "en", restaurant?: RestaurantSource | null): string {
  if (restaurant) {
    const distance = restaurant.distanceLabel ? `${restaurant.distanceLabel} · ` : "";
    if (uiLang === "en") {
      return `${distance}${restaurant.name} is nearby and well suited for this moment, so DishLens picked a dish that fits its style.`;
    }
    return `${distance}${restaurant.name}离你比较近，也适合现在用餐，优先推荐这家店里更值得尝试的一道菜。`;
  }
  if (uiLang === "en") {
    const enName = dish.names.find((name) => !/[一-鿿]/.test(name)) || dish.names[0] || "this dish";
    if (temperature != null && temperature < 10) {
      return `It is chilly today, and ${enName} has a warming, comforting profile that fits the moment.`;
    }
    if (temperature != null && temperature > 28) {
      return `It is warm today, and ${enName} feels lighter and easier to enjoy right now.`;
    }
    if (hour >= 15 && hour < 18 && dish.category === "dessert") {
      return `For a relaxed afternoon bite, ${enName} works well with coffee or tea.`;
    }
    return dish.recommendation.en || `This is a good time to try ${enName}. ${dish.description.en}`;
  }
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
