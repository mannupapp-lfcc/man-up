import { MEETING_EVERY, everyLabel } from "@manup/shared";
import { DAYS, Label, inputClass } from "@/components/ui";

type Values = {
  name?: string; meeting_day?: string | null; meeting_time?: string | null; status?: string;
  meeting_every_weeks?: number; meeting_start_date?: string | null;
};

export function GroupFields({ values = {} }: { values?: Values }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Label text="Name">
        <input name="name" required defaultValue={values.name} className={inputClass} />
      </Label>
      <Label text="Meets on">
        <select name="meeting_day" defaultValue={values.meeting_day ?? ""} className={inputClass}>
          <option value="">Not set</option>
          {DAYS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Label>
      <Label text="At (local time)">
        <input name="meeting_time" type="time" defaultValue={values.meeting_time?.slice(0, 5) ?? ""} className={inputClass} />
      </Label>
      <Label text="How often">
        <select name="meeting_every_weeks" defaultValue={String(values.meeting_every_weeks ?? 1)} className={inputClass}>
          {MEETING_EVERY.map((n) => (
            <option key={n} value={n}>{everyLabel(n)}</option>
          ))}
        </select>
      </Label>
      <Label text="First meeting (if not every week)">
        <input name="meeting_start_date" type="date" defaultValue={values.meeting_start_date ?? ""} className={inputClass} />
      </Label>
      <Label text="Status">
        <select name="status" defaultValue={values.status ?? "forming"} className={inputClass}>
          <option value="forming">Forming</option>
          <option value="active">Active (meetings scheduled)</option>
          <option value="archived">Archived</option>
        </select>
      </Label>
    </div>
  );
}
