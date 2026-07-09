import { CalendarDays, Globe2, Heart, Landmark } from "lucide-react";
import type { DegreeType, Program } from "../domain/types";

const degreeShort: Record<DegreeType, string> = {
  bachelor: "BSc",
  master: "MSc",
  phd: "PhD",
  other: "Prog",
};

const countryFlags: Record<string, string> = {
  Germany: "🇩🇪",
  Netherlands: "🇳🇱",
  Sweden: "🇸🇪",
  Italy: "🇮🇹",
  Switzerland: "🇨🇭",
  France: "🇫🇷",
  Spain: "🇪🇸",
  "United Kingdom": "🇬🇧",
  UK: "🇬🇧",
  USA: "🇺🇸",
  "United States": "🇺🇸",
};

// Deterministic gradient per program so placeholder headers feel distinct.
const gradients = [
  "from-navy-800 to-navy-600",
  "from-[#1e3a5f] to-[#2a6fb0]",
  "from-[#1a2b4a] to-[#4a6a8f]",
  "from-[#243b55] to-[#3f7cad]",
];

function gradientFor(id: string) {
  const sum = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return gradients[sum % gradients.length];
}

function initials(university: string) {
  return university
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface ProgramCardProps {
  program: Program;
  onOpen: (program: Program) => void;
}

export function ProgramCard({ program, onOpen }: ProgramCardProps) {
  return (
    <button
      onClick={() => onOpen(program)}
      className="group flex min-w-0 flex-col overflow-hidden rounded-3xl border border-black/5 bg-white text-left shadow-crisp transition-all duration-300 hover:-translate-y-1.5 hover:shadow-soft"
    >
      {/* Placeholder image / header */}
      <div className={`relative h-36 bg-gradient-to-br ${gradientFor(program.id)}`}>
        <div className="absolute inset-0 opacity-25">
          <Landmark className="absolute -bottom-3 -right-2 h-28 w-28 text-white" strokeWidth={1} />
        </div>
        <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-navy shadow-sm transition-colors group-hover:bg-white">
          <Heart className="h-4 w-4" />
        </div>
        <span className="absolute left-3 top-3 text-3xl font-display font-semibold tracking-tight text-white/90">
          {initials(program.university)}
        </span>
        <span className="absolute bottom-3 left-3 inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground shadow">
          {degreeShort[program.degreeType]}
        </span>
        {program.isDemo ? (
          <span className="absolute bottom-3 right-3 rounded-full bg-white/85 px-2.5 py-0.5 text-[11px] font-semibold text-navy">
            Demo
          </span>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold leading-6 text-foreground">{program.programName}</h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{program.university}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Globe2 className="h-3.5 w-3.5" />
            {program.language}
          </span>
          <span className="inline-flex items-center gap-1">
            <span>{countryFlags[program.country] ?? "🎓"}</span>
            {program.country}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-black/5 pt-3 text-sm">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            {program.deadline ?? "Rolling"}
          </span>
          <span className="font-semibold text-foreground">{program.fee ?? "—"}</span>
        </div>
      </div>
    </button>
  );
}
