import { readFile, writeFile, mkdir, open, unlink, rename } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createFetcher, allowedUrl } from "./fetch.mjs";
import { extractProgram, parseSource, hash } from "./extract.mjs";
import { applyReview, assertEvidence, differences, markStale, reviewTemplate, revisionFor } from "./core.mjs";

const require = createRequire(import.meta.url);
const { programSchema, programRequirementSchema } = require("../../.catalog-build/domain/eligibilitySchemas.js");
const schemas = { program: programSchema, requirement: programRequirementSchema };
const root = resolve("catalog");
const read = async (path, fallback) => {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT" && fallback !== undefined) return fallback; throw error; }
};
async function write(path, data, immutable = false) {
  await mkdir(resolve(path, ".."), { recursive: true });
  const text = `${JSON.stringify(data, null, 2)}\n`;
  if (immutable) {
    try { await writeFile(path, text, { flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  } else {
    await writeFile(`${path}.tmp`, text);
    for (let attempt = 0; ; attempt++) {
      try { await rename(`${path}.tmp`, path); break; }
      catch (error) {
        if (!["EPERM", "EBUSY", "EACCES"].includes(error.code) || attempt >= 5) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
      }
    }
  }
}
function safeId(id) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error("Invalid catalog identifier");
  return id;
}
const snapshotPath = (id) => `${root}/snapshots/${safeId(id)}.json`;
const versionPath = (id, revision) => `${root}/versions/${safeId(id)}/${safeId(revision)}.json`;
const reviewPath = (id, revision) => `${root}/reviews/${safeId(id)}/${safeId(revision)}.json`;
const statePath = `${root}/current.json`;
await mkdir(root, { recursive: true });
const lock = await open(`${root}/.lock`, "wx").catch(() => { throw new Error("Catalog command already running (catalog/.lock). Remove a leftover lock only after checking no catalog process is running."); });
try {
const seeds = await read(`${root}/seeds.json`);
if (seeds.schemaVersion !== 1 || new Set(seeds.programs.map((item) => item.id)).size !== seeds.programs.length) throw new Error("Invalid seed manifest");
const sourceUrls = new Map();
for (const seed of seeds.programs) {
  safeId(seed.id);
  if (new Set(seed.sources.map((item) => item.id)).size !== seed.sources.length) throw new Error("Duplicate source IDs");
  seed.sources.forEach((source) => {
    safeId(source.id);
    allowedUrl(source.url, seeds.officialHosts);
    if (sourceUrls.has(source.id) && sourceUrls.get(source.id) !== source.url) throw new Error("Source ID reused with a different URL");
    sourceUrls.set(source.id, source.url);
  });
  if (new Set(seed.extract.map((recipe) => recipe.id)).size !== seed.extract.length || seed.extract.some((recipe) => !seed.sources.some((source) => source.id === recipe.source))) throw new Error("Invalid extraction recipe IDs or source references");
}
let state = await read(statePath, { schemaVersion: 1, sources: {}, programs: {} });
const allSnapshots = {};
for (const observation of Object.values(state.sources)) {
  if (observation.snapshotId) allSnapshots[observation.snapshotId] = await read(snapshotPath(observation.snapshotId));
}

async function publish(validateOnly = false) {
  const programs = [];
  const queue = [];
  for (const seed of seeds.programs) {
    const pointer = state.programs[seed.id];
    if (!pointer) continue;
    const version = await read(versionPath(seed.id, pointer.revision));
    if (revisionFor(version.program) !== pointer.revision || version.revision !== pointer.revision) throw new Error("Immutable draft revision hash mismatch");
    let program = version.program;
    // Refresh observation dates without changing the immutable semantic revision.
    const refresh = (evidence) => evidence?.map((source) => {
      const observation = Object.values(state.sources).find((item) => item.snapshotId === source.snapshotId);
      return { ...source, lastChecked: observation?.lastSuccessfulCheck ?? source.lastChecked };
    });
    program = { ...program, sources: refresh(program.sources), facts: program.facts?.map((fact) => ({ ...fact, evidence: refresh(fact.evidence) })), requirements: program.requirements.map((req) => ({ ...req, evidence: refresh(req.evidence) })) };
    const review = await read(reviewPath(seed.id, pointer.revision), null);
    if (review) program = applyReview(program, review, allSnapshots, schemas);
    const failures = seed.sources.filter((source) => state.sources[source.id]?.error).map((source) => `${source.id}: ${state.sources[source.id].error}`);
    if (failures.length) program = markStale(program, "One or more required sources could not be checked. Previous evidence is not current verification.");
    if (program.sources.some((source) => !Number.isFinite(Date.parse(source.lastChecked)) || Date.parse(source.lastChecked) > Date.now() || Date.now() - Date.parse(source.lastChecked) > 366 * 86400000)) program = markStale(program, "Source checks are outdated; retrieve and review current information.");
    program.lastChecked = seed.sources.map((source) => state.sources[source.id]?.lastSuccessfulCheck).filter(Boolean).sort()[0];
    for (const citation of [...(program.sources ?? []), ...program.requirements.flatMap((req) => [...(req.evidence ?? []), ...(req.conditionalAdmission?.evidence ?? [])]), ...(program.facts ?? []).flatMap((fact) => fact.evidence)]) assertEvidence(citation, allSnapshots);
    programs.push(programSchema.parse(program));
    queue.push({ programId: seed.id, revision: pointer.revision, verificationStatus: program.verificationStatus, lastChecked: program.lastChecked, latestAttempt: pointer.lastAttempt, requirementsComplete: program.requirementsComplete, pendingRequirements: program.requirements.filter((req) => !req.evidence?.length || req.evidence.some((source) => source.status !== "verified") || req.rule?.type === "manual").map((req) => req.id), unknownFacts: program.facts?.filter((fact) => fact.value === null).map((fact) => fact.id), issues: program.catalogIssues, changes: version.changes.map(({ collection, id, change }) => ({ collection, id, change })) });
  }
  if (!validateOnly) {
    await write(resolve("src/data/catalogPrograms.json"), programs);
    await write(`${root}/review-queue.json`, queue);
  }
  return programs;
}

async function extract() {
  const now = new Date().toISOString();
  for (const seed of seeds.programs) {
    const snapshots = {};
    const failures = {};
    for (const source of seed.sources) {
      const observation = state.sources[source.id];
      if (observation?.snapshotId) snapshots[source.id] = allSnapshots[observation.snapshotId];
      if (!observation || observation.error) failures[source.id] = observation?.error ?? "Source has not been fetched";
    }
    const previous = state.programs[seed.id];
    const oldVersion = previous ? await read(versionPath(seed.id, previous.revision)) : null;
    const program = programSchema.parse(extractProgram(seed, snapshots, failures, oldVersion?.program.createdAt ?? now));
    const revision = revisionFor(program);
    program.catalogVersion = revision;
    const version = { schemaVersion: 1, programId: seed.id, revision, parentRevision: previous?.revision ?? null, extractedAt: now, recipeHash: hash(seed), program, changes: differences(oldVersion?.program, program) };
    await write(versionPath(seed.id, revision), version, true);
    state.programs[seed.id] = { revision, lastAttempt: now };
    console.log(`${seed.id}: ${revision.slice(0, 12)} ${previous?.revision === revision ? "unchanged" : "new draft"}`);
  }
  await write(statePath, state);
  await publish();
}

const [command = "status", id, file] = process.argv.slice(2);
  if (command === "fetch") {
    const fetchSource = createFetcher({ hosts: seeds.officialHosts });
    const sources = new Map(seeds.programs.flatMap((seed) => seed.sources).map((source) => [source.id, source]));
    if (sources.size > 30) throw new Error("Pilot run is capped at 30 explicitly configured sources");
    if (id && !sources.has(id)) throw new Error("Unknown source ID");
    for (const source of sources.values()) {
      if (id && source.id !== id) continue;
      const previous = state.sources[source.id] ?? {};
      const lastAttempt = new Date().toISOString();
      try {
        const fetched = await fetchSource(source.url);
        const snapshot = await parseSource(fetched, seeds.officialHosts);
        await write(snapshotPath(snapshot.id), snapshot, true);
        // Preserve first-capture timestamps; later successful checks are observations.
        allSnapshots[snapshot.id] = await read(snapshotPath(snapshot.id));
        await mkdir(`${root}/cache`, { recursive: true });
        await writeFile(`${root}/cache/${snapshot.contentHash}.${snapshot.mediaType === "application/pdf" ? "pdf" : "html"}`, fetched.bytes);
        state.sources[source.id] = { url: source.url, snapshotId: snapshot.id, contentHash: snapshot.contentHash, textHash: snapshot.textHash, lastAttempt, lastSuccessfulCheck: fetched.retrievedAt, changed: Boolean(previous.contentHash && previous.contentHash !== snapshot.contentHash), textChanged: Boolean(previous.textHash && previous.textHash !== snapshot.textHash), discovered: snapshot.links };
        console.log(`Captured ${source.id}: ${snapshot.mediaType}, ${snapshot.blocks.length} text blocks, ${snapshot.links.length} discovered links`);
      } catch (error) {
        state.sources[source.id] = { ...previous, url: source.url, lastAttempt, error: error.message };
        console.error(`Unavailable ${source.id}: ${error.message}`);
      }
      await write(statePath, state);
    }
    await extract();
    if (Object.values(state.sources).some((source) => source.error)) process.exitCode = 2;
  } else if (command === "reparse") {
    for (const observation of Object.values(state.sources)) {
      if (!observation.snapshotId) continue;
      const old = allSnapshots[observation.snapshotId];
      const bytes = await readFile(`${root}/cache/${old.contentHash}.${old.mediaType === "application/pdf" ? "pdf" : "html"}`);
      const snapshot = await parseSource({ ...old, bytes }, seeds.officialHosts);
      await write(snapshotPath(snapshot.id), snapshot, true);
      allSnapshots[snapshot.id] = await read(snapshotPath(snapshot.id));
      observation.snapshotId = snapshot.id;
      observation.textHash = snapshot.textHash;
      observation.discovered = snapshot.links;
    }
    await write(statePath, state);
    await extract();
  } else if (command === "extract") await extract();
  else if (command === "review-template") {
    const pointer = state.programs[safeId(id ?? "")];
    if (!pointer) throw new Error("Unknown program ID");
    const version = await read(versionPath(id, pointer.revision));
    const destination = file ? resolve(file) : `${root}/review-drafts/${id}.json`;
    await write(destination, reviewTemplate(version.program), true);
    console.log(`Review template: ${destination}. Pending is not approval.`);
  } else if (command === "review") {
    if (!file) throw new Error("Usage: npm run catalog -- review <program-id> <review-file>");
    const pointer = state.programs[safeId(id ?? "")];
    if (!pointer) throw new Error("Unknown program ID");
    const version = await read(versionPath(id, pointer.revision));
    const review = await read(resolve(file));
    applyReview(version.program, review, allSnapshots, schemas);
    const destination = reviewPath(id, pointer.revision);
    // Append-only review event and active review pointer; earlier decisions are retained.
    await write(`${root}/review-events/${hash(review)}.json`, review, true);
    await write(destination, review);
    await publish();
    console.log("Recorded editorial review. Admission remains a university decision.");
  } else if (command === "validate") {
    const programs = await read(resolve("src/data/catalogPrograms.json"));
    for (const program of programs) {
      programSchema.parse(program);
      const draftRevision = program.catalogDraftVersion ?? program.catalogVersion;
      if (state.programs[program.id]?.revision !== draftRevision) throw new Error("Published version differs from current pointer");
      for (const citation of [...(program.sources ?? []), ...program.requirements.flatMap((req) => [...(req.evidence ?? []), ...(req.conditionalAdmission?.evidence ?? [])]), ...(program.facts ?? []).flatMap((fact) => fact.evidence)]) assertEvidence(citation, allSnapshots);
      if (program.verificationStatus === "verified" && !await read(reviewPath(program.id, draftRevision), null)) throw new Error("Verified record lacks review event");
    }
    if (programs.length !== seeds.programs.length) throw new Error("Published catalog is incomplete");
    if (JSON.stringify(programs) !== JSON.stringify(await publish(true))) throw new Error("Published data differs from reproducible draft/review/observation output");
    console.log(`Validated ${programs.length} catalog records and their snapshot evidence.`);
  } else if (command === "status") {
    const queue = await read(`${root}/review-queue.json`, []);
    for (const item of queue) console.log(`${item.programId}: ${item.verificationStatus}; ${item.pendingRequirements.length} requirements need review; ${item.unknownFacts.length} unknown facts; revision ${item.revision.slice(0, 12)}`);
    console.log("Detailed issues, changes and pending requirements: catalog/review-queue.json. Discovered official links: catalog/current.json. Add selected links to seeds.json before fetching; no automatic spidering.");
  } else throw new Error("Commands: fetch [source-id], reparse, extract, status, validate, review-template <id> [file], review <id> <file>");
} finally { await lock.close(); await unlink(`${root}/.lock`); }
