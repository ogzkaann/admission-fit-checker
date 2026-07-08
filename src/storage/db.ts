import Dexie, { type Table } from "dexie";
import type { AcademicProfile, Program, StoredDocument } from "../domain/types";

class AdmissionFitDatabase extends Dexie {
  documents!: Table<StoredDocument, string>;
  profiles!: Table<AcademicProfile, string>;
  programs!: Table<Program, string>;

  constructor() {
    super("admission-fit-checker");
    this.version(1).stores({
      documents: "id, kind, fileName, createdAt, status",
      profiles: "id, updatedAt",
      programs: "id, origin, university, createdAt",
    });
  }
}

export const db = new AdmissionFitDatabase();
