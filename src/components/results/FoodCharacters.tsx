"use client";

import type { CSSProperties } from "react";

export const FOOD_CHARACTER_HINTS = [
  "咕嘟咕嘟...",
  "滋滋作响...",
  "卷啊卷...",
  "甜甜的...",
  "新鲜手作...",
  "暖心热饮...",
] as const;

const strokeRound: CSSProperties = { strokeLinecap: "round" };

interface FoodCharactersProps {
  activeIndex: number;
}

function SoupCharacter() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <line x1="48" y1="28" x2="48" y2="14" stroke="#C4B5A0" strokeWidth="2.5" style={{ ...strokeRound, animation: "steamA1 2.2s ease-out infinite" }} />
      <line x1="60" y1="24" x2="60" y2="10" stroke="#C4B5A0" strokeWidth="2.5" style={{ ...strokeRound, animation: "steamA2 2.8s ease-out infinite .4s" }} />
      <line x1="72" y1="28" x2="72" y2="12" stroke="#C4B5A0" strokeWidth="2.5" style={{ ...strokeRound, animation: "steamA3 2.5s ease-out infinite .8s" }} />
      <g style={{ animation: "bowlFloat 3s ease-in-out infinite" }}>
        <path d="M18 68 Q18 54 30 48 L90 48 Q102 54 102 68 L98 88 Q60 92 22 88 Z" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2.5" />
        <ellipse cx="60" cy="50" rx="34" ry="8" fill="#FFB74D" opacity="0.7" />
        <path d="M30 48 Q60 40 90 48" fill="none" stroke="#D4A574" strokeWidth="1.5" opacity="0.5" />
      </g>
      <circle cx="35" cy="35" r="2.5" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite .5s" }} />
      <circle cx="88" cy="30" r="2" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite 1.2s" }} />
      <circle cx="55" cy="10" r="2" fill="#FF9F1C" style={{ animation: "sparkleA 2s ease-out infinite .8s" }} />
    </svg>
  );
}

function SteakCharacter() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <g style={{ animation: "plateFloat 3.5s ease-in-out infinite" }}>
        <ellipse cx="60" cy="82" rx="46" ry="10" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="80" rx="42" ry="8" fill="#FFF5E9" stroke="#E8D5C0" strokeWidth="1.5" />
        <ellipse cx="60" cy="65" rx="28" ry="16" fill="#8B4513" transform="rotate(-5 60 65)" />
        <ellipse cx="60" cy="62" rx="24" ry="13" fill="#A0522D" transform="rotate(-5 60 65)" />
        <line x1="45" y1="60" x2="75" y2="60" stroke="#6B3410" strokeWidth="2" opacity="0.6" style={strokeRound} />
        <line x1="44" y1="65" x2="76" y2="65" stroke="#6B3410" strokeWidth="2" opacity="0.6" style={strokeRound} />
        <line x1="43" y1="70" x2="77" y2="70" stroke="#6B3410" strokeWidth="2" opacity="0.6" style={strokeRound} />
        <circle cx="42" cy="52" r="4" fill="#4CAF50" opacity="0.7" />
        <circle cx="46" cy="50" r="3" fill="#66BB6A" opacity="0.6" />
      </g>
      <line x1="38" y1="52" x2="36" y2="38" stroke="#FF9F1C" strokeWidth="1.5" style={{ ...strokeRound, animation: "sizzleA 1.8s ease-out infinite" }} />
      <line x1="82" y1="48" x2="84" y2="34" stroke="#FF9F1C" strokeWidth="1.5" style={{ ...strokeRound, animation: "sizzleA 1.8s ease-out infinite .3s" }} />
      <line x1="60" y1="42" x2="60" y2="30" stroke="#FF9F1C" strokeWidth="1.5" style={{ ...strokeRound, animation: "sizzleA 1.8s ease-out infinite .6s" }} />
      <g style={{ animation: "knifeBob 2.5s ease-in-out infinite" }}>
        <line x1="18" y1="78" x2="18" y2="50" stroke="#C4B5A0" strokeWidth="3" style={strokeRound} />
        <line x1="14" y1="50" x2="22" y2="50" stroke="#C4B5A0" strokeWidth="2" style={strokeRound} />
      </g>
      <g style={{ animation: "knifeBob 2.5s ease-in-out infinite .7s" }}>
        <line x1="98" y1="78" x2="98" y2="50" stroke="#C4B5A0" strokeWidth="3" style={strokeRound} />
        <line x1="94" y1="50" x2="102" y2="50" stroke="#C4B5A0" strokeWidth="2" style={strokeRound} />
      </g>
    </svg>
  );
}

function PastaCharacter() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <g style={{ animation: "pastaFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="82" rx="44" ry="9" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="80" rx="40" ry="7" fill="#FFF5E9" stroke="#E8D5C0" strokeWidth="1.5" />
        <ellipse cx="60" cy="66" rx="26" ry="14" fill="#F5DEB3" />
        <g style={{ animation: "noodleWiggle 2s ease-in-out infinite" }}>
          <path d="M42 62 Q54 54 66 62 Q78 70 82 62" fill="none" stroke="#E8C9A0" strokeWidth="2.5" style={strokeRound} />
          <path d="M38 68 Q50 58 62 68 Q74 76 78 68" fill="none" stroke="#D4A574" strokeWidth="2.5" style={strokeRound} />
          <path d="M44 72 Q56 64 68 72 Q76 78 80 72" fill="none" stroke="#E8C9A0" strokeWidth="2.5" style={strokeRound} />
        </g>
        <ellipse cx="58" cy="62" rx="14" ry="8" fill="#C0392B" opacity="0.8" />
        <circle cx="50" cy="60" r="3" fill="#E74C3C" opacity="0.6" />
        <circle cx="64" cy="64" r="2" fill="#E74C3C" opacity="0.6" />
        <g style={{ animation: "leafDrop 2s ease-in-out infinite" }}>
          <ellipse cx="70" cy="56" rx="5" ry="3" fill="#4CAF50" transform="rotate(-20 70 56)" />
        </g>
      </g>
      <g style={{ animation: "forkSpin 2.5s ease-in-out infinite" }} transform="translate(85,30)">
        <line x1="0" y1="8" x2="0" y2="30" stroke="#C4B5A0" strokeWidth="2.5" style={strokeRound} />
        <line x1="-5" y1="4" x2="0" y2="8" stroke="#C4B5A0" strokeWidth="2" />
        <line x1="0" y1="4" x2="0" y2="8" stroke="#C4B5A0" strokeWidth="2" />
        <line x1="5" y1="4" x2="0" y2="8" stroke="#C4B5A0" strokeWidth="2" />
        <ellipse cx="0" cy="6" rx="7" ry="4" fill="#F5DEB3" stroke="#E8C9A0" strokeWidth="1" />
      </g>
    </svg>
  );
}

function CakeCharacter() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <g style={{ animation: "cakeFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="90" rx="44" ry="8" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
        <rect x="32" y="62" width="56" height="24" rx="4" fill="#D4A574" stroke="#C4A574" strokeWidth="1.5" />
        <rect x="34" y="56" width="52" height="8" rx="2" fill="#FFF5E9" />
        <path d="M34 56 Q36 48 42 50 Q48 44 54 48 Q60 42 66 48 Q72 44 78 50 Q84 48 86 56" fill="#FFB74D" stroke="#FF9F1C" strokeWidth="1.5" />
        <g style={{ animation: "cherryBob 1.5s ease-in-out infinite" }}>
          <circle cx="60" cy="42" r="5" fill="#C0392B" />
          <circle cx="59" cy="40" r="2" fill="#E74C3C" opacity="0.5" />
          <path d="M60 37 Q62 32 65 30" fill="none" stroke="#4CAF50" strokeWidth="1.5" style={strokeRound} />
        </g>
        <rect x="40" y="52" width="2.5" height="4" rx="1" fill="#4CAF50" transform="rotate(30 41 54)" style={{ animation: "sprinklePop 3s ease-out infinite" }} />
        <rect x="50" y="50" width="2.5" height="4" rx="1" fill="#FF9F1C" transform="rotate(-20 51 52)" style={{ animation: "sprinklePop 3s ease-out infinite .4s" }} />
        <rect x="68" y="51" width="2.5" height="4" rx="1" fill="#E74C3C" transform="rotate(45 69 53)" style={{ animation: "sprinklePop 3s ease-out infinite .8s" }} />
        <rect x="78" y="53" width="2.5" height="4" rx="1" fill="#4CAF50" transform="rotate(-35 79 55)" style={{ animation: "sprinklePop 3s ease-out infinite 1.2s" }} />
        <line x1="18" y1="88" x2="18" y2="60" stroke="#C4B5A0" strokeWidth="2.5" style={strokeRound} />
        <line x1="14" y1="60" x2="22" y2="60" stroke="#C4B5A0" strokeWidth="2" style={strokeRound} />
      </g>
    </svg>
  );
}

function SushiCharacter() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <g style={{ animation: "plateFloat 3s ease-in-out infinite" }}>
        <rect x="20" y="78" width="80" height="14" rx="3" fill="#D4A574" stroke="#C4A574" strokeWidth="1.5" />
        <line x1="22" y1="83" x2="98" y2="83" stroke="#C49660" strokeWidth="0.5" opacity="0.3" />
        <line x1="22" y1="87" x2="98" y2="87" stroke="#C49660" strokeWidth="0.5" opacity="0.3" />
        <g style={{ animation: "roll 2.5s ease-in-out infinite" }} transform="translate(30,62)">
          <ellipse cx="0" cy="12" rx="14" ry="8" fill="#FFF5E9" />
          <path d="M-14 12 Q-10 2 0 4 Q10 2 14 12" fill="#FA8072" stroke="#E06050" strokeWidth="1" />
          <line x1="-6" y1="8" x2="-2" y2="8" stroke="#FFF" strokeWidth="0.8" opacity="0.4" />
          <line x1="2" y1="7" x2="6" y2="7" stroke="#FFF" strokeWidth="0.8" opacity="0.4" />
        </g>
        <g style={{ animation: "roll 2.5s ease-in-out infinite .5s" }} transform="translate(60,62)">
          <ellipse cx="0" cy="12" rx="13" ry="7" fill="#FFF5E9" />
          <rect x="-13" y="4" width="26" height="8" rx="3" fill="#FFB74D" stroke="#FF9F1C" strokeWidth="1" />
          <rect x="-4" y="4" width="8" height="18" rx="1" fill="#2D4A22" opacity="0.7" />
        </g>
        <g style={{ animation: "roll 2.5s ease-in-out infinite .8s" }} transform="translate(88,62)">
          <circle cx="0" cy="10" r="10" fill="#2D4A22" opacity="0.85" />
          <circle cx="0" cy="10" r="7" fill="#FFF5E9" />
          <circle cx="-2" cy="8" r="3" fill="#FA8072" opacity="0.7" />
          <circle cx="3" cy="10" r="2.5" fill="#4CAF50" opacity="0.6" />
          <circle cx="0" cy="13" r="2" fill="#FFB74D" opacity="0.6" />
        </g>
        <ellipse cx="48" cy="74" rx="5" ry="3" fill="#9ACD32" opacity="0.5" />
        <ellipse cx="78" cy="76" rx="4" ry="2.5" fill="#FFB6C1" opacity="0.4" />
      </g>
      <g style={{ animation: "chopBob 2.5s ease-in-out infinite" }} transform="rotate(12 85 40)">
        <line x1="85" y1="20" x2="80" y2="74" stroke="#D4A574" strokeWidth="3" style={strokeRound} />
        <line x1="95" y1="20" x2="90" y2="74" stroke="#D4A574" strokeWidth="3" style={strokeRound} />
      </g>
    </svg>
  );
}

function DrinkCharacter() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <line x1="52" y1="30" x2="52" y2="16" stroke="#C4B5A0" strokeWidth="2" style={{ ...strokeRound, animation: "steamB1 2.5s ease-out infinite" }} />
      <line x1="60" y1="26" x2="60" y2="12" stroke="#C4B5A0" strokeWidth="2" style={{ ...strokeRound, animation: "steamB2 2.3s ease-out infinite .5s" }} />
      <line x1="68" y1="30" x2="68" y2="18" stroke="#C4B5A0" strokeWidth="2" style={{ ...strokeRound, animation: "steamB1 2.7s ease-out infinite 1s" }} />
      <g style={{ animation: "cupFloat 3s ease-in-out infinite" }}>
        <ellipse cx="60" cy="86" rx="38" ry="7" fill="#FEE6CB" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="85" rx="32" ry="5" fill="#FFF5E9" opacity="0.5" />
        <path d="M28 50 L35 80 Q60 84 85 80 L92 50 Z" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2.5" />
        <ellipse cx="60" cy="50" rx="32" ry="8" fill="#FFF5E9" stroke="#D4A574" strokeWidth="2" />
        <ellipse cx="60" cy="51" rx="28" ry="6" fill="#C49660" opacity="0.7" style={{ animation: "teaSwirl 2s ease-in-out infinite" }} />
        <ellipse cx="58" cy="48" rx="10" ry="3" fill="#E8C9A0" opacity="0.3" />
        <path d="M88 54 Q106 54 106 66 Q106 78 86 76" fill="none" stroke="#D4A574" strokeWidth="3" style={strokeRound} />
        <path d="M34 68 Q60 72 86 68" fill="none" stroke="#4CAF50" strokeWidth="1.5" opacity="0.3" />
        <g style={{ animation: "lemonBob 2s ease-in-out infinite" }} transform="translate(82,80)">
          <circle cx="0" cy="0" r="6" fill="#FFB74D" stroke="#FF9F1C" strokeWidth="1" />
          <line x1="-3" y1="-3" x2="3" y2="3" stroke="#FFF5E9" strokeWidth="1" />
          <line x1="-3" y1="3" x2="3" y2="-3" stroke="#FFF5E9" strokeWidth="1" />
        </g>
      </g>
    </svg>
  );
}

const characters = [
  SoupCharacter,
  SteakCharacter,
  PastaCharacter,
  CakeCharacter,
  SushiCharacter,
  DrinkCharacter,
] as const;

export function FoodCharacters({ activeIndex }: FoodCharactersProps) {
  return (
    <div
      className="food-character-stage"
      aria-label="菜单识别动画"
    >
      {characters.map((Character, index) => (
        <div
          key={index}
          className={`food-character${activeIndex === index ? " is-active" : ""}`}
          data-character-index={index}
          aria-hidden={activeIndex === index ? "false" : "true"}
        >
          <Character />
        </div>
      ))}
    </div>
  );
}
