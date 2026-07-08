import { ArrowRight, GraduationCap, Library, PlusCircle, UserRound } from "lucide-react";
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
  const cards: ActionCard[] = [
    {
      id: "profile",
      title: "My Academic Profile",
      description: "Upload your transcript, diploma, CV, or language certificate and review the extracted profile.",
      icon: UserRound,
      meta: profileComplete(profile)
        ? `Saved · ${documents.length} document${documents.length === 1 ? "" : "s"}`
        : "Not set up yet",
    },
    {
      id: "new-check",
      title: "Check a Program",
      description: "Paste an admission page or add a program by hand, then analyze how well your profile fits.",
      icon: PlusCircle,
      meta: "Paste text or a link",
    },
    {
      id: "library",
      title: "Program Library",
      description: "Browse pre-researched demo programs, filter by language and country, and open any for details.",
      icon: Library,
      meta: `${programs.length} program${programs.length === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:py-14">
      <header className="grid gap-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Admission Fit Checker</h1>
        <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Upload your academic profile and compare it with university program requirements.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.id)}
              className="group grid content-start gap-3 rounded-xl border border-border bg-card p-5 text-left shadow-crisp transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <h2 className="text-base font-semibold text-foreground">{card.title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
              <Badge variant="outline" className="w-fit">
                {card.meta}
              </Badge>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Local-first · your profile and API key stay in this browser · demo programs are illustrative only.
      </p>
    </div>
  );
}
