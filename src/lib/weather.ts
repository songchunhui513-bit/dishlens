import { getCachedWeather, setCachedWeather, type WeatherData } from "./local-storage";

async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current_weather=true&timezone=auto`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const data = await res.json();
    const cw = data?.current_weather;
    if (!cw) return null;

    return {
      temperature: cw.temperature,
      weatherCode: cw.weathercode,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const today = new Date().toISOString().slice(0, 10);

  // Check cache first
  const cached = getCachedWeather(today);
  if (cached) return cached;

  // Fetch fresh
  const weather = await fetchWeather(lat, lon);
  if (weather) setCachedWeather(today, weather);

  return weather;
}

export function getPosition(): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 300_000 }
    );
  });
}

// Reverse geocode to get country code (lightweight, no API key)
export async function getCountryCode(lat: number, lon: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
      {
        headers: { "User-Agent": "DishLens/1.0" },
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.address?.country_code ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
