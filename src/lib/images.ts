import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";

interface FitOptions {
    quality?: number;
    format?: "jpg" | "png";
    grayscale?: boolean;
}

/** Hugo's `.Fit "<size>x<size>"`: scaled down (never up) to fit in a square, keeping the aspect ratio. */
export async function fit(image: ImageMetadata, size: number, { quality, format, grayscale }: FitOptions): Promise<string> {
    // Read the metadata from a clone: reading the image itself would also publish the original file.
    const { width, height, format: sourceFormat } = (image as ImageMetadata & { clone?: ImageMetadata }).clone ?? image;
    const scale = Math.min(1, size / width, size / height);
    const result = await getImage({
        src: image,
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        quality,
        format: format ?? (sourceFormat as "jpg" | "png"),
        ...(grayscale ? { grayscale } : {}),
    });
    return result.src;
}
