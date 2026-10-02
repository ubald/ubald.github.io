import type { LocalImageService } from "astro";
import sharpService from "astro/assets/services/sharp";
import sharp, { type FormatEnum } from "sharp";

/**
 * Astro's Sharp image service, plus a `grayscale` option standing in for Hugo's
 * `images.Filter images.Grayscale` (used by the home page's monochrome poster).
 */
const service: LocalImageService = {
    ...sharpService,
    propertiesToHash: [
        ...(sharpService.propertiesToHash ?? [
            "src",
            "width",
            "height",
            "format",
            "quality",
            "fit",
            "position",
            "background",
        ]),
        "grayscale",
    ],
    async getURL(options, imageConfig, logger) {
        const url = await sharpService.getURL(options, imageConfig, logger);
        return options.grayscale ? `${url}&grayscale=true` : url;
    },
    parseURL(url, imageConfig, logger) {
        // The base service parses synchronously.
        const options = sharpService.parseURL(url, imageConfig, logger) as Awaited<
            ReturnType<typeof sharpService.parseURL>
        >;
        if (options && url.searchParams.get("grayscale") === "true") options.grayscale = true;
        return options;
    },
    async transform(inputBuffer, options, imageConfig, logger) {
        const result = await sharpService.transform(inputBuffer, options, imageConfig, logger);
        if (!options.grayscale) return result;
        const quality = typeof options.quality === "number" ? options.quality : undefined;
        const format = (result.format === "jpg" ? "jpeg" : result.format) as keyof FormatEnum;
        const data = await sharp(result.data)
            .grayscale()
            .toFormat(format, quality ? { quality } : {})
            .toBuffer();
        return { data: new Uint8Array(data), format: result.format };
    },
};

export default service;
