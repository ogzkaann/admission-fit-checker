import { useCallback, useEffect, useState } from "react";
import { GraduationCap, KeyRound, Library, PlusCircle, UserRound } from "lucide-react";
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
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "library", label: "Program Library", icon: Library },
  { id: "new-check", label: "Check a Program", icon: PlusCircle },
];

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState<AcademicProfile>();
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  const refresh = useCallback(async () => {
    const [nextProfile, nextDocuments, nextPrograms] = await Promise.all([getProfile(), listDocuments(), listPrograms()]);
    setProfile(nextProfile);
    setDocuments(nextDocuments);
    setPrograms(nextPrograms);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
        return <NewProgramCheck profile={profile} documents={documents} settings={settings} onDataChange={refresh} />;
      default:
        return <Dashboard profile={profile} documents={documents} programs={programs} onNavigate={setView} />;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-4">
          <button className="flex items-center gap-2" onClick={() => setView("dashboard")} aria-label="Go to dashboard">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="hidden text-sm font-semibold sm:block">Admission Fit Checker</span>
          </button>

          <nav className="no-scrollbar ml-auto flex min-w-0 items-center gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant={view === item.id ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setView(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              );
            })}
          </nav>

          <Badge variant={settings.apiKey ? "green" : "outline"} className="hidden md:inline-flex">
            {settings.apiKey ? settings.providerName : "No API key"}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </header>

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
