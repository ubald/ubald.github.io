# Ubald.dev

The source of [ubald.dev](https://ubald.dev), built with [Astro](https://astro.build).

## Running

Requires Node 24 and pnpm. With Nix, `direnv allow` (or `nix develop`) enters a shell that provides both.

```sh
pnpm install
pnpm dev      # local server at http://localhost:4321, drafts included
pnpm build    # static site in dist/
pnpm preview  # serve the dist/ build locally
```

Content lives in `src/content/` as page bundles: a folder per page with its `index.md` (or `index.mdx` when it uses
components such as `<Figure>` or `<SourceFile>`) and its images and files. Pages with `draft: true` only show up in
`pnpm dev`.

## Publishing

Pushing to `master` builds the site and deploys it to GitHub Pages (`.github/workflows/deploy.yaml`).

## Quotes

> Knowing how to write doesn't make oneself an author. Don't just write code, author it.
