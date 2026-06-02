import {
  SERVER_IMAGE_MAX_DIM,
  SERVER_IMAGE_QUALITY,
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
    const buffer = await sharp(input.buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: SERVER_IMAGE_MAX_DIM,
        height: SERVER_IMAGE_MAX_DIM,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: SERVER_IMAGE_QUALITY, mozjpeg: true })
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
