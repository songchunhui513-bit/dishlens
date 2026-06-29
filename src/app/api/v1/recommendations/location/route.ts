import { NextRequest, NextResponse } from "next/server";
import { chooseLocationProvider, getLocationRecommendation } from "@/lib/location-recommendation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const country = searchParams.get("country");
  const locale = searchParams.get("locale") === "en" ? "en" : "zh";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ restaurant: null }, { status: 400 });
  }

  const env = {
    AMAP_WEB_SERVICE_KEY: process.env.AMAP_WEB_SERVICE_KEY,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  };
  const provider = chooseLocationProvider(country);
  const providerConfigured = provider === "amap" ? Boolean(env.AMAP_WEB_SERVICE_KEY) : Boolean(env.GOOGLE_PLACES_API_KEY);

  if (process.env.NODE_ENV !== "production" && searchParams.get("demo") === "1") {
    const restaurant = provider === "amap"
      ? {
          provider,
          id: "demo-amap-restaurant",
          name: "上海小馆",
          rating: 4.7,
          distanceMeters: 1400,
          distanceLabel: "<2km",
          latitude: lat + 0.006,
          longitude: lon + 0.006,
          address: "附近 · 适合现在用餐",
          navigationUrl: "https://uri.amap.com/navigation?to=121.4797,31.2364,%E4%B8%8A%E6%B5%B7%E5%B0%8F%E9%A6%86&mode=car&policy=1&src=dishlens",
        }
      : {
          provider,
          id: "demo-google-restaurant",
          name: "Maison Champignon",
          rating: 4.8,
          distanceMeters: 1600,
          distanceLabel: "<2km",
          latitude: lat + 0.006,
          longitude: lon + 0.006,
          address: "Nearby · good for this meal",
          navigationUrl: "https://www.google.com/maps/dir/?api=1&destination=48.8626%2C2.3582&destination_place_id=&travelmode=walking",
        };
    return NextResponse.json({ restaurant, provider, providerConfigured: true, demo: true });
  }

  const restaurant = await getLocationRecommendation({
    lat,
    lon,
    country,
    locale,
    env,
  });

  return NextResponse.json({
    restaurant,
    provider,
    providerConfigured,
  });
}
