import { useMemo, useState } from "react";
import { BookOpenCheck, Library, MapPin, PlusCircle, SearchX } from "lucide-react";
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
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-5 rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-crisp backdrop-blur sm:p-8">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-primary">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-primary">
              <Library className="h-5 w-5" />
            </span>
            Program Library
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Browse university programs.</h2>
          <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
            Start with demo programs, filter by language and country, or add your own admission text for a fit check.
          </p>
        </div>
        <Button variant="outline" onClick={onAddProgram}>
          <PlusCircle className="h-4 w-4" />
          Add a program
        </Button>
      </header>

      <div className="grid gap-3 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-crisp backdrop-blur sm:grid-cols-3">
        <label className="grid gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          Language
          <Select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value={ALL}>All languages</option>
            {languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          Degree
          <Select value={degree} onChange={(event) => setDegree(event.target.value)}>
            <option value={ALL}>All degrees</option>
            {degrees.map((item) => (
              <option key={item} value={item}>
                {degreeTypeLabels[item as DegreeType]}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
          Country
          <Select value={country} onChange={(event) => setCountry(event.target.value)}>
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
        <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/60 p-10 text-center">
          <SearchX className="h-9 w-9 text-cyan-600" />
          <p className="text-lg font-semibold text-foreground">No programs match these filters.</p>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Try widening the filters or add a program from official admission text.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((program) => (
            <button
              key={program.id}
              onClick={() => setActiveId(program.id)}
              className="group grid min-w-0 content-start gap-4 rounded-2xl border border-white/70 bg-white/85 p-5 text-left shadow-crisp backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-primary">
                  <BookOpenCheck className="h-5 w-5" />
                </span>
                {program.isDemo ? <Badge variant="yellow">Demo</Badge> : <Badge variant="outline">Yours</Badge>}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-muted-foreground">{program.university}</p>
                <h3 className="mt-1 text-lg font-semibold leading-7 text-foreground">{program.programName}</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{degreeTypeLabels[program.degreeType]}</Badge>
                <Badge variant="outline">{program.language}</Badge>
              </div>
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
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
