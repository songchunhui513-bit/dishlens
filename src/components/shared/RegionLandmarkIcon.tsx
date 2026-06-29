"use client";

import Image from "next/image";

import { getRegionLandmark, resolveRegionLandmark, type RegionLandmarkKey } from "@/lib/region-landmarks";

interface Props {
  lang?: string;
  country?: string;
  cuisine?: string;
  restaurantName?: string;
  landmarkKey?: RegionLandmarkKey;
  size?: number;
}

export default function RegionLandmarkIcon({ lang, country, cuisine, restaurantName, landmarkKey, size = 36 }: Props) {
  const landmark = landmarkKey
    ? getRegionLandmark(landmarkKey)
    : resolveRegionLandmark({ sourceLang: lang, country, cuisine, restaurantName });
  const imageSrc = `/icons/landmarks/${landmark.key}.png`;
  const landmarkImageSize = Math.round(size * 0.76);

  return (
    <span
      style={{
        display: "inline-grid",
        placeItems: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(254,230,203,0.64)",
        border: "1px solid rgba(232,213,192,0.62)",
        lineHeight: 0,
        flexShrink: 0,
      }}
      title={landmark.landmarkZh}
      aria-label={landmark.landmarkZh}
    >
      <Image
        src={imageSrc}
        alt=""
        width={landmarkImageSize}
        height={landmarkImageSize}
        style={{
          width: landmarkImageSize,
          height: landmarkImageSize,
          objectFit: "contain",
          display: "block",
          opacity: 0.94,
        }}
        aria-hidden="true"
      />
    </span>
  );
}

export function CuisineIllustration(props: Props) {
  return <RegionLandmarkIcon {...props} />;
}
