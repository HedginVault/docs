#!/usr/bin/env node
// Checks that api-reference/openapi.json documents exactly the manager API routes the app serves,
// and that every OpenAPI page in docs.json exists in the spec.
// Usage, from docs/: node scripts/check-openapi.mjs ../app
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = process.argv[2];
if (!appDir) {
	console.error("usage: node scripts/check-openapi.mjs <path-to-app-repo>");
	process.exit(2);
}
const docsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const external = join(resolve(appDir), "src/server/external");

function stringArray(source, pattern, label) {
	const match = pattern.exec(source);
	if (!match) {
		console.error(`could not find ${label} in usage-action.ts; update this script's regex`);
		process.exit(2);
	}
	return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const usage = readFileSync(join(external, "usage-action.ts"), "utf8");
const api = readFileSync(join(external, "api.ts"), "utf8");
const buildActions = stringArray(usage, /BUILD_ACTIONS\s*=\s*\[([\s\S]*?)\]/, "BUILD_ACTIONS");
const vaultReads = stringArray(usage, /VAULT_READS\s*=\s*\[([\s\S]*?)\]/, "VAULT_READS");
const fixed = stringArray(usage, /FIXED\s*=\s*new Set<string>\(\[([\s\S]*?)\]\)/, "FIXED");

// The parameterized reads in api.ts, such as /^tokens\/([^/]+)$/ for GET /tokens/{mint}.
const PARAM_NAMES = { tokens: "mint", "dlmm/pools": "lbPair" };
const paramReads = [...api.matchAll(/\/\^([a-z/\\-]+?)\\\/\(\[\^\/\]\+\)\$\//g)].map((m) => {
	const prefix = m[1].replaceAll("\\/", "/");
	const name = PARAM_NAMES[prefix];
	if (!name) {
		console.error(`api.ts has an unknown parameterized read "${prefix}/..."; add its parameter name to PARAM_NAMES`);
		process.exit(2);
	}
	return `GET /${prefix}/{${name}}`;
});

// FIXED mixes GET reads and POST actions; api.ts's write() handles these two POSTs by name.
const POST_FIXED = new Set(["transactions/send", "transactions/phoenix/onboard/submit"]);
const codeRoutes = new Set([
	...fixed.map((route) => `${POST_FIXED.has(route) ? "POST" : "GET"} /${route}`),
	"GET /vaults/{vault}",
	...vaultReads.map((read) => `GET /vaults/{vault}/${read}`),
	...paramReads,
	...buildActions.map((action) => `POST /transactions/${action}`),
]);

const spec = JSON.parse(readFileSync(join(docsDir, "api-reference/openapi.json"), "utf8"));
const METHODS = ["get", "post", "put", "patch", "delete"];
const specRoutes = new Set(
	Object.entries(spec.paths ?? {}).flatMap(([path, item]) =>
		METHODS.filter((method) => item[method]).map((method) => `${method.toUpperCase()} ${path}`),
	),
);

const docsConfig = JSON.parse(readFileSync(join(docsDir, "docs.json"), "utf8"));
const pages = [];
const walk = (node) => {
	if (typeof node === "string") pages.push(node);
	else if (Array.isArray(node)) node.forEach(walk);
	else if (node && typeof node === "object") Object.values(node).forEach(walk);
};
walk(docsConfig.navigation);
const openapiPages = pages.filter((page) => /^(GET|POST|PUT|PATCH|DELETE) \//.test(page));

const missingFromSpec = [...codeRoutes].filter((route) => !specRoutes.has(route)).sort();
const notInCode = [...specRoutes].filter((route) => !codeRoutes.has(route)).sort();
const pagesNotInSpec = openapiPages.filter((page) => !specRoutes.has(page));

const problems = [
	["Served by the app but missing from openapi.json", missingFromSpec],
	["In openapi.json but not served by the app", notInCode],
	["docs.json pages with no matching openapi.json operation", pagesNotInSpec],
].filter(([, list]) => list.length > 0);

if (problems.length > 0) {
	for (const [title, list] of problems) {
		console.error(`${title}:`);
		for (const route of list) console.error(`  ${route}`);
	}
	process.exit(1);
}
console.log(`ok: ${codeRoutes.size} routes match openapi.json; ${openapiPages.length} docs.json pages resolve`);
