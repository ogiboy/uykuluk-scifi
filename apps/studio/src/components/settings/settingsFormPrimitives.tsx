import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StudioSettingsCopy } from "./settingsCopy";

export function Field({
  children,
  controlId,
  label,
}: Readonly<{ children: React.ReactNode; controlId: string; label: string }>) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      {children}
    </div>
  );
}

export function BudgetInput({
  id,
  label,
  onChange,
  value,
}: Readonly<{ id: string; label: string; onChange: (value: number) => void; value: number }>) {
  return (
    <Field controlId={id} label={label}>
      <Input
        id={id}
        min={0}
        step='0.01'
        type='number'
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  );
}

export function Metadata({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className='grid gap-1'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <span className='truncate font-medium' title={value}>
        {value}
      </span>
    </div>
  );
}

export function StatusLine({
  configured,
  copy,
  label,
}: Readonly<{ configured: boolean; copy: StudioSettingsCopy; label: string }>) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <span>{label}</span>
      <Badge variant={configured ? "secondary" : "outline"}>
        {configured ? copy.configured : copy.missing}
      </Badge>
    </div>
  );
}
