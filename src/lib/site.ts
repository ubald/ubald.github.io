/** Site-wide settings, carried over from Hugo's `config/` directory. */
export const site = {
    title: "Ubald.dev",
    tagline: "I need to rant about code",
    description: "Hi, my name is Ubald and this is me ranting about code.",
    copyright: "©2024 François Ubald Brien. All rights reserved.",
    languageCode: "en-us",
    // Drafts are only rendered by `pnpm dev`, like Hugo's development environment.
    buildDrafts: import.meta.env.DEV,
    paginate: import.meta.env.DEV ? 4 : 12,
    summaryLength: 30,
    mastodon: "https://pataterie.ca/@ubald",
};

export interface MenuEntry {
    identifier: string;
    name: string;
    url: string;
}

export const mainMenu: MenuEntry[] = [
    // The articles section is still built, but hidden from the menu for now.
    // { identifier: "articles", name: "Articles", url: "/articles/" },
    { identifier: "about", name: "About", url: "/about/" },
];
