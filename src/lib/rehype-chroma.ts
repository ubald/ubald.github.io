import type { Element, Root, RootContent } from "hast";
import { highlight, highlightedLines } from "./highlight.ts";

const textOf = (node: Element | RootContent): string =>
    node.type === "text" ? node.value : "children" in node ? node.children.map(textOf).join("") : "";

/** Replaces fenced code blocks (`pre > code`) with Chroma-compatible highlighted markup. */
export default function rehypeChroma() {
    return async (tree: Root) => {
        const blocks: { parent: Root | Element; index: number; code: Element }[] = [];
        const walk = (parent: Root | Element) => {
            parent.children.forEach((child, index) => {
                if (child.type !== "element") return;
                const code =
                    child.tagName === "pre"
                        ? child.children.find((c): c is Element => c.type === "element" && c.tagName === "code")
                        : undefined;
                if (code) blocks.push({ parent, index, code });
                else walk(child);
            });
        };
        walk(tree);

        for (const { parent, index, code } of blocks) {
            const classes = (code.properties.className as string[] | undefined) ?? [];
            const lang = classes.find((c) => c.startsWith("language-"))?.slice("language-".length) ?? "";
            const meta =
                (code.data as { meta?: string } | undefined)?.meta ??
                (code.properties.metastring as string | undefined);
            parent.children[index] = await highlight(textOf(code), lang, highlightedLines(meta));
        }
    };
}
