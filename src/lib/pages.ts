import { readdirSync } from "node:fs";
import { join } from "node:path";
import { getCollection, render, type CollectionEntry } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { loadRenderers } from "astro:container";
import { getContainerRenderer } from "@astrojs/mdx/container-renderer";
import { site } from "./site.ts";
import { humanize, plainText, readingTime, truncateWordsToWholeSentence, urlize, wordCount } from "./text.ts";

/**
 * A small model of Hugo's page tree, so the layouts can keep the same logic (and output) as the
 * former Hugo templates: page kinds, sections and series, taxonomies, summaries and reading time.
 */

export type Entry = CollectionEntry<"sections"> | CollectionEntry<"articles"> | CollectionEntry<"authors">;
export type Kind = "home" | "section" | "page" | "taxonomy" | "term" | "404";

export interface Page {
    kind: Kind;
    /** Hugo's `.Type`: the `type` front matter, or the top-level section. */
    type: string;
    title: string;
    /** Root-relative permalink, with a trailing slash. */
    url: string;
    date?: Date;
    params: Record<string, any>;
    entry?: Entry;
    /** Content directory of the page bundle, relative to `src/content`. */
    bundle?: string;
    parent?: Page;
    /** Direct children, for sections. */
    pages: Page[];
    /** What the list layout paginates (Hugo's `.RegularPagesRecursive`). */
    listPages: Page[];
    /** For taxonomies and terms, the singular taxonomy name (`category`, `tag`). */
    singular?: string;
    /** For taxonomies, the term pages (feed items). */
    terms?: Page[];
    summary: string;
    wordCount: number;
    readingTime: number;
    /** For regular pages, the author page (`/authors/<author>`) for the `author` parameter. */
    author?: Page;
}

export interface Resource {
    url: string;
    file: string;
}

export interface Site {
    home: Page;
    /** Every rendered page, home and lists included. */
    pages: Page[];
    /** Regular pages (articles and authors), sorted like Hugo's `.Site.RegularPages`. */
    regularPages: Page[];
    /** Page bundle files published next to their page, like Hugo's page resources. */
    resources: Resource[];
}

const contentDir = join(process.cwd(), "src/content");

const taxonomies = [
    { plural: "categories", singular: "category", title: "Categories" },
    { plural: "tags", singular: "tag", title: "Tags" },
];

/** Hugo's default page order: date (newest first), then title. */
export const byDefaultOrder = (a: Page, b: Page) =>
    (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity) || a.title.localeCompare(b.title);

const defined = (data: object) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

const latestDate = (pages: Page[]) =>
    pages
        .map((p) => p.date)
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0];

const newPage = (page: Partial<Page> & Pick<Page, "kind" | "type" | "title" | "url">): Page => ({
    params: {},
    pages: [],
    listPages: [],
    summary: "",
    wordCount: 0,
    readingTime: 0,
    ...page,
});

let container: Promise<AstroContainer> | undefined;

/** The entry's rendered HTML, the equivalent of Hugo's `.Content`. */
async function renderToHtml(entry: Entry): Promise<string> {
    if (entry.rendered) return entry.rendered.html;
    container ??= loadRenderers([getContainerRenderer()]).then((renderers) => AstroContainer.create({ renderers }));
    const { Content } = await render(entry);
    return (await container).renderToString(Content);
}

/** Fills in Hugo's `.Summary`, `.WordCount` and `.ReadingTime`. */
async function summarize(page: Page) {
    const plain = plainText(await renderToHtml(page.entry!));
    page.wordCount = wordCount(plain);
    page.readingTime = readingTime(page.wordCount);
    page.summary = page.params.summary ?? truncateWordsToWholeSentence(plain, site.summaryLength);
}

function bundleResources(page: Page): Resource[] {
    const dir = join(contentDir, page.bundle!);
    return readdirSync(dir)
        .filter((file) => !/^index\.mdx?$/.test(file))
        .map((file) => ({ url: `${page.url}${file}`, file: join(dir, file) }));
}

async function buildSite(): Promise<Site> {
    const sectionEntries = await getCollection("sections");
    const articleEntries = await getCollection("articles", ({ data }) => site.buildDrafts || !data.draft);
    const authorEntries = await getCollection("authors");

    const homeEntry = sectionEntries.find((e) => e.id === "_index")!;
    const cascade = homeEntry.data.cascade ?? {};
    const home = newPage({
        kind: "home",
        type: "page",
        title: homeEntry.data.title,
        url: "/",
        date: homeEntry.data.date,
        params: homeEntry.data,
        entry: homeEntry,
        summary: homeEntry.data.summary ?? "",
    });

    // Sections, keyed by their content path (`articles`, `articles/network-collaboration`).
    const sections = new Map<string, Page>();
    for (const entry of sectionEntries.filter((e) => e !== homeEntry)) {
        sections.set(
            entry.id,
            newPage({
                kind: "section",
                type: entry.data.type ?? entry.id.split("/")[0],
                title: entry.data.title,
                url: `/${entry.id}/`,
                date: entry.data.date,
                params: entry.data,
                entry,
            }),
        );
    }
    const sectionFor = (path: string): Page => {
        const top = path.split("/")[0];
        if (!sections.has(top)) {
            const title = top.charAt(0).toUpperCase() + top.slice(1);
            sections.set(top, newPage({ kind: "section", type: top, title, url: `/${top}/` }));
        }
        for (let dir = path; dir.includes("/");) {
            dir = dir.slice(0, dir.lastIndexOf("/"));
            if (sections.has(dir)) return sections.get(dir)!;
        }
        return sections.get(top)!;
    };

    const regularPages: Page[] = [];
    for (const entry of articleEntries) {
        const bundle = `articles/${entry.id}`;
        const section = sectionFor(bundle);
        regularPages.push(
            newPage({
                kind: "page",
                type: "articles",
                title: entry.data.title,
                // Hugo permalink `articles: /:sections/:slug`, where `:slug` falls back to the title.
                url: `${section.url}${entry.data.slug ?? urlize(entry.data.title)}/`,
                date: entry.data.date,
                params: { ...cascade, ...defined(entry.data) },
                entry,
                bundle,
                parent: section,
            }),
        );
    }
    for (const entry of authorEntries) {
        const bundle = `authors/${entry.id}`;
        regularPages.push(
            newPage({
                kind: "page",
                type: "authors",
                title: entry.data.title,
                url: entry.data.url ? `${entry.data.url.replace(/\/$/, "")}/` : `/${bundle}/`,
                params: { ...cascade, ...defined(entry.data) },
                entry,
                bundle,
                parent: sectionFor(bundle),
            }),
        );
    }
    await Promise.all(regularPages.map(summarize));
    regularPages.sort(byDefaultOrder);

    for (const page of regularPages) {
        page.parent!.pages.push(page);
        page.author = regularPages.find((p) => p.bundle === `authors/${urlize(page.params.author ?? "")}`);
    }
    for (const section of sections.values()) {
        section.listPages = regularPages.filter((p) => p.url.startsWith(section.url) || p.parent === section);
        section.date ??= latestDate(section.listPages);
        const parentPath = section.url.slice(1, -1).split("/").slice(0, -1).join("/");
        section.parent = parentPath ? sections.get(parentPath) : home;
    }

    const taxonomyPages: Page[] = [];
    for (const { plural, singular, title } of taxonomies) {
        const terms = new Map<string, Page>();
        for (const page of regularPages) {
            for (const term of new Set<string>(page.params[plural] ?? [])) {
                const key = urlize(term);
                if (!terms.has(key)) {
                    terms.set(
                        key,
                        newPage({ kind: "term", type: plural, title: term, url: `/${plural}/${key}/`, singular }),
                    );
                }
                terms.get(key)!.listPages.push(page);
            }
        }
        const termPages = [...terms.values()];
        for (const term of termPages) term.date = latestDate(term.listPages);
        termPages.sort(byDefaultOrder);
        const taxonomy = newPage({
            kind: "taxonomy",
            type: plural,
            title,
            url: `/${plural}/`,
            singular,
            terms: termPages,
            date: latestDate(termPages),
        });
        taxonomyPages.push(taxonomy, ...termPages);
    }

    return {
        home,
        regularPages,
        pages: [home, ...sections.values(), ...regularPages, ...taxonomyPages],
        resources: regularPages.flatMap(bundleResources),
    };
}

let sitePromise: Promise<Site> | undefined;

/** The whole site, built once per build (and on every request in dev, to pick up content edits). */
export const getSite = () => (import.meta.env.DEV ? buildSite() : (sitePromise ??= buildSite()));

export const isList = (page: Page) => page.kind !== "page";

/** Hugo's `.Parent.Type == "series"` check. */
export const inSeries = (page: Page) => page.parent?.type === "series";

/** Position of the page in its series (Hugo's `values/series-part-number` partial). */
export const seriesPartNumber = (page: Page) =>
    inSeries(page) ? [...page.parent!.pages].reverse().indexOf(page) + 1 : 0;

export { humanize, urlize };
