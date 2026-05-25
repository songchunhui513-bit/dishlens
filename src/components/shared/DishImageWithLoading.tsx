"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { Dish } from "@/types";
import { getDishImageUrl, getDishText, isDishImagePending } from "@/lib/dish-presentation";

type DishImageWithLoadingProps = {
  dish: Dish;
  size: "card" | "hero";
  alt?: string;
  children?: ReactNode;
};

function selectLoadingCharacter(dish: Dish): "dessert" | "soup" | "drink" | "pasta" | "main" {
  const text = [
    dish.category || "",
    dish.name_original || "",
    getDishText(dish).translatedName,
    getDishText(dish).description,
    ...(dish.ingredients || []),
  ].join(" ").toLowerCase();

  if (/dessert|cake|pie|tart|pudding|gelato|甜点|蛋糕|布丁|冰淇淋|挞|派/.test(text)) return "dessert";
  if (/soup|stew|broth|chowder|汤|羹|浓汤|炖/.test(text)) return "soup";
  if (/drink|beverage|coffee|tea|latte|cappuccino|espresso|juice|wine|beer|饮品|饮料|咖啡|茶|果汁|酒/.test(text)) return "drink";
  if (/pasta|noodle|spaghetti|意面|面|粉/.test(text)) return "pasta";
  return "main";
}

function DessertIcon({ compact }: { compact: boolean }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" style={{ width: compact ? 54 : 124, height: compact ? 54 : 124 }}>
      <g style={{ animation: "cakeFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="90" rx="44" ry="8" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
        <rect x="32" y="62" width="56" height="24" rx="4" fill="#D4A574" stroke="#C4A574" strokeWidth="1.5" />
        <rect x="34" y="56" width="52" height="8" rx="2" fill="#FFF5E9" />
        <path d="M34 56 Q36 48 42 50 Q48 44 54 48 Q60 42 66 48 Q72 44 78 50 Q84 48 86 56" fill="#FFB74D" stroke="#FF9F1C" strokeWidth="1.5" />
        <circle cx="60" cy="42" r="5" fill="#C0392B" style={{ animation: "cherryBob 1.5s ease-in-out infinite" }} />
      </g>
      <circle cx="28" cy="42" r="2.5" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite .2s" }} />
      <circle cx="92" cy="48" r="2.2" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite 1s" }} />
    </svg>
  );
}

function SoupIcon({ compact }: { compact: boolean }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" style={{ width: compact ? 54 : 124, height: compact ? 54 : 124 }}>
      <line x1="48" y1="28" x2="48" y2="14" stroke="#C4B5A0" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "steamA1 2.2s ease-out infinite" }} />
      <line x1="60" y1="24" x2="60" y2="10" stroke="#C4B5A0" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "steamA2 2.8s ease-out infinite .4s" }} />
      <line x1="72" y1="28" x2="72" y2="12" stroke="#C4B5A0" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "steamA3 2.5s ease-out infinite .8s" }} />
      <g style={{ animation: "bowlFloat 3s ease-in-out infinite" }}>
        <path d="M18 68 Q18 54 30 48 L90 48 Q102 54 102 68 L98 88 Q60 92 22 88 Z" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2.5" />
        <ellipse cx="60" cy="50" rx="34" ry="8" fill="#FFB74D" opacity="0.7" />
      </g>
    </svg>
  );
}

function DrinkIcon({ compact }: { compact: boolean }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" style={{ width: compact ? 54 : 124, height: compact ? 54 : 124 }}>
      <line x1="54" y1="30" x2="54" y2="16" stroke="#C4B5A0" strokeWidth="2" strokeLinecap="round" style={{ animation: "steamB1 2.5s ease-out infinite" }} />
      <line x1="66" y1="30" x2="66" y2="18" stroke="#C4B5A0" strokeWidth="2" strokeLinecap="round" style={{ animation: "steamB2 2.3s ease-out infinite .5s" }} />
      <g style={{ animation: "cupFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="86" rx="38" ry="7" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
        <path d="M28 50 L35 80 Q60 84 85 80 L92 50 Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" />
        <ellipse cx="60" cy="50" rx="32" ry="8" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="51" rx="28" ry="6" fill="#C49660" opacity="0.7" style={{ animation: "teaSwirl 2s ease-in-out infinite" }} />
        <path d="M88 54 Q106 54 106 66 Q106 78 86 76" fill="none" stroke="#D4A574" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function PastaIcon({ compact }: { compact: boolean }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" style={{ width: compact ? 54 : 124, height: compact ? 54 : 124 }}>
      <g style={{ animation: "pastaFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="82" rx="44" ry="9" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="66" rx="26" ry="14" fill="#F5DEB3" />
        <path d="M42 62 Q54 54 66 62 Q78 70 82 62" fill="none" stroke="#E8C9A0" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "noodleWiggle 2s ease-in-out infinite" }} />
        <ellipse cx="58" cy="62" rx="14" ry="8" fill="#C0392B" opacity="0.8" />
      </g>
    </svg>
  );
}

function MainIcon({ compact }: { compact: boolean }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" style={{ width: compact ? 54 : 124, height: compact ? 54 : 124 }}>
      <g style={{ animation: "plateFloat 3.5s ease-in-out infinite" }}>
        <ellipse cx="60" cy="82" rx="46" ry="10" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="80" rx="42" ry="8" fill="#FFF5E9" stroke="#E8D5C0" strokeWidth="1.5" />
        <ellipse cx="60" cy="65" rx="28" ry="16" fill="#D4A574" transform="rotate(-5 60 65)" />
        <circle cx="44" cy="54" r="4" fill="#4CAF50" opacity="0.7" />
      </g>
      <line x1="82" y1="48" x2="84" y2="34" stroke="#FF9F1C" strokeWidth="1.5" strokeLinecap="round" style={{ animation: "sizzleA 1.8s ease-out infinite .3s" }} />
    </svg>
  );
}

function LoadingIcon({ kind, compact }: { kind: ReturnType<typeof selectLoadingCharacter>; compact: boolean }) {
  if (kind === "dessert") return <DessertIcon compact={compact} />;
  if (kind === "soup") return <SoupIcon compact={compact} />;
  if (kind === "drink") return <DrinkIcon compact={compact} />;
  if (kind === "pasta") return <PastaIcon compact={compact} />;
  return <MainIcon compact={compact} />;
}

export default function DishImageWithLoading({ dish, size, alt, children }: DishImageWithLoadingProps) {
  const pending = isDishImagePending(dish);
  const compact = size === "card";
  const kind = selectLoadingCharacter(dish);
  const width = compact ? 68 : "100%";
  const height = compact ? 68 : 200;
  const radius = compact ? "var(--radius)" : "var(--radius-lg)";

  return (
    <div className="relative flex-shrink-0 overflow-hidden" style={{ width, height, borderRadius: radius }}>
      {pending ? (
        <div
          className="dish-image-loading"
          aria-label={`${getDishText(dish).translatedName} 图片生成中`}
          data-loading-kind={kind}
        >
          <LoadingIcon kind={kind} compact={compact} />
          {!compact ? <span>AI 正在生成图片</span> : null}
        </div>
      ) : (
        <Image
          className="dish-image-ready"
          src={getDishImageUrl(dish, size)}
          alt={alt || getDishText(dish).translatedName}
          fill
          sizes={compact ? "68px" : "(max-width: 430px) 100vw, 430px"}
          style={{ objectFit: "cover" }}
        />
      )}
      {children}
    </div>
  );
}
