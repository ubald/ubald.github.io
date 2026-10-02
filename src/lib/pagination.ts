import type { Page } from "./pages.ts";
import { site } from "./site.ts";

export interface Pager {
    pageNumber: number;
    totalPages: number;
    pages: Page[];
    /** URL of a page of this list: the list itself, then `page/<n>/` like Hugo. */
    url: (pageNumber: number) => string;
}

/** Splits a list page's pages like Hugo's `.Paginate` (always at least one, possibly empty, pager). */
export function paginate(list: Page): Pager[] {
    const totalPages = Math.max(1, Math.ceil(list.listPages.length / site.paginate));
    const url = (pageNumber: number) => (pageNumber === 1 ? list.url : `${list.url}page/${pageNumber}/`);
    return Array.from({ length: totalPages }, (_, index) => ({
        pageNumber: index + 1,
        totalPages,
        pages: list.listPages.slice(index * site.paginate, (index + 1) * site.paginate),
        url,
    }));
}
