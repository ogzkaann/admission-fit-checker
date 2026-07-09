import { useMemo, useState, type ReactNode } from "react";
import { Library, PlusCircle, SearchX } from "lucide-react";
import type { AcademicProfile, AppSettings, DegreeType, Program, StoredDocument } from "../domain/types";
import { degreeTypeLabels } from "../domain/labels";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { ProgramCard } from "../components/ProgramCard";
import { ProgramDetail } from "../components/ProgramDetail";

interface ProgramLibraryProps {
  programs: Program[];
  profile?: AcademicProfile;
  documents: StoredDocument[];
  settings: AppSettings;
  onAddProgram: () => void;
}

const ALL = "all";

function FilterPill({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-1.5 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-auto min-w-[8rem] rounded-full border-0 bg-transparent px-1 pr-8 text-sm font-medium shadow-none"
      >
        {children}
      </Select>
    </label>
  );
}

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
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white">
              <Library className="h-5 w-5" />
            </span>
            Program Library
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Browse university programs.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Start with curated demo programs, filter by language and country, or add your own admission text for a fit check.
          </p>
        </div>
        <Button variant="outline" onClick={onAddProgram}>
          <PlusCircle className="h-4 w-4" />
          Add a program
        </Button>
      </header>

      <div className="flex flex-wrap gap-3">
        <FilterPill label="Language" value={language} onChange={setLanguage}>
          <option value={ALL}>All</option>
          {languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterPill>
        <FilterPill label="Degree" value={degree} onChange={setDegree}>
          <option value={ALL}>All</option>
          {degrees.map((item) => (
            <option key={item} value={item}>
              {degreeTypeLabels[item as DegreeType]}
            </option>
          ))}
        </FilterPill>
        <FilterPill label="Country" value={country} onChange={setCountry}>
          <option value={ALL}>All</option>
          {countries.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </FilterPill>
      </div>

      {filtered.length === 0 ? (
        <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-gold/40 bg-cream-soft p-12 text-center">
          <SearchX className="h-9 w-9 text-gold-700" />
          <p className="text-lg font-semibold text-foreground">No programs match these filters.</p>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Try widening the filters or add a program from official admission text.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((program) => (
            <ProgramCard key={program.id} program={program} onOpen={(p) => setActiveId(p.id)} />
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
