import { ArrowRight, CheckCircle2, CircleSlash, FileText, HelpCircle, Sparkles } from "lucide-react";
import type { FitAnalysis, FitVerdict, RequirementCheck } from "../domain/types";
import { VerdictBadge } from "./VerdictBadge";
import { Badge } from "./ui/badge";

const statusIcon = {
  met: CheckCircle2,
  not_met: CircleSlash,
  unknown: HelpCircle,
  conditional: HelpCircle,
};

const statusColor = {
  met: "text-emerald-600 bg-emerald-50 border-emerald-100",
  not_met: "text-red-600 bg-red-50 border-red-100",
  unknown: "text-slate-500 bg-slate-100 border-slate-200",
  conditional: "text-amber-600 bg-amber-50 border-amber-200",
};

const verdictTint: Record<FitVerdict, string> = {
  strong_fit: "from-emerald-50 border-emerald-100",
  possible_risky: "from-amber-50 border-amber-100",
  not_recommended: "from-red-50 border-red-100",
  not_enough_data: "from-cream border-black/5",
};

function CheckRow({ check }: { check: RequirementCheck }) {
  const Icon = statusIcon[check.status];
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${statusColor[check.status]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{check.label}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{check.detail}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={check.hardBlocker ? "red" : "outline"}>{check.hardBlocker ? "Hard blocker" : check.mandatory ? "Mandatory" : "Advisory"}</Badge>
          <Badge variant="outline">{check.status === "unknown" ? "Unresolved" : check.status === "conditional" ? "Conditional route" : check.status === "met" ? "Evidence supports rule" : "Confirmed unmet"}</Badge>
        </div>
        {check.sourceIssues.length > 0 ? <p className="mt-2 text-xs leading-5 text-amber-800">{check.sourceIssues.join(" ")}</p> : null}
        {check.profileEvidence.map((evidence, index) => <p key={index} className="mt-2 break-words text-xs leading-5 text-muted-foreground">Reviewed document excerpt: {evidence.quote}</p>)}
      </div>
    </div>
  );
}

function nextActions(analysis: FitAnalysis): string[] {
  const actions: string[] = [];
  analysis.missingProfileData.forEach((item) => actions.push(`Review supporting evidence for: ${item}.`));
  if (analysis.verdict === "strong_fit") {
    actions.push("Confirm the application process and any selection criteria with the university.");
  }
  if (analysis.verdict === "not_recommended") {
    actions.push("Consider programs whose requirements better match your current profile.");
  }
  return Array.from(new Set(actions)).slice(0, 5);
}

export function FitResult({ analysis }: { analysis: FitAnalysis }) {
  const matches = analysis.checks.filter((check) => check.status === "met");
  const groups = [
    { title: "Hard blockers", checks: analysis.checks.filter((check) => check.hardBlocker) },
    { title: "Conditional requirements", checks: analysis.checks.filter((check) => check.status === "conditional") },
    { title: "Potential mismatches and advisory shortfalls", checks: analysis.checks.filter((check) => !check.hardBlocker && check.status !== "conditional" && check.comparison === "not_met") },
    { title: "Missing evidence and uncertain requirements", checks: analysis.checks.filter((check) => check.status === "unknown" && check.comparison !== "not_met") },
  ];
  const actions = nextActions(analysis);

  return (
    <div className="grid min-w-0 gap-6">
      {/* Verdict hero */}
      <div className={`overflow-hidden rounded-3xl border bg-gradient-to-br to-white p-6 shadow-crisp ${verdictTint[analysis.verdict]}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-navy/70">
              <Sparkles className="h-3.5 w-3.5" />
              Eligibility check {analysis.semester ? ` / ${analysis.semester}` : ""}
            </p>
            <p className="mt-3 font-display text-xl font-semibold leading-8 text-foreground sm:text-2xl">{analysis.summary}</p>
          </div>
          <VerdictBadge verdict={analysis.verdict} className="text-sm" />
        </div>
      </div>

      {analysis.sourceIssues.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <h4 className="font-semibold">{analysis.illustrative ? "Illustrative data, not verified admission information" : "Source verification needed"}</h4>
          <ul className="mt-2 list-inside list-disc">{analysis.sourceIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </section>
      ) : null}

      {matches.length > 0 ? (
        <section className="grid gap-3">
          <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Confirmed evidence against modeled rules
          </h4>
          <div className="grid gap-2">
            {matches.map((check) => (
              <CheckRow key={check.requirementId} check={check} />
            ))}
          </div>
        </section>
      ) : null}

      {groups.filter((group) => group.checks.length > 0).map((group) => (
        <section key={group.title} className="grid gap-3">
          <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <HelpCircle className="h-4 w-4 text-slate-500" />
            {group.title}
          </h4>
          <div className="grid gap-2">
            {group.checks.map((check) => (
              <CheckRow key={check.requirementId} check={check} />
            ))}
          </div>
        </section>
      ))}

      {analysis.missingProfileData.length > 0 ? (
        <section className="grid gap-3 rounded-2xl border border-black/5 bg-cream-soft p-4">
          <p className="text-sm font-semibold text-foreground">Missing profile data</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missingProfileData.map((item) => (
              <Badge key={item} variant="yellow">
                {item}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {actions.length > 0 ? (
        <section className="grid gap-3">
          <h4 className="text-base font-semibold text-foreground">Next actions</h4>
          <div className="grid gap-2">
            {actions.map((action) => (
              <div key={action} className="flex items-start gap-3 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm leading-6 text-foreground">{action}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3">
        <h4 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          Evidence
        </h4>
        <div className="grid gap-2">
          {analysis.citations.map((citation) => (
            <div key={citation.id} className="min-w-0 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">{citation.label}</p>
              <Badge className="mt-2" variant="outline">Source record: {citation.verificationStatus ?? "unverified"}</Badge>
              {citation.locator ? <p className="mt-1 text-xs text-muted-foreground">{citation.locator}</p> : null}
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{citation.snippet}</p>
              {citation.sourceUrl ? (
                <a
                  className="mt-2 inline-block break-all text-sm font-medium text-primary hover:underline"
                  href={citation.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {citation.sourceUrl}
                </a>
              ) : null}
              {citation.lastChecked ? (
                <span className="mt-2 block text-xs font-medium text-muted-foreground">Checked {citation.lastChecked}</span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

        <p className="text-xs leading-6 text-muted-foreground">
          Reviewed evidence confirms recorded information, not document authenticity or university recognition. This is not official admission advice or an admission guarantee. The university makes the final decision.
        </p>
    </div>
  );
}
