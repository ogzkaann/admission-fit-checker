import { createHash } from "node:crypto";
import { loadBuffer } from "cheerio";
import { allowedUrl } from "./fetch.mjs";

export const EXTRACTOR_VERSION = 2;
export const hash = (value) => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
export const normalizeText = (value) => value.normalize("NFKC").replace(/\s+/g, " ").trim();

export async function parseSource(fetched, hosts) {
  let title = "";
  const blocks = [];
  const links = [];
  if (fetched.mediaType === "application/pdf") {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = getDocument({ data: new Uint8Array(fetched.bytes), isEvalSupported: false, useSystemFonts: true });
    const pdf = await task.promise;
    try {
      if (pdf.numPages > 100) throw new Error("PDF exceeds 100-page limit; manual review required");
      for (let index = 1; index <= pdf.numPages; index++) {
        const content = await (await pdf.getPage(index)).getTextContent();
        const text = normalizeText(content.items.map((item) => "str" in item ? item.str : "").join(" "));
        if (text) blocks.push({ text, locator: `PDF page ${index}` });
      }
      title = (await pdf.getMetadata()).info?.Title || new URL(fetched.url).pathname.split("/").pop();
    } finally { await task.destroy(); }
  } else {
    const $ = loadBuffer(fetched.bytes);
    title = normalizeText($("h1").first().text() || $("title").text());
    $("a[href]").each((_, element) => {
      const label = normalizeText($(element).text());
      try {
        const url = allowedUrl(new URL($(element).attr("href"), fetched.url).href, hosts);
        if (/admission|requirement|regulation|application|bewerb|zulass|ordnung|\.pdf(?:$|\?)/i.test(`${label} ${url}`) && !links.some((link) => link.url === url)) links.push({ url, label });
      } catch { /* External portals are never crawled automatically. */ }
    });
    $("script,style,nav,header,footer,noscript,form,svg").remove();
    const root = $("main").first().length ? $("main").first() : $("body");
    root.find("p,li,td,h1,h2,h3,h4,dt,dd").each((index, element) => {
      // Preserve paragraph/list scope, without duplicating nested list containers.
      const fragment = $(element).clone();
      fragment.find("ul,ol,p,table").remove();
      const text = normalizeText(fragment.text());
      if (text && !blocks.some((block) => block.text === text)) blocks.push({ text, locator: `HTML ${element.tagName} block ${index + 1}` });
    });
  }
  if (!blocks.length) throw new Error("No readable source text; OCR/manual extraction required");
  const contentHash = hash(fetched.bytes);
  const text = blocks.map((block) => block.text).join("\n");
  return { id: hash(`${fetched.url}\n${contentHash}\n${EXTRACTOR_VERSION}`), url: fetched.url, requestedUrl: fetched.requestedUrl, title, retrievedAt: fetched.retrievedAt, mediaType: fetched.mediaType, contentHash, textHash: hash(text), text, blocks, links: links.slice(0, 80), robotsStatus: fetched.robotsStatus, redirects: fetched.redirects, etag: fetched.etag, lastModified: fetched.lastModified, extractorVersion: EXTRACTOR_VERSION };
}

function evidence(snapshot, block) {
  return { url: snapshot.url, quote: block.text, locator: block.locator, status: "unverified", sourceType: "official", retrievedAt: snapshot.retrievedAt, lastChecked: snapshot.retrievedAt, snapshotId: snapshot.id, contentHash: snapshot.contentHash, validFor: [] };
}

// Source-specific anchors choose the clause; only explicit scalars are automated.
// Anything with exceptions, alternatives or unsupported semantics remains manual.
export function extractProgram(seed, snapshots, failures, now) {
  const requirements = [];
  const facts = [];
  const issues = ["Automatically extracted draft. Human review and semester applicability are outstanding.", ...(seed.notes ?? [])];
  for (const recipe of seed.extract) {
    const snapshot = snapshots[recipe.source];
    const anchors = (recipe.anchors ?? [recipe.anchor ?? ""]).map(normalizeText);
    const matches = anchors.map((anchor) => anchor && snapshot?.blocks.find((item) => item.text.toLowerCase().includes(anchor.toLowerCase())));
    const blocks = [...new Set(matches.filter(Boolean))];
    if (!blocks.length || matches.some((block) => !block)) {
      facts.push({ id: recipe.id, category: recipe.category, value: null, note: recipe.note ?? "Not established from the fetched sources.", evidence: [] });
      if (anchors.some(Boolean)) issues.push(`Extraction needs review: ${recipe.id} (anchor missing or source unavailable).`);
      if (recipe.requirement) requirements.push({ id: recipe.id, kind: recipe.kind ?? "other", label: recipe.label, mandatory: true, rule: { type: "manual", explanation: "Source evidence is missing. Re-extract or review the official source." }, evidence: [] });
      continue;
    }
    const citations = blocks.map((block) => evidence(snapshot, block));
    const text = blocks.map((block) => block.text).join("\n\n");
    facts.push({ id: recipe.id, category: recipe.category, value: text, note: recipe.note, evidence: citations });
    if (recipe.requirement) {
      let rule = { type: "manual", explanation: `${recipe.label}. Review the full quoted clause, alternatives and applicability.` };
      const qualified = /\b(?:or|unless|exceptions?|instead|alternatives?|waiv\w*|if|approximately)\b/i.test(text);
      if (!qualified && recipe.extractor === "subject_ects") {
        const matches = [...text.matchAll(/(?:at least|minimum of)\s+(\d+(?:[.,]\d+)?)\s*ECTS/gi)];
        if (matches.length === 1) rule = { type: "subject_ects", subject: recipe.subject, minimum: Number(matches[0][1].replace(",", ".")) };
      }
      if (!qualified && recipe.extractor === "cefr") {
        const matches = [...text.matchAll(/\b([ABC][12])\b/g)];
        if (new Set(matches.map((match) => match[1])).size === 1) rule = { type: "language", language: recipe.language, accepted: [{ minLevel: matches[0][1] }] };
      }
      if (!qualified && recipe.extractor === "degree" && /(?:completed|received|hold) (?:a |an )?Bachelor['’]s/i.test(text)) rule = { type: "degree", accepted: ["bachelor"], completionRequired: true };
      requirements.push({ id: recipe.id, kind: recipe.kind ?? "other", label: recipe.label, mandatory: true, rule, sourceText: text, evidence: citations });
    }
  }
  for (const source of seed.sources) if (failures[source.id]) issues.push(`${source.id}: ${failures[source.id]}`);
  const available = seed.sources.map((source) => snapshots[source.id]).filter(Boolean);
  requirements.push({ id: "inventory-review", kind: "other", label: "Full admission regulations and applicability review", mandatory: true, rule: { type: "manual", explanation: "The extracted inventory is not complete. Verify regulations, applicant categories, exemptions, selection and semester validity." }, evidence: [] });
  return { id: seed.id, university: seed.university, programName: seed.programName, degreeType: "master", language: seed.language, country: "Germany", city: seed.city, description: seed.description, sourceUrl: seed.sources[0].url, origin: "catalog", isDemo: false, createdAt: now, schemaVersion: 2, verificationStatus: available.length && !seed.sources.some((source) => failures[source.id]) ? "unverified" : "stale", requirementsComplete: false, validFor: [], requiredDocuments: [], requirements, facts, catalogIssues: issues, retrievedAt: available.map((source) => source.retrievedAt).sort().at(-1), sources: available.map((source) => evidence(source, { text: source.title || seed.programName, locator: "Source document identity" })), admissionText: facts.filter((fact) => fact.value).map((fact) => `${fact.category}: ${fact.value}`).join("\n\n") };
}
