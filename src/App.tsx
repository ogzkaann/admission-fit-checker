import { useCallback, useEffect, useState } from "react";
import { BookOpen, KeyRound, LayoutDashboard, Library, PlusCircle, Sparkles, UserRound } from "lucide-react";
import type { AcademicProfile, AppSettings, Program, StoredDocument } from "./domain/types";
import { loadSettings } from "./ai/settings";
import { getProfile, listDocuments, listPrograms } from "./storage/repository";
import { SettingsDialog } from "./components/SettingsDialog";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Dashboard } from "./pages/Dashboard";
import { ProfileBuilder } from "./pages/ProfileBuilder";
import { ProgramLibrary } from "./pages/ProgramLibrary";
import { NewProgramCheck } from "./pages/NewProgramCheck";

type View = "dashboard" | "profile" | "library" | "new-check";

const navItems: Array<{ id: View; label: string; icon: typeof UserRound }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "library", label: "Program Library", icon: Library },
  { id: "new-check", label: "Check a Program", icon: PlusCircle },
];

interface QuickCheckPrefill {
  university: string;
  programName: string;
  link: string;
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<AcademicProfile>();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [prefill, setPrefill] = useState<QuickCheckPrefill>();

  const refresh = useCallback(async () => {
    const [nextProfile, nextDocuments, nextPrograms] = await Promise.all([getProfile(), listDocuments(), listPrograms()]);
    setProfile(nextProfile);
    setDocuments(nextDocuments);
    setPrograms(nextPrograms);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function goToView(next: View) {
    if (next !== "new-check") setPrefill(undefined);
    setView(next);
  }

  function handleQuickCheck(values: QuickCheckPrefill) {
    setPrefill(values);
    setView("new-check");
  }

  function renderView() {
    switch (view) {
      case "profile":
        return <ProfileBuilder settings={settings} onSaved={refresh} />;
      case "library":
        return (
          <ProgramLibrary
            programs={programs}
            profile={profile}
            documents={documents}
            settings={settings}
            onAddProgram={() => setView("new-check")}
          />
        );
      case "new-check":
        return (
          <NewProgramCheck
            profile={profile}
            documents={documents}
            settings={settings}
            onDataChange={refresh}
            prefill={prefill}
          />
        );
      default:
        return (
          <Dashboard
            profile={profile}
            documents={documents}
            programs={programs}
            settings={settings}
            onNavigate={goToView}
            onOpenSettings={() => setSettingsOpen(true)}
            onQuickCheck={handleQuickCheck}
          />
        );
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden text-foreground">
      {view !== "dashboard" ? (
        <header className="sticky top-0 z-40 border-b border-black/5 bg-cream-soft/85 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
            <button className="group flex min-w-0 items-center gap-2.5" onClick={() => goToView("dashboard")} aria-label="Go to home">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white shadow-sm transition-transform group-hover:-translate-y-0.5">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block font-display text-base font-semibold leading-5 text-foreground">Admission Fit Checker</span>
                <span className="block text-xs font-medium text-muted-foreground">Source-aware fit checks</span>
              </span>
            </button>

            <nav className="no-scrollbar ml-auto flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-black/5 bg-white/70 p-1 shadow-sm">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={view === item.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => goToView(item.id)}
                    className={view === item.id ? "shadow-sm" : ""}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden md:inline">{item.label}</span>
                  </Button>
                );
              })}
            </nav>

            <Badge variant={settings.apiKey ? "green" : "outline"} className="hidden lg:inline-flex gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {settings.apiKey ? settings.providerName : "No API key"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <KeyRound className="h-4 w-4" />
              <span className="hidden lg:inline">Settings</span>
            </Button>
          </div>
        </header>
      ) : null}

      <main>{renderView()}</main>

      <SettingsDialog
        open={settingsOpen}
        settings={settings}
        onOpenChange={setSettingsOpen}
        onSave={setSettings}
      />
    </div>
  );
}
