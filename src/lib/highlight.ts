import type { Element, ElementContent } from "hast";
import { bundledLanguages, createHighlighter, type BundledLanguage, type Highlighter } from "shiki";

/**
 * Renders code the way Hugo's Chroma highlighter did (`lineNos: true`, `lineNumbersInTable: true`,
 * `anchorLineNos: true`, `noClasses: false`), so `styles/syntax.scss` keeps working unchanged:
 *
 *   div.highlight > div.chroma > table.lntable > tr > td.lntd (line numbers) + td.lntd (code)
 *
 * Shiki tokenizes with TextMate grammars; each token's scopes are mapped to the Pygments short
 * class names Chroma emits (`k`, `nf`, `s2`, ...). Highlighted lines (`hl_lines`) are wrapped in
 * `span.hl`, in both columns.
 */

// First matching rule wins; a rule matches when any scope of the token starts with the prefix.
const scopeClasses: [prefix: string, className: string][] = [
    ["comment", "c1"],
    ["meta.function.decorator", "nd"],
    ["string.quoted.docstring", "sd"],
    ["constant.character.escape", "se"],
    ["storage.type.string", "sa"],
    ["meta.fstring", "si"],
    ["string.quoted.single", "s1"],
    ["string.quoted.double", "s2"],
    ["string.regexp", "sr"],
    ["string", "s"],
    ["entity.name.function.decorator", "nd"],
    ["punctuation.definition.decorator", "nd"],
    ["constant.numeric.float", "mf"],
    ["constant.numeric.hex", "mh"],
    ["constant.numeric", "mi"],
    ["constant.other.ellipsis", "o"],
    ["constant.language", "kc"],
    ["support.function.magic", "fm"],
    ["support.variable.magic", "vm"],
    ["variable.language.special.self", "bp"],
    ["variable.parameter.function.language.special.self", "bp"],
    ["variable.language.special.cls", "bp"],
    ["variable.parameter.function.language.special.cls", "bp"],
    ["entity.name.type.class", "nc"],
    ["entity.name.function", "nf"],
    ["support.type.exception", "ne"],
    ["support.function.builtin", "nb"],
    ["support.type", "nb"],
    ["keyword.control.import", "kn"],
    ["keyword.operator.logical", "ow"],
    ["keyword.operator.in", "ow"],
    ["keyword.operator", "o"],
    ["punctuation.separator.period", "o"],
    ["punctuation.separator.annotation.result", "o"],
    ["keyword", "k"],
    ["storage", "k"],
    ["constant", "no"],
    ["punctuation", "p"],
];

// Words Chroma's Python lexer (a Python 2 era one) classified differently than the TextMate grammar.
const wordClasses: Record<string, Record<string, string>> = {
    python: {
        ...{ print: "k", exec: "k", None: "bp", True: "bp", False: "bp" },
        ...{ in: "ow", is: "ow", not: "ow", and: "ow", or: "ow" },
        ...{ buffer: "nb", id: "nb", metaclass: "n", __init_subclass__: "nf" },
    },
};

const classFor = (language: string, content: string, scopes: string[]): string => {
    if (/^\s+$/.test(content) || language === "text") return "";
    if (!scopes.some((scope) => /^(string|comment|meta\.fstring)/.test(scope))) {
        const wordClass = wordClasses[language]?.[content];
        if (wordClass) return wordClass;
    }
    for (const [prefix, className] of scopeClasses) {
        if (scopes.some((scope) => scope === prefix || scope.startsWith(`${prefix}.`))) return className;
    }
    return "n";
};

let highlighter: Promise<Highlighter> | undefined;
const loadedLanguages = new Set<string>();

const getHighlighter = async (lang: string) => {
    highlighter ??= createHighlighter({ themes: ["min-light"], langs: [] });
    const instance = await highlighter;
    if (lang in bundledLanguages && !loadedLanguages.has(lang)) {
        await instance.loadLanguage(lang as BundledLanguage);
        loadedLanguages.add(lang);
    }
    return instance;
};

const element = (tagName: string, properties: Element["properties"], children: ElementContent[]): Element => ({
    type: "element",
    tagName,
    properties,
    children,
});
const text = (value: string): ElementContent => ({ type: "text", value });

/** Parses Hugo's code fence options, e.g. `{hl_lines=["1","6-11"]}`, into the highlighted line numbers. */
export function highlightedLines(meta: string | undefined): Set<number> {
    const lines = new Set<number>();
    const hlLines = meta?.match(/hl_lines\s*=\s*\[([^\]]*)\]/)?.[1] ?? meta?.match(/hl_lines\s*=\s*"([^"]*)"/)?.[1] ?? "";
    for (const range of hlLines.replace(/"/g, "").split(/[\s,]+/).filter(Boolean)) {
        const [start, end = start] = range.split("-").map(Number);
        for (let line = start; line <= end; line++) lines.add(line);
    }
    return lines;
}

/** Highlights `code` and returns Chroma-compatible HAST. `lang` may be empty for plain text. */
export async function highlight(code: string, lang = "", hlLines = new Set<number>()): Promise<Element> {
    const language = lang in bundledLanguages ? lang : "text";
    const instance = await getHighlighter(language);
    const lines = instance.codeToTokens(code.replace(/\n$/, ""), {
        lang: language as BundledLanguage | "text",
        theme: "min-light",
        includeExplanation: "scopeName",
    }).tokens;

    const codeChildren: ElementContent[] = [];
    lines.forEach((line, index) => {
        const lineChildren: ElementContent[] = [];
        let previous: { className: string; value: string } | undefined;
        const flush = () => {
            if (!previous) return;
            lineChildren.push(
                previous.className ? element("span", { className: [previous.className] }, [text(previous.value)]) : text(previous.value),
            );
            previous = undefined;
        };
        for (const token of line) {
            const parts = token.explanation ?? [{ content: token.content, scopes: [] }];
            for (const part of parts) {
                // Like Chroma, whitespace between tokens stays bare text.
                const className = classFor(language, part.content, part.scopes.map((s) => s.scopeName));
                if (previous && previous.className === className) {
                    previous.value += part.content;
                } else {
                    flush();
                    previous = { className, value: part.content };
                }
            }
        }
        flush();
        lineChildren.push(text("\n"));
        codeChildren.push(...(hlLines.has(index + 1) ? [element("span", { className: ["hl"] }, lineChildren)] : lineChildren));
    });

    const width = String(lines.length).length;
    const lineNumbers = lines.map((_, index) => {
        const number = element("span", { className: ["lnt"], id: String(index + 1) }, [text(`${String(index + 1).padStart(width)}\n`)]);
        return hlLines.has(index + 1) ? element("span", { className: ["hl"] }, [number]) : number;
    });

    const codeProperties = lang ? { className: [`language-${lang}`], dataLang: lang } : {};
    return element("div", { className: ["highlight"] }, [
        element("div", { className: ["chroma"] }, [
            element("table", { className: ["lntable"] }, [
                element("tr", {}, [
                    element("td", { className: ["lntd"] }, [element("pre", { className: ["chroma"] }, [element("code", {}, lineNumbers)])]),
                    element("td", { className: ["lntd"] }, [
                        element("pre", { className: ["chroma"] }, [element("code", codeProperties, codeChildren)]),
                    ]),
                ]),
            ]),
        ]),
    ]);
}
