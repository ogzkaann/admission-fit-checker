import type { ProfileEvidence, StoredDocument } from "../domain/types";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

export function ProfileEvidenceEditor({ label, value, documents, onChange }: {
  label: string;
  value?: ProfileEvidence;
  documents: StoredDocument[];
  onChange: (value: ProfileEvidence | undefined) => void;
}) {
  const document = documents.find((item) => item.id === value?.documentId);
  return (
    <div className="grid min-w-0 gap-2">
      <label className="grid gap-1 text-xs font-medium">
        {label}: supporting document
        <Select aria-label={`${label}: supporting document`} value={value?.documentId ?? ""} onChange={(event) => onChange(event.target.value ? { documentId: event.target.value, quote: "", reviewedAt: new Date().toISOString() } : undefined)}>
          <option value="">No linked evidence</option>
          {documents.filter((item) => item.status !== "failed").map((item) => <option key={item.id} value={item.id}>{item.fileName}</option>)}
        </Select>
      </label>
      {value ? <>
        <label className="grid gap-1 text-xs font-medium">
          {label}: exact supporting excerpt
          <Textarea className="min-h-20" value={value.quote} onChange={(event) => onChange({ ...value, quote: event.target.value, reviewedAt: new Date().toISOString() })} />
        </label>
        <details className="min-w-0 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Extracted document text</summary>
          <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">{document?.text ?? "Linked document is unavailable."}</pre>
        </details>
      </> : null}
    </div>
  );
}
