"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import HomePage from "@/components/home/HomePage";
import CameraPage from "@/components/camera/CameraPage";
import LoadingPage from "@/components/results/LoadingPage";
import ResultsPage from "@/components/results/ResultsPage";
import DishDetailPage from "@/components/dish/DishDetailPage";
import ReviewPage from "@/components/review/ReviewPage";
import ConfirmPage from "@/components/review/ConfirmPage";
import ErrorPage from "@/components/results/ErrorPage";
import HistoryPage from "@/components/history/HistoryPage";
import FavoritesPage from "@/components/favorites/FavoritesPage";
import SettingsPage from "@/components/settings/SettingsPage";
import ShareSheet from "@/components/share/ShareSheet";
import type { CapturedPhoto, Dish, TranslationResult, HistoryEntry, FavoriteDish, UserSettings } from "@/types";
import { createTranslation } from "@/lib/api-client";
import {
  getHistory as getStoredHistory,
  addHistory,
  getFavorites as getStoredFavorites,
  addFavorite,
  removeFavorite,
  isFavorited as checkFavorited,
  getSettings as getStoredSettings,
  setSettings as setStoredSettings,
} from "@/lib/local-storage";
import { useDailyRecommendation } from "@/hooks/useDailyRecommendation";
import { getDishImageUrl } from "@/lib/dish-presentation";
import { buildShareMenuMeta } from "@/lib/share-menu";

// ── Types ───────────────────────────────────────────────────────────

type Screen =
  | "home"
  | "camera"
  | "loading"
  | "results"
  | "detail"
  | "review"
  | "confirm"
  | "history"
  | "favorites"
  | "settings"
  | "error";

// ── AppPhone State Manager ─────────────────────────────────────────

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const latestResultRef = useRef<TranslationResult | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [history, setHistory] = useState<Screen[]>(["home"]);
  const [useMockFallback, setUseMockFallback] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(() => getStoredSettings());

  // localStorage-backed state — init empty on SSR, hydrate on mount
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() =>
    typeof window === "undefined" ? [] : getStoredHistory()
  );
  const [favoritesData, setFavoritesData] = useState<FavoriteDish[]>(() =>
    typeof window === "undefined" ? [] : getStoredFavorites()
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Refresh history from localStorage when returning to home
  useEffect(() => {
    if (screen !== "home") return;
    const frame = window.requestAnimationFrame(() => {
      setHistoryEntries(getStoredHistory());
      setFavoritesData(getStoredFavorites());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen]);

  // Daily recommendation
  const { dish: dailyDish, contextLabel: recommendationContext, reason: recommendationReason } = useDailyRecommendation();
  const shareTaskId = translationResult?.task_id || "";
  const shareMeta = useMemo(() => {
    if (!translationResult || !shareTaskId) return null;
    const origin = typeof window === "undefined" ? undefined : window.location.origin;
    return buildShareMenuMeta(translationResult, origin, shareTaskId);
  }, [shareTaskId, translationResult]);

  // Compute AI image generation progress
  const imageGenProgress = useMemo(() => {
    if (!translationResult?.pages) return undefined;
    const allDishes = translationResult.pages.flatMap((p) => p.dishes || []);
    const total = allDishes.length;
    if (total === 0) return undefined;
    const done = allDishes.filter((d) => {
      const url = d.ai_image_url || (d as { image_url?: string }).image_url;
      return url && !/images\.unsplash\.com|image\.pollinations\.ai|dashscope-result.*aliyuncs\.com/i.test(url);
    }).length;
    return { done, total };
  }, [translationResult]);

  // Save translation to history when result comes in
  const saveToHistory = useCallback((result: TranslationResult) => {
    const pages = Array.isArray(result.pages) ? result.pages : [];
    if (!pages.length) return;
    const firstDish = pages.find((page) => page.dishes?.length)?.dishes?.[0];
    const totalDishes = pages.reduce((sum, p) => sum + (p.dishes?.length || 0), 0);
    if (totalDishes === 0) return;
    const entry: HistoryEntry = {
      id: result.task_id,
      restaurant_name: result.metadata?.source_language
        ? `翻译 #${result.task_id.slice(0, 6)}`
        : "菜单翻译",
      city: "",
      dish_count: result.metadata?.total_dishes || 0,
      page_count: pages.length,
      date: new Date().toISOString(),
      thumbnail: firstDish ? getDishImageUrl(firstDish) : "",
      source_lang: result.metadata?.source_language || "",
      target_lang: settings.targetLang,
      result_summary: result,
    };
    addHistory(entry);
    setHistoryEntries(getStoredHistory());
  }, [settings.targetLang]);

  // Favorite toggle handler
  const handleToggleFavorite = useCallback((dishId: string, faved: boolean) => {
    if (faved) {
      // Find dish data from current context
      let dishToAdd: FavoriteDish | null = null;

      // Check selectedDish first
      if (selectedDish?.id === dishId) {
        dishToAdd = {
          id: selectedDish.id,
          name_original: selectedDish.name_original,
          name_zh: selectedDish.name_translated?.zh || selectedDish.name_original,
          cuisine: selectedDish.cuisine_region || selectedDish.category || "",
          image_url: getDishImageUrl(selectedDish),
          saved_at: new Date().toISOString(),
        };
      }

      // Check translation result dishes
      if (!dishToAdd && translationResult) {
        for (const page of translationResult.pages) {
          const found = page.dishes.find((d) => d.id === dishId);
          if (found) {
            dishToAdd = {
              id: found.id,
              name_original: found.name_original,
              name_zh: found.name_translated?.zh || found.name_original,
              cuisine: found.cuisine_region || found.category || "",
              image_url: getDishImageUrl(found),
              saved_at: new Date().toISOString(),
            };
            break;
          }
        }
      }

      if (dishToAdd) {
        addFavorite(dishToAdd);
      }
    } else {
      removeFavorite(dishId);
    }
    setFavoritesData(getStoredFavorites());
  }, [selectedDish, translationResult]);

  // Navigation with back stack
  const navigate = useCallback(
    (to: string, direction?: string, ctx?: unknown) => {
      if (direction === "back") {
        setHistory((h) => h.slice(0, -1));
        const prev = history[history.length - 2] || "home";
        const validScreens: Screen[] = ["home", "camera", "results", "detail", "review", "history", "favorites", "settings", "error"];
        if (validScreens.includes(prev as Screen)) {
          setScreen(prev as Screen);
        } else {
          setScreen("home");
        }
        return;
      }

      if (ctx && typeof ctx === "object" && "id" in (ctx as Record<string, unknown>)) {
        setSelectedDish(ctx as Dish);
      }

      setHistory((h) => [...h, to as Screen]);
      setScreen(to as Screen);
    },
    [history]
  );

  const handleCapture = useCallback(() => {
    setCapturedPhotos([]);
    setTranslationResult(null);
    setUseMockFallback(false);
    navigate("camera");
  }, [navigate]);

  const handleAnalyze = useCallback(
    async (photos: CapturedPhoto[]) => {
      setCapturedPhotos(photos);
      setTranslationResult(null);
      setUseMockFallback(false);
      navigate("loading");

      const files: File[] = [];
      for (const photo of photos) {
        if (photo.file) {
          files.push(photo.file);
        } else if (photo.dataUrl && photo.dataUrl.startsWith("data:")) {
          const res = await fetch(photo.dataUrl);
          const blob = await res.blob();
          const f = new File([blob], `photo-${photo.timestamp}.jpg`, { type: blob.type || "image/jpeg" });
          files.push(f);
        }
      }

      if (files.length === 0) {
        setUseMockFallback(true);
        return;
      }

      try {
        const preliminary = await createTranslation(files);
        setTranslationResult(preliminary as unknown as TranslationResult);
      } catch {
        setUseMockFallback(true);
      }
    },
    [navigate]
  );

  const handleResultReceived = useCallback((result: Record<string, unknown>) => {
    const nextResult = result as unknown as TranslationResult;
    latestResultRef.current = nextResult;
    setTranslationResult(nextResult);
  }, []);

  const handleLoadingComplete = useCallback(() => {
    const completedResult = latestResultRef.current || translationResult;
    if (completedResult?.pages?.length) saveToHistory(completedResult);
    navigate("results");
  }, [navigate, translationResult, saveToHistory]);

  const handleCancelLoading = useCallback(() => {
    setTranslationResult(null);
    setUseMockFallback(false);
    navigate("home");
  }, [navigate]);

  const handleDishDetail = useCallback(
    (dish: Dish) => {
      setSelectedDish(dish);
      navigate("detail");
    },
    [navigate]
  );

  const handleDailyDishDetail = useCallback(() => {
    if (!dailyDish) return;
    const zhName = dailyDish.names.find((name) => /[一-鿿]/.test(name)) || dailyDish.names[0] || "";
    const enName = dailyDish.names.find((name) => !/[一-鿿]/.test(name)) || dailyDish.names[0] || zhName;
    setSelectedDish({
      id: dailyDish.id,
      name_original: enName,
      name_translated: { zh: zhName, en: enName },
      description: dailyDish.description,
      ingredients: dailyDish.ingredients,
      allergens: dailyDish.allergens,
      taste_profile: dailyDish.taste_profile,
      cuisine_region: dailyDish.cuisine,
      category: dailyDish.category,
      recommendation: dailyDish.recommendation.zh,
      good_for: dailyDish.good_for,
      caution: dailyDish.caution,
      ai_image_url: dailyDish.hero || dailyDish.card,
      image_url: dailyDish.hero || dailyDish.card,
      image_source: "mixed",
      rating_avg: dailyDish.reviews?.[0]?.rating || 4.7,
      review_count: dailyDish.reviews?.length || 0,
    });
    navigate("detail");
  }, [dailyDish, navigate]);

  const handleReview = useCallback(() => {
    navigate("review");
  }, [navigate]);

  const handleReviewConfirm = useCallback(() => {
    navigate("confirm");
  }, [navigate]);

  const handleBackToMenu = useCallback(() => {
    setHistory(["home"]);
    setScreen("home");
  }, []);

  const handleKeepBrowsing = useCallback(() => {
    navigate("results");
  }, [navigate]);

  const handleShareStatus = useCallback((message: string) => {
    setShareNotice(message);
    window.setTimeout(() => setShareNotice(""), 1800);
  }, []);

  const handleShareMenu = useCallback(() => {
    if (!shareTaskId || !shareMeta) {
      setShareNotice("当前菜单还不能分享");
      window.setTimeout(() => setShareNotice(""), 1800);
      return;
    }
    setShareSheetOpen(true);
  }, [shareMeta, shareTaskId]);

  // Poll for AI-generated images in background while on results screen
  useEffect(() => {
    if ((screen !== "results" && screen !== "detail") || !translationResult?.task_id) return;

    const taskId = translationResult.task_id;
    let active = true;
    let count = 0;
    const MAX_POLLS = 20;
    let lastSyncedImages = 0;

    const poll = async () => {
      if (!active || count >= MAX_POLLS) return;
      count++;

      try {
        const res = await fetch(`/api/v1/task/${taskId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.result?.pages) {
          const newResult = data.result as TranslationResult;
          setTranslationResult((prev) => {
            if (!prev) return newResult;
            let changed = false;
            let imageCount = 0;
            for (let p = 0; p < newResult.pages.length; p++) {
              for (let d = 0; d < (newResult.pages[p].dishes?.length || 0); d++) {
                const newDish = newResult.pages[p].dishes[d];
                const oldDish = prev.pages[p]?.dishes?.[d];
                if (newDish?.ai_image_url) imageCount++;
                if (newDish?.ai_image_url && newDish.ai_image_url !== oldDish?.ai_image_url) {
                  changed = true;
                }
              }
            }
            // Re-save history with updated thumbnails when new images arrive
            if (changed && imageCount > lastSyncedImages) {
              lastSyncedImages = imageCount;
              const firstDish = newResult.pages.find((p) => p.dishes?.length)?.dishes?.[0];
              if (firstDish?.ai_image_url) {
                const entry: HistoryEntry = {
                  id: newResult.task_id,
                  restaurant_name: newResult.metadata?.source_language
                    ? `翻译 #${newResult.task_id.slice(0, 6)}`
                    : "菜单翻译",
                  city: "",
                  dish_count: newResult.metadata?.total_dishes || 0,
                  page_count: newResult.pages.length,
                  date: new Date().toISOString(),
                  thumbnail: getDishImageUrl(firstDish),
                  source_lang: newResult.metadata?.source_language || "",
                  target_lang: settings.targetLang,
                  result_summary: newResult,
                };
                addHistory(entry);
                setHistoryEntries(getStoredHistory());
              }
            }
            return changed ? newResult : prev;
          });
          setSelectedDish((prevDish) => {
            if (!prevDish) return prevDish;
            for (const page of newResult.pages || []) {
              const matched = (page.dishes || []).find((dish) => dish.id === prevDish.id || dish.name_original === prevDish.name_original);
              if (matched?.ai_image_url && matched.ai_image_url !== prevDish.ai_image_url) return matched;
            }
            return prevDish;
          });
        }
      } catch {}

      if (active && count < MAX_POLLS) {
        setTimeout(poll, 5000);
      }
    };

    // Fire immediately on mount/restore to get latest images without delay
    poll();
    return () => {
      active = false;
    };
  }, [screen, settings.targetLang, translationResult?.task_id]);

  // ── Render by screen ──────────────────────────────────────────

  let ScreenComponent: React.ReactNode;

  switch (screen) {
    case "camera":
      ScreenComponent = (
        <CameraPage
          onBack={() => navigate("home", "back")}
          onAnalyze={handleAnalyze}
        />
      );
      break;

    case "loading":
      ScreenComponent = (
        <LoadingPage
          photoCount={capturedPhotos.length || 1}
          taskId={translationResult?.task_id}
          taskStatus={translationResult?.status}
          useMock={useMockFallback}
          onComplete={handleLoadingComplete}
          onCancel={handleCancelLoading}
          onResult={handleResultReceived}
        />
      );
      break;

    case "results":
      ScreenComponent = (
        <ResultsPage
          result={translationResult}
          photoCount={capturedPhotos.length || 3}
          useMock={useMockFallback}
          onBack={() => navigate("home", "back")}
          onDishDetail={handleDishDetail}
          onShare={handleShareMenu}
          showAllergens={settings.showAllergens}
          showVeg={settings.showVeg}
          imageGenProgress={imageGenProgress}
        />
      );
      break;

    case "detail":
      ScreenComponent = (
        <DishDetailPage
          dish={selectedDish}
          onBack={() => navigate("results", "back")}
          onReview={handleReview}
          showAllergens={settings.showAllergens}
          isFavorited={selectedDish ? checkFavorited(selectedDish.id) : false}
          onToggleFavorite={handleToggleFavorite}
          onShare={handleShareMenu}
          imageGenProgress={imageGenProgress}
        />
      );
      break;

    case "review":
      ScreenComponent = (
        <ReviewPage
          dish={selectedDish || undefined}
          onBack={() => navigate("detail", "back")}
          onConfirm={handleReviewConfirm}
        />
      );
      break;

    case "confirm":
      ScreenComponent = (
        <ConfirmPage
          onBackToMenu={handleBackToMenu}
          onKeepBrowsing={handleKeepBrowsing}
        />
      );
      break;

    case "history":
      ScreenComponent = (
        <HistoryPage
          onBack={() => navigate("home", "back")}
          history={historyEntries}
          onSelect={(id) => {
            const entry = historyEntries.find((h) => h.id === id);
            if (entry?.result_summary) {
              setTranslationResult(entry.result_summary);
              navigate("results");
              return;
            }

            // Try to find the dish in translation results
            let foundDish: Dish | null = null;
            if (translationResult) {
              for (const page of translationResult.pages) {
                const d = page.dishes.find((d) => d.id === id);
                if (d) { foundDish = d; break; }
              }
            }
            if (foundDish) {
              setSelectedDish(foundDish);
              navigate("detail");
            }
          }}
        />
      );
      break;

    case "favorites":
      ScreenComponent = (
        <FavoritesPage
          onBack={() => navigate("home", "back")}
          favorites={favoritesData}
          onDishDetail={(id) => {
            const fav = favoritesData.find((f) => f.id === id);
            if (fav) {
              const dish: Dish = {
                id: fav.id,
                name_original: fav.name_original,
                name_translated: { zh: fav.name_zh },
                description: {},
                ingredients: [],
                allergens: [],
                taste_profile: [],
                cuisine_region: fav.cuisine,
                image_url: fav.image_url,
                image_source: "ai",
              };
              setSelectedDish(dish);
              navigate("detail");
            }
          }}
          onRemoveFavorite={(id) => {
            removeFavorite(id);
            setFavoritesData(getStoredFavorites());
          }}
        />
      );
      break;

    case "settings":
      ScreenComponent = (
        <SettingsPage
          onBack={() => navigate("home", "back")}
          settings={settings}
          onChange={(next) => {
            setSettings(next);
            setStoredSettings(next);
          }}
        />
      );
      break;

    case "error":
      ScreenComponent = (
        <ErrorPage
          onRetry={() => {
            setTranslationResult(null);
            setUseMockFallback(false);
            setScreen("camera");
          }}
        />
      );
      break;

    default:
      ScreenComponent = (
        <HomePage
          onNavigate={navigate}
          onCapture={handleCapture}
          onAlbumAnalyze={handleAnalyze}
          onDailyDishDetail={handleDailyDishDetail}
          onRecentClick={(id) => {
            const entry = historyEntries.find((h) => h.id === id);
            if (entry?.result_summary) {
              setTranslationResult(entry.result_summary);
              navigate("results");
            }
          }}
          recentHistory={historyEntries
            .filter((h) => h.result_summary?.pages?.some((p) => p.dishes?.length))
            .slice(0, 8).map((h) => {
              const firstDish = h.result_summary?.pages?.find((p) => p.dishes?.length)?.dishes?.[0];
              const zhName = firstDish?.name_translated
                ? (typeof firstDish.name_translated === "string" ? firstDish.name_translated : firstDish.name_translated.zh || "")
                : "";
              const enName = firstDish?.name_original || h.restaurant_name;
              return {
                id: h.id,
                zh: zhName || enName,
                en: enName,
                img: h.thumbnail,
              };
            })}
          dailyDish={dailyDish ? {
            id: dailyDish.id,
            name_en: dailyDish.names[0] || "",
            name_zh: dailyDish.names.find((n) => /[一-鿿]/.test(n)) || "",
            cuisine: dailyDish.cuisine,
            category: dailyDish.category,
            image_url: dailyDish.card || dailyDish.hero,
            description_zh: dailyDish.description.zh,
            taste_profile: dailyDish.taste_profile,
            calories: dailyDish.calories,
            spice_level: dailyDish.spice_level,
            rating: dailyDish.reviews?.[0]?.rating || 4,
          } : undefined}
          recommendationContext={recommendationContext}
          recommendationReason={recommendationReason}
        />
      );
  }

  if (!mounted) {
    return (
      <div className="w-full flex justify-center" style={{ minHeight: "100dvh", background: "#F0EBE3" }}>
        <div className="w-full relative flex flex-col overflow-hidden" style={{ maxWidth: 430, height: "100dvh", background: "var(--bg)" }} />
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center" style={{ minHeight: "100dvh", background: "#F0EBE3" }}>
      <div className="w-full relative flex flex-col overflow-hidden" style={{ maxWidth: 430, height: "100dvh", background: "var(--bg)" }}>
        {ScreenComponent}
        {shareNotice ? (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 18,
              transform: "translateX(-50%)",
              padding: "8px 12px",
              borderRadius: 18,
              background: "rgba(45,45,45,0.86)",
              color: "#FFF",
              fontFamily: "var(--font-ui)",
              fontSize: 9,
              fontWeight: 700,
              boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            {shareNotice}
          </div>
        ) : null}
        <ShareSheet
          open={shareSheetOpen}
          meta={shareMeta}
          onClose={() => setShareSheetOpen(false)}
          onStatus={handleShareStatus}
        />
      </div>
    </div>
  );
}
