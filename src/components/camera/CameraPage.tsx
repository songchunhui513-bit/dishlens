"use client";

import Image from "next/image";
import { useState, useRef } from "react";
import type { CapturedPhoto } from "@/types";

const menuPages = [
  {
    title: "Menu du Jour",
    items: [
      "Boeuf Bourguignon …… 18€",
      "Sole Meunière ……… 22€",
      "Tarte Tatin ………… 10€",
      "Crème Brûlée ……… 9€",
    ],
  },
];

const pageLabels = ["前菜/主菜", "酒单", "甜点"];

interface CameraPageProps {
  onBack: () => void;
  onAnalyze: (photos: CapturedPhoto[]) => void;
}

export default function CameraPage({ onBack, onAnalyze }: CameraPageProps) {
  const [flash, setFlash] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [justCaptured, setJustCaptured] = useState(-1);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const photo: CapturedPhoto = {
          id: `photo-${Date.now()}-${i}`,
          dataUrl: reader.result as string,
          file,
          timestamp: Date.now(),
        };
        setPhotos((p) => {
          const updated = [...p, photo];
          const idx = updated.length - 1;
          setJustCaptured(idx);
          setTimeout(() => setJustCaptured(-1), 600);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    }

    setCurrentPage((prev) => (prev + files.length) % menuPages.length);

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (albumInputRef.current) albumInputRef.current.value = "";
  };

  const handleShoot = () => {
    cameraInputRef.current?.click();
  };

  const handleAlbumPick = () => {
    albumInputRef.current?.click();
  };

  const handleDelete = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotos((p) => p.filter((_, i) => i !== idx));
  };

  const page = menuPages[currentPage];

  return (
    <div className="h-full flex flex-col" style={{ background: "#1A1A1A" }}>
      {/* Hidden file input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="拍摄或选择菜单照片"
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="从相册选择菜单照片"
      />

      {/* Top bar */}
      <div className="flex justify-between items-center flex-shrink-0" style={{ padding: "10px 13px" }}>
        <button
          onClick={onBack}
          className="text-[11px] cursor-pointer"
          style={{ color: "rgba(255,255,255,0.6)", background: "none", border: "none" }}
        >
          ← 返回
        </button>
        <span
          className="text-[8px] tracking-wider"
          style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}
        >
          {photos.length > 0 ? `已拍 ${photos.length} 张` : "准备拍摄"}
        </span>
        <div style={{ width: 28 }} />
      </div>

      {/* Viewfinder */}
      <div className="flex-1 relative flex items-center justify-center" style={{ background: "#252525", minHeight: 310 }}>
        {flash && (
          <div className="absolute inset-0 z-50" style={{ background: "#FFF", opacity: 0.8 }} />
        )}

        {/* Mock menu overlay */}
        <div
          className="absolute overflow-auto"
          style={{
            inset: 18,
            background: "#FFFDF7",
            borderRadius: 4,
            padding: 14,
            opacity: 0.9,
          }}
        >
          {photos.length > 0 ? (
            <>
              <div className="text-center mb-2" style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, color: "var(--primary)" }}>
                已拍摄 {photos.length} 张照片
              </div>
              <div style={{ height: 1, background: "#DDD", marginBottom: 8 }} />
              <div className="flex flex-wrap gap-2">
                {photos.map((p, i) => (
                  <div key={p.id} className="relative rounded overflow-hidden" style={{ width: 60, height: 80, border: "1px solid #DDD" }}>
                    <Image src={p.dataUrl} alt={`第${i + 1}页`} fill sizes="60px" unoptimized style={{ objectFit: "cover" }} />
                    <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] py-0.5" style={{ background: "rgba(0,0,0,0.6)", color: "#FFF", fontFamily: "var(--font-body)" }}>
                      {pageLabels[i] || `第${i + 1}页`}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h4 className="text-center mb-2" style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, color: "#222" }}>
                {page.title}
              </h4>
              {page.items.map((line, i) => (
                <div
                  key={i}
                  className="py-[4.5px]"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 10,
                    color: "#555",
                    borderBottom: "1px solid #EEE",
                  }}
                >
                  {line}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Corner guides */}
        <div className="absolute top-[14px] left-[14px] w-4 h-4 border-t-[1.5px] border-l-[1.5px] border-white/35" />
        <div className="absolute top-[14px] right-[14px] w-4 h-4 border-t-[1.5px] border-r-[1.5px] border-white/35" />
        <div className="absolute bottom-[14px] left-[14px] w-4 h-4 border-b-[1.5px] border-l-[1.5px] border-white/35" />
        <div className="absolute bottom-[14px] right-[14px] w-4 h-4 border-b-[1.5px] border-r-[1.5px] border-white/35" />
      </div>

      {/* Tips row */}
      <div className="flex gap-[18px] justify-center flex-shrink-0" style={{ padding: "8px 16px" }}>
        {[
          { label: "完整页面", svg: <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "rgba(255,255,255,0.4)", fill: "none", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" }}><rect x="4" y="3" width="16" height="18" rx="2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="14" y2="12" /></svg> },
          { label: "光线充足", svg: <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "rgba(255,255,255,0.4)", fill: "none", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" }}><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /></svg> },
          { label: "可连拍", svg: <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "rgba(255,255,255,0.4)", fill: "none", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" }}><rect x="2" y="4" width="14" height="16" rx="2" /><polyline points="16,8 22,12 16,16" /></svg> },
        ].map(({ label, svg }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            {svg}
            <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Thumbnail strip */}
      {photos.length > 0 && (
        <div className="flex gap-2 items-center overflow-auto flex-shrink-0" style={{ padding: "12px 16px 0", background: "#1A1A1A" }}>
          {photos.map((p, i) => (
            <div
              key={p.id}
              className="relative flex-shrink-0 rounded transition-all duration-200 overflow-hidden"
              style={{
                minWidth: 48,
                height: 64,
                border: i === justCaptured ? "2px solid var(--primary)" : "1px solid #555",
              }}
            >
              <Image src={p.dataUrl} alt={`第${i + 1}页`} fill sizes="48px" unoptimized style={{ objectFit: "cover" }} />
              <div className="absolute bottom-0 left-0 right-0 text-center text-[7px] py-px" style={{ background: "rgba(0,0,0,0.5)", color: "#FFF", fontFamily: "var(--font-body)" }}>
                {pageLabels[i] || `第${i + 1}页`}
              </div>
              <button
                onClick={(e) => handleDelete(i, e)}
                className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] cursor-pointer"
                style={{ background: "#555", color: "#FFF" }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={handleShoot}
            className="flex-shrink-0 flex items-center justify-center rounded cursor-pointer"
            style={{ minWidth: 48, height: 64, border: "1px dashed #555" }}
          >
            <span style={{ color: "#555", fontSize: 20 }}>+</span>
          </button>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center flex-shrink-0"
        style={{
          padding: "12px 22px calc(20px + env(safe-area-inset-bottom))",
          background: "#1A1A1A",
        }}
      >
        <button
          onClick={handleAlbumPick}
          aria-label="从相册选择菜单照片"
          className="justify-self-start flex flex-col items-center justify-center gap-1 cursor-pointer transition-transform duration-150 active:scale-[0.94]"
          style={{
            minWidth: 58,
            minHeight: 58,
            color: "rgba(255,255,255,0.58)",
            fontFamily: "var(--font-body)",
            background: "none",
            border: "none",
          }}
        >
          <span
            className="flex items-center justify-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.36)",
              background: "rgba(255,255,255,0.06)",
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "currentColor", fill: "none", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="8" cy="10" r="1.5" />
              <path d="M4.5 17l4.8-4.8a1.6 1.6 0 0 1 2.2 0L16 16.7" />
              <path d="M14 14.8l1.6-1.6a1.6 1.6 0 0 1 2.2 0L20 15.4" />
            </svg>
          </span>
          <span style={{ fontSize: 8, fontWeight: 600, lineHeight: 1 }}>相册</span>
        </button>

        <button
          onClick={handleShoot}
          aria-label="拍摄菜单照片"
          className="justify-self-center flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-[0.92]"
          style={{
            width: 58,
            height: 58,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.5)",
            background: "none",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
          }}
        >
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.88)" }} />
        </button>

        {photos.length > 0 ? (
          <button
            onClick={() => onAnalyze(photos)}
            aria-label={`分析全部 ${photos.length} 张菜单照片`}
            className="justify-self-end flex flex-col items-center justify-center transition-transform duration-150 active:scale-[0.96]"
            style={{
              minWidth: 68,
              minHeight: 48,
              padding: "8px 12px",
              borderRadius: 18,
              border: "none",
              background: "var(--primary)",
              color: "#FFF",
              fontFamily: "var(--font-body)",
              boxShadow: "0 4px 20px rgba(76,175,80,0.3)",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.1 }}>完成</span>
            <span style={{ marginTop: 2, fontSize: 8, fontWeight: 600, opacity: 0.82 }}>{photos.length} 张</span>
          </button>
        ) : (
          <div aria-hidden="true" style={{ width: 68, justifySelf: "end" }} />
        )}
      </div>
    </div>
  );
}
