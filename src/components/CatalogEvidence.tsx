import type { Program } from "../domain/types";
import { catalogStatusLabel } from "../domain/catalog";

export function CatalogEvidence({ program }: { program: Program }) {
  if (program.origin !== "catalog") return null;
  return (
    <section className="grid min-w-0 grid-cols-1 gap-3 border-y border-black/5 py-4 text-sm leading-6 [overflow-wrap:anywhere]">
      <h4 className="font-semibold text-foreground">Official-source evidence</h4>
      <p className="text-muted-foreground">
        {catalogStatusLabel(program)}. Editorial verification is not university approval or an admission guarantee.
        {" "}Semester validity: {program.validFor?.length ? program.validFor.join(", ") : "not established"}.
      </p>
      <p className="break-all text-xs text-muted-foreground">Catalog revision: {program.catalogVersion ?? "unknown"}</p>
      {program.catalogIssues?.length ? <ul className="grid min-w-0 grid-cols-1 gap-1 text-amber-900 [overflow-wrap:anywhere]">{program.catalogIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : null}
      <div className="grid min-w-0 grid-cols-1 gap-2">
        {(program.sources ?? []).map((source) => (
          <div key={source.snapshotId ?? source.url} className="min-w-0">
            <a className="break-all text-accent hover:underline" href={source.url} target="_blank" rel="noreferrer">{source.url}</a>
            <p className="text-xs text-muted-foreground">{source.status} | Captured {source.retrievedAt?.slice(0, 10) ?? "unknown"} | Last checked {source.lastChecked?.slice(0, 10) ?? "unknown"}{source.reviewedBy ? ` | Reviewer: ${source.reviewedBy}` : " | No editorial approval"}</p>
          </div>
        ))}
      </div>
      {(program.facts ?? []).map((fact) => (
        <details key={fact.id} className="min-w-0 border-t border-black/5 pt-2">
          <summary className="cursor-pointer font-medium capitalize">{fact.category}: {fact.id.replace(/-/g, " ")} <span className="font-normal text-muted-foreground">({fact.value === null ? "unknown" : fact.evidence.length && fact.evidence.every((source) => source.status === "verified") ? "reviewed" : "unverified evidence"})</span></summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{fact.value ?? "Not established from the captured official sources."}</p>
          {fact.note ? <p className="mt-2 text-amber-900">{fact.note}</p> : null}
          {fact.evidence.map((source, index) => <a key={`${source.snapshotId}-${index}`} className="mt-1 block break-words text-xs text-accent hover:underline" href={source.url} target="_blank" rel="noreferrer">{source.locator ?? "Source clause"} ({source.status})</a>)}
        </details>
      ))}
    </section>
  );
}
