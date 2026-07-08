import { CheckCircle2, CircleSlash, FileText, HelpCircle, ShieldAlert } from "lucide-react";
import type { FitAnalysis, RequirementCheck } from "../domain/types";
import { VerdictBadge } from "./VerdictBadge";
import { Badge } from "./ui/badge";

const statusIcon = {
  met: CheckCircle2,
  not_met: CircleSlash,
  unknown: HelpCircle,
};

const statusColor = {
  met: "text-emerald-600",
  not_met: "text-red-600",
  unknown: "text-muted-foreground",
};

function CheckRow({ check }: { check: RequirementCheck }) {
  const Icon = statusIcon[check.status];
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${statusColor[check.status]}`} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{check.label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{check.detail}</p>
      </div>
      {!check.decisive ? <Badge variant="outline">info</Badge> : null}
    </div>
  );
}

export function FitResult({ analysis }: { analysis: FitAnalysis }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fit verdict</p>
          <p className="mt-1 text-sm leading-6 text-foreground">{analysis.summary}</p>
        </div>
        <VerdictBadge verdict={analysis.verdict} />
      </div>

      {analysis.needsVerification ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>This is a source-aware estimate, not an admission decision. Verify every requirement on the official program page.</p>
        </div>
      ) : null}

      {analysis.checks.length > 0 ? (
        <section className="grid gap-2">
          <h4 className="text-sm font-semibold text-foreground">Requirement checks</h4>
          <div className="grid gap-2">
            {analysis.checks.map((check) => (
              <CheckRow key={check.requirementId} check={check} />
            ))}
          </div>
        </section>
      ) : null}

      {analysis.missingProfileData.length > 0 ? (
        <section className="grid gap-2 rounded-lg border border-border bg-slate-50 p-3">
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

      <section className="grid gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4" />
          Evidence
        </h4>
        <div className="grid gap-2">
          {analysis.citations.map((citation) => (
            <div key={citation.id} className="rounded-md border border-border bg-slate-50 p-3">
              <p className="text-xs font-semibold text-foreground">{citation.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{citation.snippet}</p>
              {citation.sourceUrl ? (
                <a
                  className="mt-1 inline-block break-all text-xs text-accent hover:underline"
                  href={citation.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {citation.sourceUrl}
                </a>
              ) : null}
              {citation.lastChecked ? (
                <span className="ml-2 text-xs text-muted-foreground">· checked {citation.lastChecked}</span>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
