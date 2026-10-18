import { ChangeEvent, useEffect, useState } from "react";
import { AlertCircle, BookOpenCheck, FileUp, Languages, Loader2, Plus, Save, Trash2, UserRound, Wand2 } from "lucide-react";
import type {
  AcademicProfile,
  AcademicCourse,
  DegreeType,
  AppSettings,
  DocumentKind,
  ExtractedProfile,
  LanguageCertificate,
  StoredDocument,
} from "../domain/types";
import { documentKindLabels } from "../domain/labels";
import { getProfileCompleteness, type Completeness } from "../domain/profileStatus";
import { extractProfileFromDocumentText } from "../ai/profileExtraction";
import { extractDocument } from "../rag/documentExtraction";
import { deleteDocument, getProfile, listDocuments, saveDocument, saveProfile } from "../storage/repository";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { ProfileEvidenceEditor } from "../components/ProfileEvidenceEditor";

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
    graduationDate: extracted.graduationDate ?? profile.graduationDate,
    courses: extracted.courses?.length ? extracted.courses : profile.courses,
    workExperience: extracted.workExperience?.length ? extracted.workExperience.join("\n") : profile.workExperience,
    languageCertificates: extracted.languageCertificates?.length
      ? extracted.languageCertificates
      : profile.languageCertificates,
    extracted,
    // Re-extraction changes the values. Previously reviewed evidence must be relinked.
    evidence: undefined,
    degreeType: undefined,
    degreeCompleted: undefined,
    reviewedAt: undefined,
  };
}

const completenessStyles: Record<Completeness, { variant: "green" | "yellow" | "outline"; label: string }> = {
  complete: { variant: "green", label: "complete" },
  partial: { variant: "yellow", label: "partial" },
  missing: { variant: "outline", label: "missing" },
};

function CompletenessPill({ title, status, optional }: { title: string; status: Completeness; optional?: boolean }) {
  const style = completenessStyles[status];
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-cream-soft px-4 py-3 shadow-sm">
      <span className="text-sm font-medium text-foreground">
        {title}
        {optional ? <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span> : null}
      </span>
      <Badge variant={style.variant}>{style.label}</Badge>
    </div>
  );
}

export function ProfileBuilder({ settings, onSaved }: ProfileBuilderProps) {
  const [profile, setProfile] = useState<AcademicProfile>(emptyProfile);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DocumentKind>("transcript");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  const completeness = getProfileCompleteness(profile);

  async function refresh() {
    setDocuments(await listDocuments());
  }

  useEffect(() => {
    getProfile().then((stored) => stored && setProfile(stored));
    refresh();
  }, []);

  function update<K extends keyof AcademicProfile>(field: K, value: AcademicProfile[K]) {
    setSaved(false);
    setDirty(true);
    setProfile((current) => {
      const evidence = { ...current.evidence };
      if (field === "degree" || field === "degreeType" || field === "degreeCompleted") delete evidence.degree;
      if (field === "field") delete evidence.field;
      if (field === "ects") delete evidence.ects;
      return { ...current, [field]: value, ...(field === "evidence" ? {} : { evidence }), reviewedAt: undefined };
    });
  }

  function updateCertificate(index: number, patch: Partial<LanguageCertificate>) {
    setDirty(true);
    setSaved(false);
    setProfile((current) => ({
      ...current,
      languageCertificates: current.languageCertificates.map((cert, i) => (i === index ? { ...cert, evidence: undefined, ...patch } : cert)),
    }));
  }

  function addCertificate() {
    setDirty(true);
    setProfile((current) => ({
      ...current,
      languageCertificates: [...current.languageCertificates, { language: "", level: "" }],
    }));
  }

  function removeCertificate(index: number) {
    setDirty(true);
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
    setStatus("");
    try {
      const extraction = await extractDocument(file, (extractionEvent) => setStatus(extractionEvent.message));
      if (!extraction.text.trim()) {
        throw new Error("Could not read any text from this file, even with OCR. Try a clearer scan.");
      }
      const result = await extractProfileFromDocumentText(extraction.text, settings);
      const stored: StoredDocument = {
        id: crypto.randomUUID(),
        kind,
        fileName: file.name,
        text: extraction.text,
        pageCount: extraction.pageCount,
        extractedProfile: result.profile,
        createdAt: new Date().toISOString(),
        status: "parsed",
      };
      await saveDocument(stored);
      setProfile((current) => applyExtracted(current, result.profile));
      setDirty(true);
      setSaved(false);
      setMessage(
        `${file.name} processed${extraction.usedOcr ? " with OCR" : ""}. Review the fields below, then save. ${
          result.warning ?? ""
        }`.trim(),
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
      setStatus("");
      event.target.value = "";
    }
  }

  async function reExtract(document: StoredDocument) {
    setBusy(true);
    const result = await extractProfileFromDocumentText(document.text, settings);
    setProfile((current) => applyExtracted(current, result.profile));
    setDirty(true);
    setMessage(result.warning ?? `Re-applied extraction from ${document.fileName}.`);
    setBusy(false);
  }

  async function removeDoc(id: string) {
    await deleteDocument(id);
    await refresh();
  }

  async function handleSave() {
    try {
      await saveProfile({ ...profile, reviewedAt: new Date().toISOString() });
      setSaved(true);
      setDirty(false);
      setMessage("");
      onSaved();
    } catch {
      setMessage("Check the profile fields. Linked evidence needs a document and a nonempty excerpt; credits and scores must be nonnegative numbers.");
    }
  }

  function updateCourse(id: string, patch: Partial<AcademicCourse>) {
    update("academicCourses", (profile.academicCourses ?? []).map((course) => course.id === id ? { ...course, evidence: undefined, ...patch } : course));
    update("courseEquivalences", []);
    update("transcriptComplete", false);
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:py-10">
      <header className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-crisp backdrop-blur sm:p-8">
        <div className="flex items-center gap-3 text-sm font-semibold text-primary">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-white">
            <UserRound className="h-5 w-5" />
          </span>
          Academic Profile
        </div>
        <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Build your academic profile.</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          Upload a document to auto-fill fields. Scanned PDFs and images are read locally with OCR. Review everything,
          then save. Nothing leaves your browser except text you send to your own AI provider during extraction.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Upload a document
          </CardTitle>
          <CardDescription>Transcript, diploma, CV, or language certificate. PDF, PNG, or JPG.</CardDescription>
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
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gold/40 bg-cream-soft px-4 py-6 text-center transition hover:border-primary/40 hover:shadow-crisp">
            {busy ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <FileUp className="h-7 w-7 text-primary" />}
            <span className="mt-2 text-sm font-semibold text-foreground">Upload PDF or image</span>
            <span className="mt-1 text-xs text-muted-foreground">Scanned or photographed documents are read with OCR.</span>
            <input
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf,image/png,image/jpeg,.png,.jpg,.jpeg"
              onChange={handleUpload}
              disabled={busy}
            />
          </label>
          {busy && status ? (
            <p className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary sm:col-span-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status}
            </p>
          ) : null}
          {message ? <p className="rounded-2xl border border-black/5 bg-cream-soft p-3 text-sm leading-6 text-muted-foreground sm:col-span-2">{message}</p> : null}
          {documents.length > 0 ? (
            <div className="grid gap-2 sm:col-span-2">
              {documents.map((document) => (
                <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white p-3">
                  <span className="text-sm text-foreground">
                    {documentKindLabels[document.kind]} - {document.fileName}
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
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-primary" />
            Profile completeness
          </CardTitle>
          <CardDescription>What the fit check can and can't evaluate from your current profile.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <CompletenessPill title="Academic data" status={completeness.academic} />
          <CompletenessPill title="ECTS" status={completeness.ects} />
          <CompletenessPill title="Language" status={completeness.language} />
          <CompletenessPill title="Work experience" status={completeness.workExperience} optional />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            Review &amp; edit
          </CardTitle>
          <CardDescription>Leave a field empty rather than guessing. The fit check treats unknowns conservatively.</CardDescription>
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
              Total ECTS
              <Input placeholder="e.g. 180" value={profile.ects ?? ""} onChange={(event) => update("ects", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Graduation date
              <Input placeholder="e.g. 2024 or 06/2024" value={profile.graduationDate ?? ""} onChange={(event) => update("graduationDate", event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Prior degree level
              <Select aria-label="Prior degree level" value={profile.degreeType ?? ""} onChange={(event) => update("degreeType", event.target.value ? event.target.value as DegreeType : undefined)}>
                <option value="">Unknown / not reviewed</option><option value="bachelor">Bachelor</option><option value="master">Master</option><option value="phd">PhD</option><option value="other">Other</option>
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Degree completion
              <Select aria-label="Degree completion" value={profile.degreeCompleted === undefined ? "" : String(profile.degreeCompleted)} onChange={(event) => update("degreeCompleted", event.target.value === "" ? undefined : event.target.value === "true")}>
                <option value="">Unknown / not reviewed</option><option value="true">Completed</option><option value="false">Not yet completed</option>
              </Select>
            </label>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">Link supporting excerpts for degree level and completion, field, and total ECTS. Saving confirms your review of the recorded information, not document authenticity or recognition by a university.</p>
          <div className="grid gap-4 md:grid-cols-3">
            {(["degree", "field", "ects"] as const).map((field) => <ProfileEvidenceEditor key={field} label={field === "ects" ? "Total ECTS" : field === "degree" ? "Degree and completion" : "Field of study"} documents={documents} value={profile.evidence?.[field]} onChange={(value) => update("evidence", { ...profile.evidence, [field]: value })} />)}
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
              <p className="rounded-2xl border border-dashed border-gold/40 bg-cream-soft p-4 text-sm leading-6 text-muted-foreground">
                No language certificates yet. Add IELTS, TOEFL, telc, or another certificate when you have it.
              </p>
            ) : (
              profile.languageCertificates.map((cert, index) => (
                <div key={index} className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <Input placeholder="Language" value={cert.language} onChange={(event) => updateCertificate(index, { language: event.target.value })} />
                  <Input placeholder="Provider (telc, IELTS...)" value={cert.provider ?? cert.test ?? ""} onChange={(event) => updateCertificate(index, { provider: event.target.value })} />
                  <Input placeholder="Level (B2, C1...)" value={cert.level ?? ""} onChange={(event) => updateCertificate(index, { level: event.target.value })} />
                  <Input placeholder="Date" value={cert.date ?? ""} onChange={(event) => updateCertificate(index, { date: event.target.value })} />
                  <Input aria-label={`Certificate ${index + 1} test type`} placeholder="Exact test type (e.g. IELTS Academic)" value={cert.test ?? ""} onChange={(event) => updateCertificate(index, { test: event.target.value })} />
                  <Input aria-label={`Certificate ${index + 1} overall score`} type="number" min="0" step="any" placeholder="Overall score" value={cert.score ?? ""} onChange={(event) => updateCertificate(index, { score: event.target.value === "" ? undefined : Number(event.target.value) })} />
                  {(["reading", "writing", "listening", "speaking"] as const).map((component) => <Input key={component} aria-label={`Certificate ${index + 1} ${component} score`} type="number" min="0" step="any" placeholder={`${component} score`} value={cert.componentScores?.[component] ?? ""} onChange={(event) => {
                    const scores = { ...cert.componentScores };
                    if (event.target.value === "") delete scores[component]; else scores[component] = Number(event.target.value);
                    updateCertificate(index, { componentScores: scores });
                  }} />)}
                  <div className="sm:col-span-2"><ProfileEvidenceEditor label={`Certificate ${index + 1}`} documents={documents} value={cert.evidence} onChange={(evidence) => updateCertificate(index, { evidence })} /></div>
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

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">Course credits from transcript</span>
              <Button variant="outline" size="sm" onClick={() => { update("academicCourses", [...(profile.academicCourses ?? []), { id: crypto.randomUUID(), title: "" }]); update("transcriptComplete", false); }}><Plus className="h-4 w-4" />Add course</Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Subject credits need a documented equivalence decision for the specific program and semester. A similar course title does not prove equivalence.</p>
            {(profile.academicCourses ?? []).map((course, index) => <div key={course.id} className="grid min-w-0 gap-3 border-b border-black/5 pb-4 sm:grid-cols-2">
              <Input aria-label={`Course ${index + 1} title`} placeholder="Course title" value={course.title} onChange={(event) => updateCourse(course.id, { title: event.target.value })} />
              <Input aria-label={`Course ${index + 1} ECTS`} type="number" min="0" step="any" placeholder="ECTS" value={course.ects ?? ""} onChange={(event) => updateCourse(course.id, { ects: event.target.value === "" ? undefined : Number(event.target.value) })} />
              <div className="sm:col-span-2"><ProfileEvidenceEditor label={`Course ${index + 1}`} documents={documents} value={course.evidence} onChange={(evidence) => updateCourse(course.id, { evidence })} /></div>
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => { update("academicCourses", profile.academicCourses?.filter((item) => item.id !== course.id)); update("courseEquivalences", []); update("transcriptComplete", false); }}><Trash2 className="h-4 w-4" />Remove course</Button>
            </div>)}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={profile.transcriptComplete ?? false} onChange={(event) => update("transcriptComplete", event.target.checked)} />I have reviewed and listed every course in the transcript.</label>
          </div>

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

          {dirty ? (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Review and save your extracted profile before running fit analysis.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-cream-soft p-4">
            <Button onClick={handleSave}>
              <Save className="h-4 w-4" />
              Save reviewed profile
            </Button>
            {saved ? <span className="text-sm font-medium text-emerald-700">Saved locally.</span> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
