import { Select } from './ui';
import { t } from '@/lib/i18n';
import { gstStates } from '@/lib/shared';

// State names stay as in the GST state list.
const states = Object.entries(gstStates as Record<string, string>)
  .sort((a, b) => a[1].localeCompare(b[1]))
  .map(([code, name]) => ({ value: code, label: name }));

export function StateSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Select label={label} value={value} options={[{ value: '', label: t('Not set') }, ...states]} onChange={onChange} placeholder={t('Select state')} />;
}
