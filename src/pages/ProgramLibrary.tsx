import { useMemo, useState } from "react";
import { Library, MapPin, PlusCircle } from "lucide-react";
import type { AcademicProfile, AppSettings, DegreeType, Program, StoredDocument } from "../domain/types";
import { degreeTypeLabels } from "../domain/labels";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { ProgramDetail } from "../components/ProgramDetail";

interface ProgramLibraryProps {
  programs: Program[];
  profile?: AcademicProfile;
  documents: StoredDocument[];
  settings: AppSettings;
  onAddProgram: () => void;
}

const ALL = "all";

export function ProgramLibrary({ programs, profile, documents, settings, onAddProgram }: ProgramLibraryProps) {
  const [language, setLanguage] = useState(ALL);
  const [degree, setDegree] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [activeId, setActiveId] = useState<string | null>(null);

  const languages = useMemo(() => Array.from(new Set(programs.map((p) => p.language))).sort(), [programs]);
  const countries = useMemo(() => Array.from(new Set(programs.map((p) => p.country))).sort(), [programs]);
  const degrees = useMemo(() => Array.from(new Set(programs.map((p) => p.degreeType))), [programs]);

  const filtered = programs.filter(
    (program) =>
      (language === ALL || program.language === language) &&
      (degree === ALL || program.degreeType === degree) &&
      (country === ALL || program.country === country),
  );

  const activeProgram = programs.find((program) => program.id === activeId);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Library className="h-4 w-4" />
            Program Library
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Browse university programs.</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pre-researched demo programs plus anything you add. Open one to see requirements and check your fit.
          </p>
        </div>
        <Button variant="outline" onClick={onAddProgram}>
          <PlusCircle className="h-4 w-4" />
          Add a program
        </Button>
      </header>

      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Language
          <Select className="w-40" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value={ALL}>All languages</option>
            {languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Degree
          <Select className="w-40" value={degree} onChange={(event) => setDegree(event.target.value)}>
            <option value={ALL}>All degrees</option>
            {degrees.map((item) => (
              <option key={item} value={item}>
                {degreeTypeLabels[item as DegreeType]}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Country
          <Select className="w-40" value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value={ALL}>All countries</option>
            {countries.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No programs match these filters.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((program) => (
            <button
              key={program.id}
              onClick={() => setActiveId(program.id)}
              className="grid content-start gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-crisp transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-muted-foreground">{program.university}</p>
                {program.isDemo ? <Badge variant="yellow">Demo</Badge> : <Badge variant="outline">Yours</Badge>}
              </div>
              <h3 className="text-base font-semibold leading-6 text-foreground">{program.programName}</h3>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{degreeTypeLabels[program.degreeType]}</Badge>
                <Badge variant="outline">{program.language}</Badge>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {program.city}, {program.country}
              </p>
            </button>
          ))}
        </div>
      )}

      {activeProgram ? (
        <ProgramDetail
          program={activeProgram}
          profile={profile}
          documents={documents}
          settings={settings}
          open={Boolean(activeId)}
          onOpenChange={(open) => !open && setActiveId(null)}
        />
      ) : null}
    </div>
  );
}
