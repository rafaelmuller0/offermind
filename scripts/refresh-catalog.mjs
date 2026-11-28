// Coleta agendada do catálogo compartilhado.
// Executa o OfferMind Collector no servidor (GitHub Actions), sem navegador aberto.
// Credencial: variável de ambiente SEARCHAPI_API_KEY (segredo do repositório).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { emptyCatalog, mergeCatalog, parseCatalog } from "../src/lib/collector/catalog.ts";
import { runCollection } from "../src/lib/collector/collector.ts";
import { buildPlan } from "../src/lib/collector/plan.ts";
import { createSearchApiProvider } from "../src/lib/collector/searchapi.ts";
import { defaults } from "../src/lib/offermind.ts";

const FILE = "public/offermind-catalog.json";
const RETENTION_DAYS = 30;
const MAX_ADS = 8000;

const key = process.env.SEARCHAPI_API_KEY;
if (!key || process.env.OFFERMIND_CATALOG_ENABLED !== "true") {
  throw Error("Coleta desabilitada: configure credencial e autorização de catálogo.");
}
const maxCalls = Number.parseInt(process.env.OFFERMIND_MAX_CALLS || "18", 10);
if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 100) {
  throw Error("OFFERMIND_MAX_CALLS deve ser um inteiro entre 1 e 100.");
}

const today = new Date().toISOString().slice(0, 10);
const plan = buildPlan(today, { minAge: defaults.minAge, maxAge: defaults.maxAge });

let previous = emptyCatalog();
try {
  previous = parseCatalog(JSON.parse(await readFile(FILE, "utf8"))) ?? emptyCatalog();
} catch {
  // Sem catálogo anterior legível: começa vazio.
}

const result = await runCollection({
  provider: createSearchApiProvider({ apiKey: key }),
  country: defaults.country,
  plan,
  maxCalls,
});
const catalog = mergeCatalog(previous, result, {
  rules: defaults,
  today,
  retentionDays: RETENTION_DAYS,
  maxAds: MAX_ADS,
  terms: plan.terms.map((t) => t.keyword),
});

await mkdir("public", { recursive: true });
await writeFile(FILE, JSON.stringify(catalog) + "\n");

console.log(
  `Coleta ${result.coverage}: ${result.calls}/${result.maxCalls} chamadas, ` +
    `${result.queries.length} consultas, ${result.ads.length} anúncios distintos lidos, ` +
    `${catalog.offers.length} ofertas candidatas no catálogo, ` +
    `${catalog.matched} com volume e idade observados.`,
);
for (const error of result.errors) {
  console.log(`  erro (${error.kind}): ${error.message}`);
}
if (result.stoppedBy) console.log(`  interrompida por: ${result.stoppedBy}`);

if (result.coverage === "failed") {
  // O estado de falha já foi gravado no catálogo para a interface exibir.
  console.log("::error::Coleta falhou: " + (catalog.lastError ?? "sem detalhe"));
  process.exitCode = 1;
}
