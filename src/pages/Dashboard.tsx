import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  GraduationCap,
  Library,
  PlusCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { AcademicProfile, Program, StoredDocument } from "../domain/types";
import { Badge } from "../components/ui/badge";

type DashboardView = "profile" | "new-check" | "library";

interface DashboardProps {
  profile?: AcademicProfile;
  documents: StoredDocument[];
  programs: Program[];
  onNavigate: (view: DashboardView) => void;
}

interface ActionCard {
  id: DashboardView;
  title: string;
  description: string;
  icon: typeof UserRound;
  meta: string;
}

function profileComplete(profile?: AcademicProfile) {
  if (!profile) return false;
  return Boolean(profile.degree || profile.field || profile.ects || profile.languageCertificates.length);
}

export function Dashboard({ profile, documents, programs, onNavigate }: DashboardProps) {
  const ready = profileComplete(profile);
  const cards: ActionCard[] = [
    {
      id: "profile",
      title: "My Academic Profile",
      description: "Upload your transcript, diploma, CV, or language certificate and review every extracted field.",
      icon: UserRound,
      meta: ready ? `Saved - ${documents.length} document${documents.length === 1 ? "" : "s"}` : "Not set up yet",
    },
    {
      id: "new-check",
      title: "Check a Program",
      description: "Paste an admission page or add a program by hand, then analyze how well your profile fits.",
      icon: PlusCircle,
      meta: "Paste text or import a file",
    },
    {
      id: "library",
      title: "Program Library",
      description: "Browse demo programs, filter by language and country, and open any program for details.",
      icon: Library,
      meta: `${programs.length} program${programs.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:py-12">
      <header className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 shadow-soft backdrop-blur">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
          <div className="flex min-w-0 flex-col justify-between gap-8">
            <div className="grid gap-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-primary-foreground shadow-glow">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div className="grid gap-3">
                <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Know where your admission profile stands.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Compare your reviewed academic profile with program requirements using conservative, source-aware fit checks.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate("new-check")}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-crisp transition-all hover:-translate-y-0.5 hover:shadow-soft"
              >
                <Sparkles className="h-4 w-4" />
                Check a program
              </button>
              <button
                onClick={() => onNavigate(ready ? "library" : "profile")}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-indigo-100 bg-white px-5 text-sm font-semibold text-foreground shadow-sm transition-all hover:-translate-y-0.5"
              >
                {ready ? <Library className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                {ready ? "Browse library" : "Build profile"}
              </button>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 rounded-[1.75rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4 shadow-crisp">
            <div className="flex items-start justify-between gap-3 rounded-2xl bg-white/85 p-4 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Profile readiness</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{ready ? "Ready to check" : "Needs review"}</p>
              </div>
              <Badge variant={ready ? "green" : "yellow"}>{ready ? "Reviewed" : "Start here"}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/75 p-4 text-center">
                <FileText className="mx-auto h-5 w-5 text-cyan-600" />
                <p className="mt-2 text-2xl font-bold text-foreground">{documents.length}</p>
                <p className="text-xs font-medium text-muted-foreground">Docs</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-4 text-center">
                <Library className="mx-auto h-5 w-5 text-indigo-600" />
                <p className="mt-2 text-2xl font-bold text-foreground">{programs.length}</p>
                <p className="text-xs font-medium text-muted-foreground">Programs</p>
              </div>
              <div className="rounded-2xl bg-white/75 p-4 text-center">
                <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
                <p className="mt-2 text-2xl font-bold text-foreground">{ready ? "Yes" : "No"}</p>
                <p className="text-xs font-medium text-muted-foreground">Saved</p>
              </div>
            </div>
            <div className="rounded-2xl bg-white/75 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BookOpenCheck className="h-4 w-4 text-primary" />
                Conservative by design
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Unknown requirements stay unknown until you add official source text or reviewed profile data.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className="group grid content-start gap-4 rounded-2xl border border-white/70 bg-white/85 p-5 text-left shadow-crisp backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{card.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
              <Badge variant="outline" className="w-fit">
                {card.meta}
              </Badge>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs font-medium text-muted-foreground">
        Local-first - your profile and API key stay in this browser - demo programs are illustrative only.
      </p>
    </div>
  );
}
