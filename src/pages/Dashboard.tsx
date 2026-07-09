import { useState } from "react";
import { motion, MotionConfig, type Variants } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ClipboardCheck,
  FileUp,
  Globe,
  GraduationCap,
  Link2,
  Lock,
  Scale,
  Settings,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import type { AcademicProfile, AppSettings, Program, StoredDocument } from "../domain/types";
import { ProgramCard } from "../components/ProgramCard";
import { ProgramDetail } from "../components/ProgramDetail";

type View = "dashboard" | "profile" | "library" | "new-check";

interface DashboardProps {
  profile?: AcademicProfile;
  documents: StoredDocument[];
  programs: Program[];
  settings: AppSettings;
  onNavigate: (view: View) => void;
  onOpenSettings: () => void;
  onQuickCheck: (values: { university: string; programName: string; link: string }) => void;
}

const reveal: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const trustPills = [
  { icon: FileUp, label: "OCR profile extraction" },
  { icon: Lock, label: "Local-first" },
  { icon: ShieldCheck, label: "Conservative fit verdicts" },
  { icon: Sparkles, label: "BYOK AI" },
];

const steps = [
  { icon: UploadCloud, title: "Upload documents", body: "Add transcripts, CV, and certificates. We extract your academic profile — even from scans." },
  { icon: ClipboardCheck, title: "Review profile", body: "Confirm and edit the extracted fields so everything stays accurate and up to date." },
  { icon: Scale, title: "Compare requirements", body: "We compare your profile with program requirements using a conservative approach." },
  { icon: GraduationCap, title: "Decide", body: "Get your fit verdict and key gaps. Decide where you have the strongest chance." },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Dashboard({
  profile,
  documents,
  programs,
  settings,
  onNavigate,
  onOpenSettings,
  onQuickCheck,
}: DashboardProps) {
  const [university, setUniversity] = useState("");
  const [programName, setProgramName] = useState("");
  const [link, setLink] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeProgram = programs.find((program) => program.id === activeId);
  const curated = programs.slice(0, 4);

  const ready = Boolean(profile?.degree || profile?.field || profile?.ects || profile?.languageCertificates.length);

  const navLinks: Array<{ label: string; action: () => void }> = [
    { label: "Home", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { label: "Programs", action: () => onNavigate("library") },
    { label: "How it works", action: () => scrollToId("how-it-works") },
    { label: "Profile", action: () => onNavigate("profile") },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="overflow-x-hidden">
        {/* ---------------- HERO ---------------- */}
        <section className="relative isolate min-h-[640px] w-full overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/hero-campus.png')" }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-900/95 via-navy-900/80 to-navy-900/35" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cream to-transparent" aria-hidden />

          {/* Top nav */}
          <div className="relative z-10 mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 sm:px-6">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur">
                <BookOpen className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight">Admission Fit Checker</span>
            </button>

            <nav className="ml-auto hidden items-center gap-7 lg:flex">
              {navLinks.map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="text-sm font-medium text-white/85 transition-colors hover:text-white"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2 lg:ml-4">
              <span className="hidden items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-medium text-white/90 backdrop-blur sm:inline-flex">
                <Globe className="h-4 w-4" />
                EN
                <ChevronDown className="h-3.5 w-3.5" />
              </span>
              <button
                onClick={onOpenSettings}
                aria-label="Settings"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Hero content */}
          <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-12">
            <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-2xl">
              <motion.h1
                variants={reveal}
                className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl"
              >
                Find the programs{" "}
                <em className="not-italic">
                  <span className="font-display italic text-gold-soft">worth applying</span>
                </em>{" "}
                to.
              </motion.h1>
              <motion.p variants={reveal} className="mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
                Upload your academic profile, compare it with university requirements, and get a conservative fit verdict
                before you spend time applying.
              </motion.p>
              <motion.div variants={reveal} className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => onNavigate(ready ? "library" : "profile")}
                  className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-navy shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Build my profile
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-navy text-white transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
                <button
                  onClick={() => onNavigate("new-check")}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 text-sm font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/15"
                >
                  Check a program
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
              <motion.div variants={reveal} className="mt-7 flex flex-wrap gap-2.5">
                {trustPills.map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <span
                      key={pill.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {pill.label}
                    </span>
                  );
                })}
              </motion.div>
            </motion.div>

            {/* Quick program fit check card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              className="w-full rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl"
            >
              <p className="flex items-center gap-2 text-base font-semibold text-white">
                <Sparkles className="h-5 w-5 text-gold-soft" />
                Quick program fit check
              </p>
              <div className="mt-5 grid gap-3">
                <GlassInput icon={GraduationCap} placeholder="University name, e.g., MIT" value={university} onChange={setUniversity} />
                <GlassInput icon={BookOpen} placeholder="Program name, e.g., MS in Data Science" value={programName} onChange={setProgramName} />
                <GlassInput icon={Link2} placeholder="Program link (optional)" value={link} onChange={setLink} />
                <button
                  onClick={() => onQuickCheck({ university, programName, link })}
                  className="group mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Analyze fit
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
              <p className="mt-4 text-xs font-medium text-white/70">Get a conservative fit verdict in seconds.</p>
            </motion.div>
          </div>
        </section>

        {/* ---------------- HOW IT WORKS ---------------- */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={reveal}
            className="max-w-2xl"
          >
            <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">How it works</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Four simple steps to make smarter application decisions.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div key={step.title} variants={reveal} className="relative">
                  <div className="h-full rounded-3xl border border-black/5 bg-white p-6 shadow-crisp transition-all hover:-translate-y-1 hover:shadow-soft">
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream text-navy">
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                  </div>
                  {index < steps.length - 1 ? (
                    <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-gold xl:block" />
                  ) : null}
                </motion.div>
              );
            })}
          </motion.div>
        </section>

        {/* ---------------- CURATED PROGRAMS ---------------- */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={reveal}
            className="flex flex-wrap items-end justify-between gap-4"
          >
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Curated programs</h2>
              <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
                Handpicked master&apos;s programs around the world.
              </p>
            </div>
            <button
              onClick={() => onNavigate("library")}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-navy"
            >
              View all programs
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            variants={stagger}
            className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
          >
            {curated.map((program) => (
              <motion.div key={program.id} variants={reveal} className="min-w-0">
                <ProgramCard program={program} onOpen={(p) => setActiveId(p.id)} />
              </motion.div>
            ))}
          </motion.div>
        </section>

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
    </MotionConfig>
  );
}

function GlassInput({
  icon: Icon,
  placeholder,
  value,
  onChange,
}: {
  icon: typeof GraduationCap;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 backdrop-blur transition-colors focus-within:border-white/50">
      <Icon className="h-5 w-5 shrink-0 text-white/70" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full min-w-0 border-0 bg-transparent text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
