import type { AdmissionSemester } from "../domain/types";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

export function AdmissionSemesterInput({ value, onChange }: { value?: AdmissionSemester; onChange: (value: AdmissionSemester | undefined) => void }) {
  const [year = "", season = "winter"] = value?.split("-") ?? [];
  return (
    <div className="flex flex-wrap gap-3">
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">
        Admission year (start year)
        <Input type="number" min="1900" max="2200" placeholder="YYYY" value={year} onChange={(event) => onChange(event.target.value ? `${Number(event.target.value)}-${season}` as AdmissionSemester : undefined)} />
      </label>
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">
        Semester
        <Select aria-label="Semester" value={season} disabled={!year} onChange={(event) => onChange(year ? `${year}-${event.target.value}` as AdmissionSemester : undefined)}>
          <option value="winter">Winter</option><option value="summer">Summer</option>
        </Select>
      </label>
    </div>
  );
}
