"use client";

import { useState, useCallback } from "react";
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
import type { CapturedPhoto, Dish, TranslationResult } from "@/types";
import { translateMenu } from "@/lib/api-client";

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

interface UserSettings {
  targetLang: string;
  uiLang: "zh" | "en";
  showAllergens: boolean;
  showVeg: boolean;
  showGlutenFree: boolean;
}

// ── AppPhone State Manager ─────────────────────────────────────────

export default function Page() {
  const [screen, setScreen] = useState<Screen>("home");
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [history, setHistory] = useState<Screen[]>(["home"]);
  const [useMockFallback, setUseMockFallback] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    targetLang: "zh",
    uiLang: "zh",
    showAllergens: false,
    showVeg: false,
    showGlutenFree: false,
  });

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
        const result = await translateMenu(files);
        setTranslationResult(result);
      } catch {
        setUseMockFallback(true);
      }
    },
    [navigate]
  );

  const handleLoadingComplete = useCallback(() => {
    navigate("results");
  }, [navigate]);

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
          showAllergens={settings.showAllergens}
          showVeg={settings.showVeg}
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
          onSelect={(id) => {
            const mockDish = { id, name_original: "", name_translated: {}, description: {}, ingredients: [], allergens: [], taste_profile: [], image_source: "ai" as const };
            setSelectedDish(mockDish);
            navigate("detail");
          }}
        />
      );
      break;

    case "favorites":
      ScreenComponent = (
        <FavoritesPage
          onBack={() => navigate("home", "back")}
        />
      );
      break;

    case "settings":
      ScreenComponent = (
        <SettingsPage
          onBack={() => navigate("home", "back")}
          settings={settings}
          onChange={setSettings}
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
        />
      );
  }

  return (
    <div className="w-full flex justify-center" style={{ minHeight: "100dvh", background: "#F0EBE3" }}>
      <div className="w-full relative flex flex-col" style={{ maxWidth: 430, minHeight: "100dvh", height: "100dvh", background: "var(--bg)" }}>
        {ScreenComponent}
      </div>
    </div>
  );
}
