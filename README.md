# Hedgin docs

Public documentation site for Hedgin, built with [Mintlify](https://mintlify.com). `docs.json` holds the site config and navigation. Pages are MDX files whose paths match the navigation entries.

## Preview locally

```sh
npx mint dev
```

The site opens at `http://localhost:3000`.

## Check before you push

```sh
npx mint broken-links
node scripts/check-openapi.mjs ../app
```

`check-openapi.mjs` compares `api-reference/openapi.json` with the routes in `app/src/server/external/`. Run it after any change to the manager bot API. It fails when an endpoint exists in one place but not the other.

## Sources

The API reference describes the manager bot API in `app/`. The SDK pages describe `sdk/`. When the docs and the code disagree, the code is right. Fix the page.

## llms.txt

`llms.txt` is the index that AI tools read. This repo keeps a hand-written copy, which replaces the file Mintlify would generate. Keep its key facts and endpoint list in step with the API. When you add a page, add its link. The links assume the site is served at `https://docs.hedgin.xyz`.
