import {
  getServerImageMaxDim,
  getServerImageQuality,
  shouldNormalizeClientImage,
} from "@/lib/image-input";

export async function normalizeServerMenuImage(
  input: { buffer: Buffer; mimeType: string; name?: string },
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!shouldNormalizeClientImage({ name: input.name, type: input.mimeType, size: input.buffer.length })) {
    return { buffer: input.buffer, mimeType: input.mimeType };
  }

  try {
    const sharp = (await import("sharp")).default;
    const maxDim = getServerImageMaxDim();
    const quality = getServerImageQuality();
    const buffer = await sharp(input.buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: maxDim,
        height: maxDim,
        fit: "inside",
        withoutEnlargement: true,
      })
      .sharpen({ sigma: 0.8, m1: 0.5, m2: 1.2 })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    return { buffer, mimeType: "image/jpeg" };
  } catch (err) {
    console.warn("server:image_normalize_failed", {
      name: input.name,
      size: input.buffer.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { buffer: input.buffer, mimeType: input.mimeType };
  }
}
