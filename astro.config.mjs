// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import { remarkDefinitionList, defListHastHandlers } from "remark-definition-list";
import remarkEmoji from "remark-emoji";
import rehypeChroma from "./src/lib/rehype-chroma.ts";

export default defineConfig({
    site: "https://ubald.dev",
    trailingSlash: "ignore",
    build: {
        format: "directory",
    },
    image: {
        service: {
            entrypoint: "./src/lib/image-service.ts",
            config: { kernel: "lanczos3" },
        },
    },
    markdown: {
        // Code blocks are rendered by rehype-chroma, mirroring Hugo's Chroma markup and classes.
        syntaxHighlight: false,
        processor: unified({
            remarkPlugins: [remarkDefinitionList, remarkEmoji],
            rehypePlugins: [rehypeChroma],
            remarkRehype: { handlers: defListHastHandlers },
            // Match Goldmark's typographer: "--" is an en dash, "---" an em dash, no backtick quotes.
            smartypants: { dashes: "oldschool", backticks: false },
        }),
    },
    integrations: [mdx()],
    vite: {
        css: {
            preprocessorOptions: {
                scss: {
                    // The stylesheets predate Dart Sass' module system; keep them as they are.
                    silenceDeprecations: ["import", "global-builtin", "color-functions", "slash-div"],
                },
            },
        },
    },
});
