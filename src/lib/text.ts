import { decodeHTML } from "entities";

/** Text helpers reproducing Hugo 0.76's behaviour, so summaries and reading times stay the same. */

/** Hugo's `helpers.StripHTML`: paragraphs and line breaks become newlines, tags are removed. */
export function plainText(html: string): string {
    const s = html.replaceAll("\n", " ").replace(/<\/p>|<br>|<br \/>/g, "\n");
    let out = "";
    let inTag = false;
    let wasSpace = false;
    for (const r of s) {
        let isSpace = false;
        if (r === "<") inTag = true;
        else if (r === ">") inTag = false;
        else {
            isSpace = /\s/.test(r);
            if (!inTag && (!isSpace || !wasSpace)) out += r;
        }
        wasSpace = isSpace;
    }
    return out;
}

/** Hugo's `.WordCount`. */
export const wordCount = (plain: string) => plain.split(/\s+/).filter(Boolean).length;

/** Hugo's `.ReadingTime`, in minutes (213 words per minute, rounded up). */
export const readingTime = (words: number) => Math.floor((words + 212) / 213);

/**
 * Hugo's automatic summary: the first `length` words, extended to the end of their sentence.
 * Works on the encoded plain text like Hugo does, then decodes it.
 */
export function truncateWordsToWholeSentence(plain: string, length: number): string {
    const s = plain.replaceAll('"', "&#34;");
    let words = 0;
    let lastWordIndex = -1;
    for (let i = 0; i < s.length; i++) {
        if (/\s/.test(s[i])) {
            words++;
            lastWordIndex = i;
            if (words >= length) break;
        }
    }
    let summary = s;
    if (lastWordIndex !== -1) {
        const end = s.slice(lastWordIndex).search(/[.?!"\n]/);
        if (end !== -1) summary = s.slice(0, lastWordIndex + end + 1).trim();
    }
    return decodeHTML(summary);
}

/** Hugo's `urlize`: lower-cased, spaces as dashes, without characters unsafe in paths. */
export const urlize = (s: string) =>
    s
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^\p{L}\p{N}\-_.~#+/]/gu, "")
        .toLowerCase();

/** Hugo's `humanize`: words separated and lower-cased, with the first letter capitalized. */
export function humanize(s: string): string {
    const words = s
        .replace(/[_-]+/g, " ")
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
}
