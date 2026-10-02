import { readFile } from "node:fs/promises";
import type { APIRoute, GetStaticPaths } from "astro";
import { formatIso, formatRfc822 } from "~/lib/dates.ts";
import { byDefaultOrder, getSite, type Page } from "~/lib/pages.ts";
import { site } from "~/lib/site.ts";

/** The non-HTML outputs: RSS feeds, the sitemap, and the page bundles' files. */

type Props = { feed: Page; items: Page[] } | { sitemap: Page[] } | { resource: string };

export const getStaticPaths = (async () => {
    const { pages, regularPages, resources } = await getSite();
    // The home feed lists every regular page, sections their own pages, taxonomies their terms.
    const feedItems = (page: Page) =>
        page.kind === "home"
            ? regularPages
            : page.kind === "taxonomy"
              ? page.terms!
              : page.kind === "section"
                ? page.pages
                : page.listPages;
    return [
        ...pages
            .filter((page) => page.kind !== "page")
            .map((page) => ({
                params: { file: `${page.url.slice(1)}index.xml` },
                props: { feed: page, items: feedItems(page) } as Props,
            })),
        { params: { file: "sitemap.xml" }, props: { sitemap: pages } as Props },
        ...resources.map(({ url, file }) => ({ params: { file: url.slice(1) }, props: { resource: file } as Props })),
    ];
}) satisfies GetStaticPaths;

const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const xml = (body: string, type: string) =>
    new Response(`<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n${body}`, {
        headers: { "Content-Type": `${type}; charset=utf-8` },
    });

/** Hugo's built-in RSS template. */
function feed(page: Page, items: Page[], base: URL) {
    const permalink = (p: Page) => new URL(p.url, base).href;
    const title = page.title === site.title ? site.title : `${page.title} on ${site.title}`;
    const description = `Recent content ${page.title === site.title ? "" : `in ${page.title} `}on ${site.title}`;
    return `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(title)}</title>
    <link>${permalink(page)}</link>
    <description>${escape(description)}</description>
    <generator>Astro</generator>
    <language>${site.languageCode}</language>
    <copyright>${escape(site.copyright)}</copyright>${page.date ? `\n    <lastBuildDate>${formatRfc822(page.date)}</lastBuildDate>` : ""}
    <atom:link href="${permalink(page)}index.xml" rel="self" type="application/rss+xml" />${items
        .map(
            (item) => `
    <item>
      <title>${escape(item.title)}</title>
      <link>${permalink(item)}</link>
      <pubDate>${formatRfc822(item.date)}</pubDate>
      <guid>${permalink(item)}</guid>
      <description>${escape(item.summary)}</description>
    </item>`,
        )
        .join("")}
  </channel>
</rss>
`;
}

/** Hugo's built-in sitemap template. */
function sitemap(pages: Page[], base: URL) {
    const urls = [...pages].sort(byDefaultOrder).map(
        (page) => `
  <url>
    <loc>${new URL(page.url, base).href}</loc>${page.date ? `\n    <lastmod>${formatIso(page.date)}</lastmod>` : ""}
  </url>`,
    );
    return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}
</urlset>
`;
}

export const GET: APIRoute<Props> = async ({ props, site: base }) => {
    if ("feed" in props) return xml(feed(props.feed, props.items, base!), "application/rss+xml");
    if ("sitemap" in props) return xml(sitemap(props.sitemap, base!), "application/xml");
    return new Response(await readFile(props.resource));
};
