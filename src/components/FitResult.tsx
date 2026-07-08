import { CheckCircle2, CircleSlash, FileText, HelpCircle, ShieldAlert, Sparkles } from "lucide-react";
import type { FitAnalysis, RequirementCheck } from "../domain/types";
import { VerdictBadge } from "./VerdictBadge";
import { Badge } from "./ui/badge";

const statusIcon = {
  met: CheckCircle2,
  not_met: CircleSlash,
  unknown: HelpCircle,
};

const statusColor = {
  met: "text-emerald-600 bg-emerald-50 border-emerald-100",
  not_met: "text-red-600 bg-red-50 border-red-100",
  unknown: "text-slate-500 bg-slate-50 border-slate-100",
};

function CheckRow({ check }: { check: RequirementCheck }) {
  const Icon = statusIcon[check.status];
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-indigo-100 bg-white/75 p-4 shadow-sm">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${statusColor[check.status]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{check.label}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{check.detail}</p>
      </div>
      {!check.decisive ? <Badge variant="outline">info</Badge> : null}
    </div>
  );
}

export function FitResult({ analysis }: { analysis: FitAnalysis }) {
  return (
    <div className="grid min-w-0 gap-5">
      <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-5 shadow-crisp">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Fit verdict
            </p>
            <p className="mt-3 text-lg font-semibold leading-7 text-foreground">{analysis.summary}</p>
          </div>
          <VerdictBadge verdict={analysis.verdict} className="text-sm" />
        </div>
      </div>

      {analysis.needsVerification ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>This is a source-aware estimate, not an admission decision. Verify every requirement on the official program page.</p>
        </div>
      ) : null}

      {analysis.risks.length > 0 ? (
        <section className="grid gap-3">
          <h4 className="text-base font-semibold text-foreground">Risks to review</h4>
          <div className="grid gap-2">
            {analysis.risks.map((risk) => (
              <p key={risk} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                {risk}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      {analysis.checks.length > 0 ? (
        <section className="grid gap-3">
          <h4 className="text-base font-semibold text-foreground">Requirement checklist</h4>
          <div className="grid gap-2">
            {analysis.checks.map((check) => (
              <CheckRow key={check.requirementId} check={check} />
            ))}
          </div>
        </section>
      ) : null}

      {analysis.missingProfileData.length > 0 ? (
        <section className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
          <p className="text-sm font-semibold text-foreground">Add to your profile for a sharper check</p>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missingProfileData.map((item) => (
              <Badge key={item} variant="yellow">
                {item}
              </Badge>
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
            <div key={citation.id} className="min-w-0 rounded-2xl border border-indigo-100 bg-white/75 p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">{citation.label}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{citation.snippet}</p>
              {citation.sourceUrl ? (
                <a
                  className="mt-2 inline-block break-all text-sm font-medium text-accent hover:underline"
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
    </div>
  );
}
