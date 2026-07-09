import { ChangeEvent, useState } from "react";
import { AlertCircle, FileText, FileUp, GraduationCap, Loader2, Save, Sparkles } from "lucide-react";
import type {
  AcademicProfile,
  AppSettings,
  DegreeType,
  FitAnalysis,
  Program,
  ProgramRequirement,
  StoredDocument,
} from "../domain/types";
import { degreeTypeLabels } from "../domain/labels";
import { analyzeFit } from "../domain/fit/admissionFit";
import { documentsHaveExtraction, profileHasAcademicData } from "../domain/profileStatus";
import { extractDocument } from "../rag/documentExtraction";
import { saveProgram } from "../storage/repository";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { FitResult } from "../components/FitResult";

interface NewProgramCheckProps {
  profile?: AcademicProfile;
  documents: StoredDocument[];
  settings: AppSettings;
  onDataChange: () => void;
  prefill?: { university?: string; programName?: string; link?: string };
}

// Best-effort structured requirements from free-text admission info so the fit
// check has something to compare against. Conservative by design.
function parseRequirements(text: string): ProgramRequirement[] {
  const requirements: ProgramRequirement[] = [];
  const ects = text.match(/\b(1[0-9]{2}|2[0-9]{2})\s*ECTS\b/i);
  if (ects) {
    requirements.push({ id: "p-ects", kind: "ects", label: `At least ${ects[1]} ECTS`, minEcts: Number(ects[1]), sourceText: ects[0] });
  }
  for (const lang of ["English", "German"]) {
    const re = new RegExp(`${lang}[^.\\n]{0,40}?(A1|A2|B1|B2|C1|C2)`, "i");
    const match = text.match(re);
    if (match) {
      requirements.push({
        id: `p-lang-${lang}`,
        kind: "language",
        label: `${lang} at ${match[1].toUpperCase()}`,
        language: lang,
        minLevel: match[1].toUpperCase(),
        sourceText: match[0],
      });
    }
  }
  if (/bachelor/i.test(text)) {
    requirements.push({ id: "p-degree", kind: "academic", label: "Bachelor's degree required", degreeType: "bachelor", sourceText: "bachelor" });
  }
  return requirements;
}

export function NewProgramCheck({ profile, documents, settings, onDataChange, prefill }: NewProgramCheckProps) {
  const [university, setUniversity] = useState(prefill?.university ?? "");
  const [programName, setProgramName] = useState(prefill?.programName ?? "");
  const [degreeType, setDegreeType] = useState<DegreeType>("master");
  const [language, setLanguage] = useState("English");
  const [link, setLink] = useState(prefill?.link ?? "");
  const [admissionText, setAdmissionText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [program, setProgram] = useState<Program | null>(null);
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const [saved, setSaved] = useState(false);

  function buildProgram(): Program {
    const requirements = parseRequirements(admissionText);
    return {
      id: `user-${crypto.randomUUID()}`,
      university: university.trim() || "Unnamed university",
      programName: programName.trim() || "Untitled program",
      degreeType,
      language,
      country: "",
      city: "",
      description: admissionText.slice(0, 280),
      sourceUrl: link.trim() || undefined,
      lastChecked: new Date().toISOString().slice(0, 10),
      requiredDocuments: [],
      requirements,
      admissionText,
      origin: "user",
      isDemo: false,
      createdAt: new Date().toISOString(),
    };
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const extracted = await extractDocument(file, (extractionEvent) => setMessage(extractionEvent.message));
      if (!extracted.text.trim()) throw new Error("No text could be read from this file, even with OCR.");
      setAdmissionText((current) => `${current}\n${extracted.text}`.trim());
      setMessage(`Imported text from ${file.name}${extracted.usedOcr ? " (OCR)" : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the file.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  const needsProfileReview = !profileHasAcademicData(profile) && documentsHaveExtraction(documents);

  function analyze() {
    if (needsProfileReview) return;
    const built = buildProgram();
    setProgram(built);
    setAnalysis(analyzeFit(profile, documents, built));
    setSaved(false);
  }

  async function saveToLibrary() {
    if (!program) return;
    await saveProgram(program);
    setSaved(true);
    onDataChange();
  }

  const canAnalyze = admissionText.trim().length > 0 || programName.trim().length > 0;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:py-10">
      <header className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-crisp backdrop-blur sm:p-8">
        <div className="flex items-center gap-3 text-sm font-semibold text-primary">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          Check a Program
        </div>
        <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Add admission text and analyze your fit.</h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          Paste requirements from the program page or import a PDF, screenshot, or image. The check compares the source text with your saved profile.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Program details
            </CardTitle>
            <CardDescription>Only admission text is required for a basic check.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                University name
                <Input value={university} onChange={(event) => setUniversity(event.target.value)} placeholder="e.g. University of Amsterdam" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Program name
                <Input value={programName} onChange={(event) => setProgramName(event.target.value)} placeholder="e.g. M.Sc. Data Science" />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Degree type
                <Select value={degreeType} onChange={(event) => setDegreeType(event.target.value as DegreeType)}>
                  {(Object.keys(degreeTypeLabels) as DegreeType[]).map((item) => (
                    <option key={item} value={item}>
                      {degreeTypeLabels[item]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Language of instruction
                <Input value={language} onChange={(event) => setLanguage(event.target.value)} />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium">
              Program link (optional)
              <Input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Admission requirements text
              <Textarea
                className="min-h-48"
                value={admissionText}
                onChange={(event) => setAdmissionText(event.target.value)}
                placeholder="Paste the program's admission requirements here..."
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-black/5 bg-white px-4 text-sm font-semibold shadow-sm transition hover:border-primary/30">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                Import PDF, image, or screenshot
                <input
                  className="sr-only"
                  type="file"
                  accept="application/pdf,.pdf,image/png,image/jpeg,.png,.jpg,.jpeg"
                  onChange={handleImport}
                  disabled={busy}
                />
              </label>
              <span className="text-xs font-medium text-muted-foreground">Scanned files are read locally with OCR.</span>
            </div>
            {message ? <p className="rounded-2xl border border-black/5 bg-cream-soft p-3 text-sm text-muted-foreground">{message}</p> : null}

            {needsProfileReview ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Review and save your extracted profile before running fit analysis.
              </div>
            ) : null}

            <Button className="w-fit" onClick={analyze} disabled={!canAnalyze || needsProfileReview}>
              <Sparkles className="h-4 w-4" />
              Analyze fit
            </Button>
          </CardContent>
        </Card>

        <div className="min-w-0">
          {analysis ? (
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 bg-cream-soft">
                <div>
                  <CardTitle>Fit result</CardTitle>
                  <CardDescription>Source-aware estimate from your profile and this program text.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={saveToLibrary} disabled={saved}>
                  <Save className="h-4 w-4" />
                  {saved ? "Saved" : "Save"}
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                <FitResult analysis={analysis} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid min-h-full place-items-center rounded-3xl border border-dashed border-gold/40 bg-cream-soft p-8 text-center shadow-crisp">
              <div className="grid max-w-sm justify-items-center gap-3">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
                  <GraduationCap className="h-7 w-7" />
                </span>
                <p className="text-xl font-semibold text-foreground">Your fit result will appear here.</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Add program information, then run the check to see verdict, risks, requirement checks, and evidence.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
