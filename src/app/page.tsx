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
import OrderConfirmPage from "@/components/order/OrderConfirmPage";
import OrderedPage from "@/components/order/OrderedPage";
import OrderedDetailPage from "@/components/order/OrderedDetailPage";
import type { CapturedPhoto, Dish, TranslationResult, HistoryEntry, FavoriteDish, OrderedVisit, OrderNote, OrderQuantityMap, UserSettings } from "@/types";
import { createTranslation } from "@/lib/api-client";
import {
  getHistory as getStoredHistory,
  addHistory,
  getFavorites as getStoredFavorites,
  addFavorite,
  removeFavorite,
  isFavorited as checkFavorited,
  getOrderedVisits as getStoredOrderedVisits,
  addOrderedVisit,
  markOrderedDishReviewed,
  getSettings as getStoredSettings,
  setSettings as setStoredSettings,
} from "@/lib/local-storage";
import { useDailyRecommendation } from "@/hooks/useDailyRecommendation";
import { getDishImageUrl } from "@/lib/dish-presentation";
import { buildDishDisplayTags } from "@/lib/dish-display-tags";
import { buildShareMenuMeta } from "@/lib/share-menu";
import { buildOrderedVisit, buildOrderItems, formatOrderPrice, setOrderQuantity, summarizeOrder } from "@/lib/order-state";
import { getRestaurantDisplayMeta } from "@/lib/restaurant-display";
import { resolveMenuSourceLanguage } from "@/lib/menu-source-language";
import { buildRecentMenuRecords } from "@/lib/recent-menu-records";
import type { RestaurantSource } from "@/lib/location-recommendation";

// ── Types ───────────────────────────────────────────────────────────

type Screen =
  | "home"
  | "camera"
  | "loading"
  | "results"
  | "detail"
  | "review"
  | "confirm"
  | "orderConfirm"
  | "ordered"
  | "orderedDetail"
  | "history"
  | "favorites"
  | "settings"
  | "error";

const ORDER_NOTES: Record<string, OrderNote[]> = {
  ja: [
    { id: "no-peanuts", zh: "不要花生", original: "ピーナッツ抜きでお願いします。" },
    { id: "no-cilantro", zh: "不要香菜", original: "パクチー抜きでお願いします。" },
    { id: "no-scallions", zh: "不要葱花", original: "ネギ抜きでお願いします。" },
    { id: "less-spicy", zh: "少辣", original: "辛さ控えめでお願いします。" },
    { id: "no-dairy", zh: "不要乳制品", original: "乳製品抜きでお願いします。" },
    { id: "no-pork", zh: "不要猪肉", original: "豚肉抜きでお願いします。" },
  ],
  fr: [
    { id: "no-peanuts", zh: "不要花生", original: "Sans cacahuètes, s'il vous plaît." },
    { id: "no-cilantro", zh: "不要香菜", original: "Sans coriandre, s'il vous plaît." },
    { id: "no-scallions", zh: "不要葱花", original: "Sans oignons verts, s'il vous plaît." },
    { id: "less-spicy", zh: "少辣", original: "Peu épicé, s'il vous plaît." },
    { id: "no-dairy", zh: "不要乳制品", original: "Sans produits laitiers, s'il vous plaît." },
    { id: "no-pork", zh: "不要猪肉", original: "Sans porc, s'il vous plaît." },
  ],
  _default: [
    { id: "no-peanuts", zh: "不要花生", original: "No peanuts, please." },
    { id: "no-cilantro", zh: "不要香菜", original: "No cilantro, please." },
    { id: "no-scallions", zh: "不要葱花", original: "No scallions, please." },
    { id: "less-spicy", zh: "少辣", original: "Less spicy, please." },
    { id: "no-dairy", zh: "不要乳制品", original: "No dairy, please." },
    { id: "no-pork", zh: "不要猪肉", original: "No pork, please." },
  ],
};

function getOrderNotes(sourceLang?: string): OrderNote[] {
  if (sourceLang && ORDER_NOTES[sourceLang]) return ORDER_NOTES[sourceLang];
  return ORDER_NOTES._default;
}

// ── AppPhone State Manager ─────────────────────────────────────────

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const latestResultRef = useRef<TranslationResult | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [selectedDishRestaurantSource, setSelectedDishRestaurantSource] = useState<RestaurantSource | null>(null);
  const [orderQuantities, setOrderQuantities] = useState<OrderQuantityMap>({});
  const [selectedOrderNoteIds, setSelectedOrderNoteIds] = useState<string[]>([]);
  const [selectedOrderedVisit, setSelectedOrderedVisit] = useState<OrderedVisit | null>(null);
  const [reviewReturn, setReviewReturn] = useState<"normal" | "orderedDetail">("normal");
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [history, setHistory] = useState<Screen[]>(["home"]);
  const [useMockFallback, setUseMockFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [settings, setSettings] = useState<UserSettings>(() => getStoredSettings());

  // localStorage-backed state — init empty on SSR, hydrate on mount
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(() =>
    typeof window === "undefined" ? [] : getStoredHistory()
  );
  const [favoritesData, setFavoritesData] = useState<FavoriteDish[]>(() =>
    typeof window === "undefined" ? [] : getStoredFavorites()
  );
  const [orderedVisits, setOrderedVisits] = useState<OrderedVisit[]>(() =>
    typeof window === "undefined" ? [] : getStoredOrderedVisits()
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Refresh history from localStorage when returning to home
  useEffect(() => {
    if (screen !== "home") return;
    const frame = window.requestAnimationFrame(() => {
      setHistoryEntries(getStoredHistory());
      setFavoritesData(getStoredFavorites());
      setOrderedVisits(getStoredOrderedVisits());
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen]);

  // Daily recommendation
  const { dish: dailyDish, restaurant: dailyRestaurantSource, contextLabel: recommendationContext, reason: recommendationReason } = useDailyRecommendation(settings.uiLang);
  const shareTaskId = translationResult?.task_id || "";
  const currentOrderItems = useMemo(() => buildOrderItems(translationResult, orderQuantities), [orderQuantities, translationResult]);
  const currentOrderSummary = useMemo(() => summarizeOrder(currentOrderItems), [currentOrderItems]);
  const currentOrderTotalLabel = useMemo(() => formatOrderPrice(currentOrderSummary), [currentOrderSummary]);
  const selectedDishSmartTags = useMemo(() => {
    if (!selectedDish) return [];
    return buildDishDisplayTags({
      dish: selectedDish,
      signature: translationResult?.metadata?.signature,
      showAllergens: settings.showAllergens,
      maxTags: 4,
    });
  }, [selectedDish, settings.showAllergens, translationResult?.metadata?.signature]);
  const shareMeta = useMemo(() => {
    if (!translationResult || !shareTaskId) return null;
    const origin = typeof window === "undefined" ? undefined : window.location.origin;
    return buildShareMenuMeta(translationResult, origin, shareTaskId);
  }, [shareTaskId, translationResult]);

  // Compute AI image generation progress
  const imageGenProgress = useMemo(() => {
    if (!translationResult?.pages) return undefined;
    const metadataProgress = translationResult.metadata?.image_generation_progress;
    if (metadataProgress?.total) {
      return { done: metadataProgress.current, total: metadataProgress.total };
    }
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
    const sourceLang = resolveMenuSourceLanguage(result) || result.metadata?.source_language || "";
    const restaurant = getRestaurantDisplayMeta(
      sourceLang,
      settings.targetLang,
      result.metadata?.restaurant,
    );
    const entry: HistoryEntry = {
      id: result.task_id,
      restaurant_name: restaurant.display_name,
      city: restaurant.city,
      dish_count: result.metadata?.total_dishes || 0,
      page_count: pages.length,
      date: new Date().toISOString(),
      thumbnail: firstDish ? getDishImageUrl(firstDish) : "",
      source_lang: sourceLang,
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
        const validScreens: Screen[] = ["home", "camera", "results", "detail", "review", "confirm", "orderConfirm", "ordered", "orderedDetail", "history", "favorites", "settings", "error"];
        if (validScreens.includes(prev as Screen)) {
          setScreen(prev as Screen);
        } else {
          setScreen("home");
        }
        return;
      }

      if (ctx && typeof ctx === "object" && "id" in (ctx as Record<string, unknown>)) {
        setSelectedDish(ctx as Dish);
        setSelectedDishRestaurantSource(null);
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
    setErrorMessage("");
    navigate("camera");
  }, [navigate]);

  const handleAnalyze = useCallback(
    async (photos: CapturedPhoto[]) => {
      setCapturedPhotos(photos);
      setTranslationResult(null);
      setUseMockFallback(false);
      setErrorMessage("");
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
        setErrorMessage("没有读取到图片，请重新选择或拍摄菜单。");
        navigate("error");
        return;
      }

      try {
        const preliminary = await createTranslation(files, settings.targetLang);
        setTranslationResult(preliminary as unknown as TranslationResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setErrorMessage(
          message.includes("timed out")
            ? "海外网络上传到当前国内服务器较慢，图片识别请求超时。请换 Wi-Fi、减少图片数量后重试。"
            : "图片上传或识别请求没有成功，请检查网络后重试。"
        );
        navigate("error");
      }
    },
    [navigate, settings.targetLang]
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

  const handleLoadingTimeout = useCallback(() => {
    setErrorMessage("海外网络或 AI 服务响应较慢，本次识别超过等待时间。请减少图片数量或稍后重试。");
    setTranslationResult(null);
    setUseMockFallback(false);
    navigate("error");
  }, [navigate]);

  const handleDishDetail = useCallback(
    (dish: Dish) => {
      setSelectedDish(dish);
      setSelectedDishRestaurantSource(null);
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
    setSelectedDishRestaurantSource(dailyRestaurantSource);
    navigate("detail");
  }, [dailyDish, dailyRestaurantSource, navigate]);

  const handleReview = useCallback(() => {
    setReviewReturn("normal");
    navigate("review");
  }, [navigate]);

  const handleReviewConfirm = useCallback(() => {
    if (reviewReturn === "orderedDetail" && selectedOrderedVisit && selectedDish) {
      markOrderedDishReviewed(selectedOrderedVisit.id, selectedDish.id);
      const nextVisits = getStoredOrderedVisits();
      setOrderedVisits(nextVisits);
      setSelectedOrderedVisit(nextVisits.find((visit) => visit.id === selectedOrderedVisit.id) || selectedOrderedVisit);
      setReviewReturn("normal");
      navigate("orderedDetail");
      return;
    }
    navigate("confirm");
  }, [navigate, reviewReturn, selectedDish, selectedOrderedVisit]);

  const handleBackToMenu = useCallback(() => {
    setHistory(["home"]);
    setScreen("home");
  }, []);

  const handleKeepBrowsing = useCallback(() => {
    navigate("results");
  }, [navigate]);

  const handleOrderQuantityChange = useCallback((dish: Dish, quantity: number) => {
    setOrderQuantities((current) => setOrderQuantity(current, dish, quantity));
  }, []);

  const handleToggleOrderNote = useCallback((noteId: string) => {
    setSelectedOrderNoteIds((current) => (
      current.includes(noteId) ? current.filter((id) => id !== noteId) : [...current, noteId]
    ));
  }, []);

  const handleSaveOrderedVisit = useCallback(() => {
    if (!translationResult || currentOrderItems.length === 0) return;
    const sourceLang = resolveMenuSourceLanguage(translationResult) || translationResult.metadata?.source_language;
    const notes = getOrderNotes(sourceLang).filter((note) => selectedOrderNoteIds.includes(note.id));
    const visit = buildOrderedVisit(translationResult, currentOrderItems, notes, settings.targetLang);
    addOrderedVisit(visit);
    const nextVisits = getStoredOrderedVisits();
    setOrderedVisits(nextVisits);
    setSelectedOrderedVisit(visit);
    setOrderQuantities({});
    setSelectedOrderNoteIds([]);
    navigate("ordered");
  }, [currentOrderItems, navigate, selectedOrderNoteIds, settings.targetLang, translationResult]);

  const handleOrderedDishReview = useCallback((dish: Dish) => {
    setSelectedDish(dish);
    setSelectedDishRestaurantSource(null);
    setReviewReturn("orderedDetail");
    navigate("review");
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
    let idlePolls = 0;
    const MAX_IDLE_POLLS = 24;
    let lastSyncedImages = 0;
    const imageDoneStatus = new Set(["done", "partial", "failed"]);
    const hasPendingImages = (result: TranslationResult) => {
      const imageStatus = result.metadata?.image_generation_status;
      if (imageStatus && !imageDoneStatus.has(imageStatus)) return true;
      if (imageStatus && imageDoneStatus.has(imageStatus)) return false;
      return result.pages
        .flatMap((page) => page.dishes || [])
        .some((dish) => {
          if (dish.image_status === "done" || dish.image_status === "failed") return false;
          const url = dish.ai_image_url || (dish as { image_url?: string }).image_url;
          return !url;
        });
    };

    const poll = async () => {
      if (!active || idlePolls >= MAX_IDLE_POLLS) return;

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
                if (
                  (newDish?.ai_image_url && newDish.ai_image_url !== oldDish?.ai_image_url) ||
                  newDish?.image_status !== oldDish?.image_status
                ) {
                  changed = true;
                }
              }
            }
            if (changed || hasPendingImages(newResult)) idlePolls = 0;
            else idlePolls++;
            // Re-save history with updated thumbnails when new images arrive
            if (changed && imageCount > lastSyncedImages) {
              lastSyncedImages = imageCount;
              const firstDish = newResult.pages.find((p) => p.dishes?.length)?.dishes?.[0];
              if (firstDish?.ai_image_url) {
                const sourceLang = resolveMenuSourceLanguage(newResult) || newResult.metadata?.source_language || "";
                const restaurant = getRestaurantDisplayMeta(
                  sourceLang,
                  settings.targetLang,
                  newResult.metadata?.restaurant,
                );
                const entry: HistoryEntry = {
                  id: newResult.task_id,
                  restaurant_name: restaurant.display_name,
                  city: restaurant.city,
                  dish_count: newResult.metadata?.total_dishes || 0,
                  page_count: newResult.pages.length,
                  date: new Date().toISOString(),
                  thumbnail: getDishImageUrl(firstDish),
                  source_lang: sourceLang,
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
              if (
                (matched?.ai_image_url && matched.ai_image_url !== prevDish.ai_image_url) ||
                (matched && matched.image_status !== prevDish.image_status)
              ) return matched;
            }
            return prevDish;
          });
        } else {
          idlePolls++;
        }
      } catch {
        idlePolls++;
      }

      if (active && idlePolls < MAX_IDLE_POLLS) {
        setTimeout(poll, 4000);
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
          onTimeout={handleLoadingTimeout}
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
          targetLang={settings.targetLang}
          uiLang={settings.uiLang}
          imageGenProgress={imageGenProgress}
          orderQuantities={orderQuantities}
          onOrderQuantityChange={handleOrderQuantityChange}
          orderTotalQuantity={currentOrderSummary.totalQuantity}
          orderTotalLabel={currentOrderTotalLabel}
          onOpenOrderConfirm={() => navigate("orderConfirm")}
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
          targetLang={settings.targetLang}
          uiLang={settings.uiLang}
          isFavorited={selectedDish ? checkFavorited(selectedDish.id) : false}
          onToggleFavorite={handleToggleFavorite}
          onShare={handleShareMenu}
          imageGenProgress={imageGenProgress}
          smartTags={selectedDishSmartTags}
          orderQuantity={selectedDish ? orderQuantities[selectedDish.id] || 0 : 0}
          orderTotalQuantity={currentOrderSummary.totalQuantity}
          orderTotalLabel={currentOrderTotalLabel}
          restaurantSource={selectedDishRestaurantSource}
          onOrderQuantityChange={handleOrderQuantityChange}
          onOpenOrderConfirm={() => navigate("orderConfirm")}
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

    case "orderConfirm":
      ScreenComponent = (
        <OrderConfirmPage
          items={currentOrderItems}
          sourceLang={resolveMenuSourceLanguage(translationResult) || translationResult?.metadata?.source_language}
          result={translationResult}
          notes={getOrderNotes(resolveMenuSourceLanguage(translationResult) || translationResult?.metadata?.source_language)}
          selectedNoteIds={selectedOrderNoteIds}
          onToggleNote={handleToggleOrderNote}
          onBack={() => navigate("detail", "back")}
          onSave={handleSaveOrderedVisit}
          onBackToResults={() => navigate("results", "back")}
        />
      );
      break;

    case "ordered":
      ScreenComponent = (
        <OrderedPage
          visits={orderedVisits}
          onBack={() => { setHistory(["home"]); setScreen("home"); }}
          onSelect={(visit) => {
            setSelectedOrderedVisit(visit);
            navigate("orderedDetail");
          }}
        />
      );
      break;

    case "orderedDetail":
      ScreenComponent = (
        <OrderedDetailPage
          visit={selectedOrderedVisit}
          onBack={() => navigate("ordered", "back")}
          onDishDetail={(dish) => {
            setSelectedDish(dish);
            setSelectedDishRestaurantSource(null);
            navigate("detail");
          }}
          onReviewDish={handleOrderedDishReview}
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
              setSelectedDishRestaurantSource(null);
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
              setSelectedDishRestaurantSource(null);
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
            setErrorMessage("");
            setScreen("camera");
          }}
          message={errorMessage}
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
          recentHistory={buildRecentMenuRecords(historyEntries, { targetLang: settings.targetLang })}
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
          restaurantSource={dailyRestaurantSource}
          uiLang={settings.uiLang}
        />
      );
  }

  // SSR: render the full component tree immediately instead of an empty shell.
  // All useState initial values already use typeof window === "undefined" guards,
  // so the initial SSR HTML matches the client hydration, preventing white flash.
  if (!mounted) { /* hydration guard — fall through to normal render */ }

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
