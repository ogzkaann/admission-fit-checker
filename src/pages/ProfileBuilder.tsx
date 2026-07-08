import { ChangeEvent, useEffect, useState } from "react";
import { FileUp, Loader2, Plus, Save, Trash2, UserRound, Wand2 } from "lucide-react";
import type {
  AcademicProfile,
  AppSettings,
  DocumentKind,
  ExtractedProfile,
  LanguageCertificate,
  StoredDocument,
} from "../domain/types";
import { documentKindLabels } from "../domain/labels";
import { extractProfileFromDocumentText } from "../ai/profileExtraction";
import { extractPdfText } from "../rag/pdf";
import { deleteDocument, getProfile, listDocuments, saveDocument, saveProfile } from "../storage/repository";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";

const emptyProfile: AcademicProfile = {
  id: "local-profile",
  courses: [],
  languageCertificates: [],
  workExperience: "",
  updatedAt: new Date().toISOString(),
};

const uploadKinds: DocumentKind[] = ["transcript", "diploma", "cv", "language-certificate", "other"];

interface ProfileBuilderProps {
  settings: AppSettings;
  onSaved: () => void;
}

function applyExtracted(profile: AcademicProfile, extracted: ExtractedProfile): AcademicProfile {
  return {
    ...profile,
    name: extracted.name ?? profile.name,
    degree: extracted.degree ?? profile.degree,
    field: extracted.field ?? profile.field,
    university: extracted.university ?? profile.university,
    gpa: extracted.gpa ?? profile.gpa,
    ects: extracted.ects ?? profile.ects,
    courses: extracted.courses?.length ? extracted.courses : profile.courses,
    workExperience: extracted.workExperience?.length ? extracted.workExperience.join("\n") : profile.workExperience,
    languageCertificates: extracted.languageCertificates?.length
      ? extracted.languageCertificates
      : profile.languageCertificates,
    extracted,
  };
}

export function ProfileBuilder({ settings, onSaved }: ProfileBuilderProps) {
  const [profile, setProfile] = useState<AcademicProfile>(emptyProfile);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DocumentKind>("transcript");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  async function refresh() {
    setDocuments(await listDocuments());
  }

  useEffect(() => {
    getProfile().then((stored) => stored && setProfile(stored));
    refresh();
  }, []);

  function update<K extends keyof AcademicProfile>(field: K, value: AcademicProfile[K]) {
    setSaved(false);
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function updateCertificate(index: number, patch: Partial<LanguageCertificate>) {
    setProfile((current) => ({
      ...current,
      languageCertificates: current.languageCertificates.map((cert, i) => (i === index ? { ...cert, ...patch } : cert)),
    }));
  }

  function addCertificate() {
    setProfile((current) => ({
      ...current,
      languageCertificates: [...current.languageCertificates, { language: "", level: "" }],
    }));
  }

  function removeCertificate(index: number) {
    setProfile((current) => ({
      ...current,
      languageCertificates: current.languageCertificates.filter((_, i) => i !== index),
    }));
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("Only PDF upload is supported in this MVP.");
      }
      const extracted = await extractPdfText(file);
      if (!extracted.text.trim()) {
        throw new Error("No selectable text found. This may be a scanned PDF; OCR is a future improvement.");
      }
      const result = await extractProfileFromDocumentText(extracted.text, settings);
      const stored: StoredDocument = {
        id: crypto.randomUUID(),
        kind,
        fileName: file.name,
        text: extracted.text,
        pageCount: extracted.pageCount,
        extractedProfile: result.profile,
        createdAt: new Date().toISOString(),
        status: "parsed",
      };
      await saveDocument(stored);
      setProfile((current) => applyExtracted(current, result.profile));
      setSaved(false);
      setMessage(`${file.name} parsed. ${result.warning ?? "Review the fields below, then save."}`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function reExtract(document: StoredDocument) {
    setBusy(true);
    const result = await extractProfileFromDocumentText(document.text, settings);
    setProfile((current) => applyExtracted(current, result.profile));
    setMessage(result.warning ?? `Re-applied extraction from ${document.fileName}.`);
    setBusy(false);
  }

  async function removeDoc(id: string) {
    await deleteDocument(id);
    await refresh();
  }

  async function handleSave() {
    await saveProfile(profile);
    setSaved(true);
    onSaved();
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
      <header>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <UserRound className="h-4 w-4" />
          Academic Profile
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">Build your academic profile.</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Upload a document to auto-fill fields, review everything, then save. Nothing leaves your browser except text you
          send to your own AI provider during extraction.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Upload a document</CardTitle>
          <CardDescription>Transcript, diploma, CV, or language certificate (PDF).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <label className="grid gap-2 text-sm font-medium">
            Document type
            <Select value={kind} onChange={(event) => setKind(event.target.value as DocumentKind)}>
              {uploadKinds.map((item) => (
                <option key={item} value={item}>
                  {documentKindLabels[item]}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-slate-50 px-4 py-6 text-center hover:bg-muted">
            {busy ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <FileUp className="h-7 w-7 text-primary" />}
            <span className="mt-2 text-sm font-semibold text-foreground">Upload PDF</span>
            <span className="mt-1 text-xs text-muted-foreground">Auto-fills the review form below.</span>
            <input className="sr-only" type="file" accept="application/pdf,.pdf" onChange={handleUpload} disabled={busy} />
          </label>
          {message ? <p className="rounded-md bg-muted p-3 text-sm leading-6 text-muted-foreground sm:col-span-2">{message}</p> : null}
          {documents.length > 0 ? (
            <div className="grid gap-2 sm:col-span-2">
              {documents.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-2.5">
                  <span className="text-sm text-foreground">
                    {documentKindLabels[document.kind]} · {document.fileName}
                  </span>
                  <span className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => reExtract(document)} disabled={busy}>
                      <Wand2 className="h-4 w-4" />
                      Re-apply
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeDoc(document.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review &amp; edit</CardTitle>
          <CardDescription>Leave a field empty rather than guessing — the fit check treats unknowns conservatively.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Full name
              <Input value={profile.name ?? ""} onChange={(event) => update("name", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Degree
              <Input placeholder="e.g. Bachelor of Science" value={profile.degree ?? ""} onChange={(event) => update("degree", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Field of study
              <Input placeholder="e.g. Computer Science" value={profile.field ?? ""} onChange={(event) => update("field", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              University
              <Input value={profile.university ?? ""} onChange={(event) => update("university", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              GPA / grade
              <Input placeholder="e.g. 3.6/4.0 or 1.7 (DE)" value={profile.gpa ?? ""} onChange={(event) => update("gpa", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              ECTS credits
              <Input placeholder="e.g. 180" value={profile.ects ?? ""} onChange={(event) => update("ects", event.target.value)} />
            </label>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Language certificates</span>
              <Button variant="outline" size="sm" onClick={addCertificate}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            {profile.languageCertificates.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                No language certificates yet.
              </p>
            ) : (
              profile.languageCertificates.map((cert, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <Input placeholder="Language" value={cert.language} onChange={(event) => updateCertificate(index, { language: event.target.value })} />
                  <Input placeholder="Test (IELTS…)" value={cert.test ?? ""} onChange={(event) => updateCertificate(index, { test: event.target.value })} />
                  <Input placeholder="Level (B2, C1…)" value={cert.level ?? ""} onChange={(event) => updateCertificate(index, { level: event.target.value })} />
                  <Button variant="ghost" size="icon" onClick={() => removeCertificate(index)} aria-label="Remove certificate">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <label className="grid gap-2 text-sm font-medium">
            Relevant courses (one per line)
            <Textarea
              className="min-h-24"
              value={profile.courses.join("\n")}
              onChange={(event) => update("courses", event.target.value.split("\n").map((line) => line.trim()).filter(Boolean))}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Work experience
            <Textarea className="min-h-24" value={profile.workExperience} onChange={(event) => update("workExperience", event.target.value)} />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Target country (optional)
              <Input value={profile.targetCountry ?? ""} onChange={(event) => update("targetCountry", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Target city (optional)
              <Input value={profile.targetCity ?? ""} onChange={(event) => update("targetCity", event.target.value)} />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave}>
              <Save className="h-4 w-4" />
              Save profile
            </Button>
            {saved ? <span className="text-sm font-medium text-emerald-700">Saved locally.</span> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
