"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import type { Dish } from "@/types";
import { getDishImageUrl, getDishText, isDishImagePending } from "@/lib/dish-presentation";

type LoadingKind = "pizza" | "seafood" | "meat" | "salad" | "breakfast" | "dessert" | "soup" | "drink" | "pasta" | "burger" | "wrap" | "main";

type DishImageWithLoadingProps = {
  dish: Dish;
  size: "card" | "hero";
  alt?: string;
  children?: ReactNode;
  pendingDone?: number;
  pendingTotal?: number;
};

function selectLoadingCharacter(dish: Dish): LoadingKind {
  const text = [
    dish.category || "",
    dish.name_original || "",
    getDishText(dish).translatedName,
    getDishText(dish).description,
    ...(dish.ingredients || []),
  ].join(" ").toLowerCase();

  if (/pizza|margherita|marinara|diavola|jardin|披萨/.test(text)) return "pizza";
  if (/seafood|fish|salmon|tuna|shrimp|scallop|calamari|shellfish|conch|whelk|sea snail|snail|escargot|海鲜|鱼|虾|贝|蚝|蛤|鲍|鱿鱼|螺|花螺|海螺|响螺|田螺|蛏|扇贝/.test(text)) return "seafood";
  if (/steak|beef|lamb|pork|chicken|duck|meat|rib|veal|牛排|牛肉|羊|猪|鸡|鸭|肉/.test(text)) return "meat";
  if (/salad|vegetable|greens|garden|沙拉|蔬菜|生菜|田园/.test(text)) return "salad";
  if (/egg|breakfast|benedict|omelette|pancake|porridge|toast|早餐|鸡蛋|煎蛋|班尼迪克|松饼|燕麦/.test(text)) return "breakfast";
  if (/dessert|cake|pie|tart|pudding|gelato|ice cream|sweet|甜点|蛋糕|布丁|冰淇淋|挞|派/.test(text)) return "dessert";
  if (/soup|stew|broth|chowder|bisque|汤|羹|浓汤|清汤|炖/.test(text)) return "soup";
  if (/drink|beverage|coffee|tea|latte|cappuccino|espresso|juice|wine|beer|cocktail|饮品|饮料|咖啡|茶|果汁|酒/.test(text)) return "drink";
  if (/pasta|noodle|spaghetti|carbonara|意面|面|粉/.test(text)) return "pasta";
  if (/burger|hamburger|cheeseburger|双层|汉堡|牛肉堡|鸡腿堡/.test(text)) return "burger";
  if (/wrap|burrito|twister|卷饼|鸡肉卷|老北京|wrap meal/.test(text)) return "wrap";
  return "main";
}

function SvgFrame({ compact, children }: { compact: boolean; children: ReactNode }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" style={{ width: compact ? 50 : 132, height: compact ? 50 : 132 }}>
      {children}
    </svg>
  );
}

function PizzaIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "plateFloat 3s ease-in-out infinite" }}>
        <path d="M30 82 C38 44 62 28 94 36 C78 61 58 78 30 82Z" fill="#F6C05F" stroke="#D4A574" strokeWidth="2.4" />
        <path d="M38 76 C47 52 64 38 87 39" fill="none" stroke="#C78142" strokeWidth="4" strokeLinecap="round" />
        <circle cx="58" cy="58" r="4" fill="#C0392B" style={{ animation: "sprinklePop 2s ease-in-out infinite" }} />
        <circle cx="72" cy="48" r="3" fill="#4CAF50" style={{ animation: "leafDrop 2.4s ease-in-out infinite .2s" }} />
        <circle cx="48" cy="70" r="3" fill="#C0392B" style={{ animation: "sprinklePop 2s ease-in-out infinite .5s" }} />
        <path d="M66 63 q9 2 15-4" stroke="#FFF5E9" strokeWidth="3" strokeLinecap="round" />
      </g>
    </SvgFrame>
  );
}

function SeafoodIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "plateFloat 3.2s ease-in-out infinite" }}>
        <ellipse cx="60" cy="84" rx="40" ry="8" fill="none" stroke="#D4A574" strokeWidth="2" />
        <path d="M33 63 C46 42 74 42 87 63 C76 74 47 74 33 63Z" fill="#F4A261" stroke="#C78142" strokeWidth="2.5" />
        <path d="M43 60 C50 54 70 54 77 60" fill="none" stroke="#FFF5E9" strokeWidth="2.4" strokeLinecap="round" style={{ animation: "noodleWiggle 2.4s ease-in-out infinite" }} />
        <circle cx="50" cy="58" r="2.5" fill="#2D2D2D" />
        <path d="M83 62 l13-8 l-4 14 z" fill="#F4A261" stroke="#C78142" strokeWidth="2" />
      </g>
      <circle cx="34" cy="40" r="2.2" fill="#4CAF50" style={{ animation: "sparkleA 1.8s ease-in-out infinite .4s" }} />
    </SvgFrame>
  );
}

function MeatIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "plateFloat 3.3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="86" rx="42" ry="8" fill="none" stroke="#D4A574" strokeWidth="2" />
        <path d="M35 66 C39 45 68 39 86 55 C101 70 72 84 48 78 C40 76 33 73 35 66Z" fill="#A65F3E" stroke="#7E3F2C" strokeWidth="2.6" />
        <path d="M48 58 C60 51 72 52 84 60" fill="none" stroke="#F3B47B" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "sizzleA 2s ease-in-out infinite" }} />
        <circle cx="46" cy="73" r="3" fill="#4CAF50" />
        <circle cx="76" cy="47" r="2.4" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-in-out infinite .2s" }} />
      </g>
    </SvgFrame>
  );
}

function SaladIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "bowlFloat 3s ease-in-out infinite" }}>
        <path d="M22 70 Q60 93 98 70 L92 88 Q60 101 28 88Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.4" />
        <circle cx="47" cy="58" r="10" fill="#4CAF50" style={{ animation: "leafDrop 2.6s ease-in-out infinite" }} />
        <circle cx="64" cy="55" r="9" fill="#8BC34A" style={{ animation: "leafDrop 2.2s ease-in-out infinite .3s" }} />
        <circle cx="76" cy="62" r="7" fill="#C0392B" />
        <path d="M39 67 q20 8 42 0" stroke="#D4A574" strokeWidth="2" fill="none" />
      </g>
    </SvgFrame>
  );
}

function BreakfastIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "plateFloat 3.1s ease-in-out infinite" }}>
        <ellipse cx="60" cy="84" rx="42" ry="9" fill="none" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="58" cy="64" rx="22" ry="16" fill="#FFF5E9" stroke="#E8D5C0" strokeWidth="2" />
        <circle cx="59" cy="64" r="8" fill="#FFB74D" style={{ animation: "cherryBob 1.9s ease-in-out infinite" }} />
        <path d="M74 58 q9 5 6 16" stroke="#4CAF50" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </SvgFrame>
  );
}

function DessertIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "cakeFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="90" rx="44" ry="8" fill="none" stroke="#D4A574" strokeWidth="2" />
        <rect x="32" y="62" width="56" height="24" rx="4" fill="#D4A574" stroke="#C4A574" strokeWidth="1.5" />
        <rect x="34" y="56" width="52" height="8" rx="2" fill="#FFF5E9" />
        <path d="M34 56 Q36 48 42 50 Q48 44 54 48 Q60 42 66 48 Q72 44 78 50 Q84 48 86 56" fill="#FFB74D" stroke="#FF9F1C" strokeWidth="1.5" />
        <circle cx="60" cy="42" r="5" fill="#C0392B" style={{ animation: "cherryBob 1.5s ease-in-out infinite" }} />
      </g>
    </SvgFrame>
  );
}

function SoupIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <line x1="48" y1="28" x2="48" y2="14" stroke="#C4B5A0" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "steamA1 2.2s ease-out infinite" }} />
      <line x1="60" y1="24" x2="60" y2="10" stroke="#C4B5A0" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "steamA2 2.8s ease-out infinite .4s" }} />
      <line x1="72" y1="28" x2="72" y2="12" stroke="#C4B5A0" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "steamA3 2.5s ease-out infinite .8s" }} />
      <g style={{ animation: "bowlFloat 3s ease-in-out infinite" }}>
        <path d="M18 68 Q18 54 30 48 L90 48 Q102 54 102 68 L98 88 Q60 92 22 88Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" />
        <ellipse cx="60" cy="50" rx="34" ry="8" fill="#FFB74D" opacity="0.72" />
        <circle cx="50" cy="49" r="3" fill="#4CAF50" />
        <circle cx="70" cy="50" r="3" fill="#C0392B" />
      </g>
    </SvgFrame>
  );
}

function DrinkIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <line x1="54" y1="30" x2="54" y2="16" stroke="#C4B5A0" strokeWidth="2" strokeLinecap="round" style={{ animation: "steamB1 2.5s ease-out infinite" }} />
      <line x1="66" y1="30" x2="66" y2="18" stroke="#C4B5A0" strokeWidth="2" strokeLinecap="round" style={{ animation: "steamB2 2.3s ease-out infinite .5s" }} />
      <g style={{ animation: "cupFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="86" rx="38" ry="7" fill="none" stroke="#D4A574" strokeWidth="2" />
        <path d="M28 50 L35 80 Q60 84 85 80 L92 50Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" />
        <ellipse cx="60" cy="50" rx="32" ry="8" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="51" rx="28" ry="6" fill="#C49660" opacity="0.7" style={{ animation: "teaSwirl 2s ease-in-out infinite" }} />
        <path d="M88 54 Q106 54 106 66 Q106 78 86 76" fill="none" stroke="#D4A574" strokeWidth="3" strokeLinecap="round" />
      </g>
    </SvgFrame>
  );
}

function PastaIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "pastaFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="82" rx="44" ry="9" fill="none" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="66" rx="26" ry="14" fill="#F5DEB3" />
        <path d="M42 62 Q54 54 66 62 Q78 70 82 62" fill="none" stroke="#E8C9A0" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "noodleWiggle 2s ease-in-out infinite" }} />
        <ellipse cx="58" cy="62" rx="14" ry="8" fill="#C0392B" opacity="0.8" />
      </g>
    </SvgFrame>
  );
}

function BurgerIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "plateFloat 3.2s ease-in-out infinite" }}>
        <ellipse cx="60" cy="84" rx="42" ry="8" fill="none" stroke="#D4A574" strokeWidth="2" />
        <path d="M28 56 Q28 34 60 32 Q92 34 92 56 Q92 72 28 72Z" fill="#F5C06F" stroke="#D4A574" strokeWidth="2.5" />
        <path d="M28 56 Q28 48 32 48 L88 48 Q92 48 92 56" fill="#C78142" stroke="#C78142" strokeWidth="1.5" />
        <ellipse cx="60" cy="56" rx="30" ry="6" fill="#7E3F2C" />
        <path d="M36 56 Q48 48 60 52 Q72 48 84 56" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="72" cy="58" r="3" fill="#C0392B" />
      </g>
    </SvgFrame>
  );
}

function WrapIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "wrapFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="84" rx="40" ry="7" fill="none" stroke="#D4A574" strokeWidth="2" />
        <path d="M28 50 L28 78 Q28 82 32 82 L88 82 Q92 82 92 78 L92 46 Q76 42 64 48 Q52 42 36 48 Z" fill="#F5DEB3" stroke="#D4A574" strokeWidth="2.5" />
        <ellipse cx="60" cy="48" rx="16" ry="6" fill="none" stroke="#D4A574" strokeWidth="2" />
        <path d="M46 58 L56 42" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M66 58 L62 44" stroke="#C0392B" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M54 66 L68 50" stroke="#FFB74D" strokeWidth="2" strokeLinecap="round" />
      </g>
    </SvgFrame>
  );
}

function MainIcon({ compact }: { compact: boolean }) {
  return (
    <SvgFrame compact={compact}>
      <g style={{ animation: "plateFloat 3.5s ease-in-out infinite" }}>
        <ellipse cx="60" cy="82" rx="46" ry="10" fill="none" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="80" rx="42" ry="8" fill="#FFF5E9" stroke="#E8D5C0" strokeWidth="1.5" />
        <ellipse cx="60" cy="65" rx="28" ry="16" fill="#D4A574" transform="rotate(-5 60 65)" />
        <circle cx="44" cy="54" r="4" fill="#4CAF50" opacity="0.7" />
      </g>
      <line x1="82" y1="48" x2="84" y2="34" stroke="#FF9F1C" strokeWidth="1.5" strokeLinecap="round" style={{ animation: "sizzleA 1.8s ease-out infinite .3s" }} />
    </SvgFrame>
  );
}

function LoadingIcon({ kind, compact }: { kind: LoadingKind; compact: boolean }) {
  if (kind === "pizza") return <PizzaIcon compact={compact} />;
  if (kind === "seafood") return <SeafoodIcon compact={compact} />;
  if (kind === "meat") return <MeatIcon compact={compact} />;
  if (kind === "salad") return <SaladIcon compact={compact} />;
  if (kind === "breakfast") return <BreakfastIcon compact={compact} />;
  if (kind === "dessert") return <DessertIcon compact={compact} />;
  if (kind === "soup") return <SoupIcon compact={compact} />;
  if (kind === "drink") return <DrinkIcon compact={compact} />;
  if (kind === "pasta") return <PastaIcon compact={compact} />;
  if (kind === "burger") return <BurgerIcon compact={compact} />;
  if (kind === "wrap") return <WrapIcon compact={compact} />;
  return <MainIcon compact={compact} />;
}

export default function DishImageWithLoading({ dish, size, alt, children, pendingDone, pendingTotal }: DishImageWithLoadingProps) {
  const compact = size === "card";
  const kind = selectLoadingCharacter(dish);
  const imageUrl = getDishImageUrl(dish, size);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageFailed = failedUrl === imageUrl;
  const pending = isDishImagePending(dish) || imageFailed;
  const width = compact ? 68 : "100%";
  const height = compact ? 68 : 200;
  const radius = compact ? "var(--radius)" : "var(--radius-lg)";

  return (
    <div className="relative flex-shrink-0 overflow-hidden" style={{ width, height, borderRadius: radius }}>
      {pending ? (
        <div
          className={`dish-image-loading ${compact ? "dish-image-loading--card" : "dish-image-loading--hero"}`}
          aria-label={`${getDishText(dish).translatedName} 图片生成中`}
          data-loading-kind={kind}
        >
          <LoadingIcon kind={kind} compact={compact} />
          {!compact ? (
              <span>
                AI 正在生成图片
                {pendingDone !== undefined && pendingTotal !== undefined && pendingTotal > 0
                  ? ` · ${Math.round((pendingDone / pendingTotal) * 100)}%`
                  : ""}
              </span>
            ) : null}
        </div>
      ) : (
        <Image
          className="dish-image-ready"
          src={imageUrl}
          alt={alt || getDishText(dish).translatedName}
          fill
          sizes={compact ? "68px" : "(max-width: 430px) 100vw, 430px"}
          style={{ objectFit: "cover" }}
          onError={() => setFailedUrl(imageUrl)}
        />
      )}
      {children}
    </div>
  );
}
