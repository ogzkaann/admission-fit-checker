import type { AcademicProfile, Program, StoredDocument } from "../domain/types";
import { demoPrograms } from "../data/demoPrograms";
import { db } from "./db";

export async function getProfile() {
  return db.profiles.get("local-profile");
}

export async function saveProfile(profile: AcademicProfile) {
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

// Programs shown in the library = built-in demo programs + any the user added.
export async function listPrograms(): Promise<Program[]> {
  const userPrograms = await db.programs.toArray();
  return [...demoPrograms, ...userPrograms.sort((a, b) => b.createdAt.localeCompare(a.createdAt))];
}

export async function getProgram(id: string): Promise<Program | undefined> {
  const demo = demoPrograms.find((program) => program.id === id);
  if (demo) return demo;
  return db.programs.get(id);
}

export async function saveProgram(program: Program) {
  await db.programs.put(program);
}

export async function deleteUserProgram(id: string) {
  await db.programs.delete(id);
}
