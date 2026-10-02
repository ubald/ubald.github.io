import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { defineCollection } from "astro:content";
import { glob, type Loader } from "astro/loaders";
import { z } from "astro/zod";

// Entries are identified by their path (e.g. `network-collaboration/1-introduction`) rather than
// their `slug`, which only drives the permalink, like Hugo's `/:sections/:slug`.
const pathId = ({ entry }: { entry: string }) => entry.replace(/(^|\/)(_?index)\.mdx?$/, "") || "_index";

const stringList = z.array(z.string()).optional();

/**
 * A glob loader for Hugo-style page bundles:
 * - drafts are left out of production builds, along with their images, like Hugo did;
 * - `poster` and `avatar` images are looked up in the page bundle first, then in the global assets
 *   (`src/assets`), and ignored when missing, like the Hugo templates did. They resolve to paths
 *   relative to the entry, so the schema's `image()` only publishes the images actually used.
 */
function bundleGlob(options: Parameters<typeof glob>[0], imageFields: string[]): Loader {
    const loader = glob(options);
    const isExcludedDraft = (data?: Record<string, unknown>) => data?.draft === true && !import.meta.env.DEV;
    return {
        ...loader,
        load: (context) => {
            const store = new Proxy(context.store, {
                get(target, property) {
                    if (property === "set") {
                        return (entry: Parameters<typeof target.set>[0]) =>
                            isExcludedDraft(entry.data) ? target.delete(entry.id) : target.set(entry);
                    }
                    if (property === "get") {
                        // Never reuse a draft cached by a previous (development) run.
                        return (id: string) => {
                            const entry = target.get(id);
                            return isExcludedDraft(entry?.data) ? undefined : entry;
                        };
                    }
                    const value = Reflect.get(target, property);
                    return typeof value === "function" ? value.bind(target) : value;
                },
            });
            const parseData: typeof context.parseData = (props) => {
                const file = isAbsolute(props.filePath!) ? props.filePath! : join(process.cwd(), props.filePath!);
                const data: Record<string, unknown> = { ...props.data };
                for (const field of imageFields) {
                    const name = data[field];
                    if (typeof name !== "string") continue;
                    const found = [join(dirname(file), name), join(process.cwd(), "src/assets", name)].find(existsSync);
                    if (found) data[field] = `./${relative(dirname(file), found)}`;
                    else delete data[field];
                }
                return context.parseData({ ...props, data: data as typeof props.data });
            };
            return loader.load({ ...context, store, parseData });
        },
    };
}

// Hugo's `_index.md` branch bundles: the home page and the article sections (and series).
const sections = defineCollection({
    loader: bundleGlob({ base: "./src/content", pattern: "**/_index.md", generateId: pathId }, ["poster"]),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            type: z.string().optional(),
            summary: z.string().optional(),
            description: z.string().optional(),
            date: z.coerce.date().optional(),
            poster: image().optional(),
            poster_monochrome: z.boolean().optional(),
            cascade: z.object({ author: z.string().optional() }).optional(),
        }),
});

const articles = defineCollection({
    loader: bundleGlob({ base: "./src/content/articles", pattern: "**/index.{md,mdx}", generateId: pathId }, [
        "poster",
    ]),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            slug: z.string().optional(),
            summary: z.string().optional(),
            description: z.string().optional(),
            excerpt: z.string().optional(),
            date: z.coerce.date().optional(),
            draft: z.boolean().default(false),
            author: z.string().optional(),
            category: z.string().optional(),
            categories: stringList,
            tags: stringList,
            poster: image().optional(),
        }),
});

const authors = defineCollection({
    loader: bundleGlob({ base: "./src/content/authors", pattern: "*/index.md", generateId: pathId }, [
        "poster",
        "avatar",
    ]),
    schema: ({ image }) =>
        z.object({
            title: z.string(),
            shortname: z.string(),
            name: z.string(),
            email: z.string().optional(),
            github: z.string().optional(),
            linkedin: z.string().optional(),
            poster: image().optional(),
            avatar: image().optional(),
            url: z.string().optional(),
            summary: z.string().optional(),
        }),
});

export const collections = { sections, articles, authors };
