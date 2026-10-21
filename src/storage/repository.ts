import type { AcademicProfile, Program, StoredDocument } from "../domain/types";
import { demoPrograms } from "../data/demoPrograms";
import { readCatalog } from "../domain/catalog";
import { db } from "./db";
import { normalizeProgram } from "../domain/programCompatibility";
import { academicProfileSchema, programSchema } from "../domain/schemas";

export async function getProfile() {
  return db.profiles.get("local-profile");
}

export async function saveProfile(profile: AcademicProfile) {
  academicProfileSchema.parse(profile);
  await db.profiles.put({ ...profile, updatedAt: new Date().toISOString() });
}

export async function listDocuments() {
  return db.documents.orderBy("createdAt").reverse().toArray();
}

export async function saveDocument(document: StoredDocument) {
  await db.documents.put(document);
}

export async function updateDocument(document: StoredDocument) {
  await db.documents.put(document);
}

export async function deleteDocument(id: string) {
  await db.documents.delete(id);
}

// Read-only catalog DTOs stay separate from the user's IndexedDB records.
export async function listPrograms(): Promise<Program[]> {
  const [userPrograms, { default: catalogData }] = await Promise.all([db.programs.toArray(), import("../data/catalogPrograms.json")]);
  return [...readCatalog(catalogData), ...userPrograms.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), ...demoPrograms].map(normalizeProgram);
}

export async function getProgram(id: string): Promise<Program | undefined> {
  const { default: catalogData } = await import("../data/catalogPrograms.json");
  const catalog = readCatalog(catalogData).find((program) => program.id === id);
  if (catalog) return catalog;
  const demo = demoPrograms.find((program) => program.id === id);
  if (demo) return normalizeProgram(demo);
  const program = await db.programs.get(id);
  return program ? normalizeProgram(program) : undefined;
}

export async function saveProgram(program: Program) {
  programSchema.parse(program);
  await db.programs.put(normalizeProgram(program));
}

export async function deleteUserProgram(id: string) {
  await db.programs.delete(id);
}
