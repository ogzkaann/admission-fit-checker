import { useMemo, useState } from "react";
import { AlertCircle, CalendarDays, ExternalLink, GraduationCap, Languages, ListChecks, MapPin, Wallet } from "lucide-react";
import type { AcademicProfile, AppSettings, FitAnalysis, Program, RequirementKind, StoredDocument } from "../domain/types";
import { degreeTypeLabels, documentKindLabels, requirementKindLabels } from "../domain/labels";
import { analyzeFit } from "../domain/fit/admissionFit";
import { documentsHaveExtraction, profileHasAcademicData } from "../domain/profileStatus";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { FitResult } from "./FitResult";
import { AskProgram } from "./AskProgram";

interface ProgramDetailProps {
  program: Program;
  profile?: AcademicProfile;
  documents: StoredDocument[];
  settings: AppSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const requirementOrder: RequirementKind[] = ["academic", "language", "ects", "gpa", "document", "other"];

function RequirementGroup({ program }: { program: Program }) {
  return (
    <div className="grid gap-3">
      {requirementOrder.map((kind) => {
        const items = program.requirements.filter((req) => req.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind} className="rounded-2xl border border-indigo-100 bg-white/75 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-primary">{requirementKindLabels[kind]}</p>
            <ul className="mt-2 grid gap-2">
              {items.map((req) => (
                <li key={req.id} className="flex gap-2 text-sm leading-6 text-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
                  <span>{req.label}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function ProgramDetail({ program, profile, documents, settings, open, onOpenChange }: ProgramDetailProps) {
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null);
  const needsProfileReview = !profileHasAcademicData(profile) && documentsHaveExtraction(documents);
  const initials = useMemo(
    () =>
      program.university
        .split(/\s+/)
        .map((word) => word[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [program.university],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={program.programName} description={program.university}>
      <div className="grid max-h-[72vh] gap-5 overflow-y-auto pr-1">
        <div className="grid gap-4 rounded-[1.75rem] border border-white/70 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-5 shadow-crisp sm:grid-cols-[auto_1fr]">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-xl font-bold text-primary-foreground shadow-glow">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{degreeTypeLabels[program.degreeType]}</Badge>
              <Badge variant="outline">{program.language}</Badge>
              <Badge variant="outline">
                {program.city}, {program.country}
              </Badge>
              {program.isDemo ? <Badge variant="yellow">Demo data</Badge> : <Badge variant="outline">Added by you</Badge>}
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{program.description}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-white/75 p-4 shadow-sm">
            <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Deadline</p>
              <p className="text-sm font-semibold text-foreground">{program.deadline ?? "-"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-white/75 p-4 shadow-sm">
            <Wallet className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Fee</p>
              <p className="text-sm font-semibold text-foreground">{program.fee ?? "-"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-white/75 p-4 shadow-sm">
            <Languages className="mt-0.5 h-4 w-4 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Language</p>
              <p className="text-sm font-semibold text-foreground">{program.language}</p>
            </div>
          </div>
        </div>

        {program.requiredDocuments.length > 0 ? (
          <section className="grid gap-2">
            <h4 className="text-base font-semibold text-foreground">Required documents</h4>
            <div className="flex flex-wrap gap-1.5">
              {program.requiredDocuments.map((doc) => (
                <Badge key={doc} variant="outline">
                  {documentKindLabels[doc]}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-3">
          <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <ListChecks className="h-4 w-4 text-primary" />
            Requirements
          </h4>
          <RequirementGroup program={program} />
        </section>

        <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {program.city}, {program.country}
          </span>
          {program.sourceUrl ? (
            <a className="inline-flex items-center gap-1 text-accent hover:underline" href={program.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Official source
            </a>
          ) : null}
          {program.lastChecked ? <span>Last checked {program.lastChecked}</span> : null}
        </div>

        {needsProfileReview ? (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Review and save your extracted profile before running fit analysis.
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t border-indigo-100 pt-4">
          <Button onClick={() => setAnalysis(analyzeFit(profile, documents, program))} disabled={needsProfileReview}>
            <GraduationCap className="h-4 w-4" />
            Check my fit
          </Button>
        </div>

        {analysis ? <FitResult analysis={analysis} /> : null}

        <AskProgram program={program} settings={settings} />
      </div>
    </Dialog>
  );
}
