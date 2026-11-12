import { Select } from './ui';
import { gstStates } from '@/lib/shared';

const options = [
  { value: '', label: 'Not set' },
  ...Object.entries(gstStates as Record<string, string>)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => ({ value: code, label: name }))
];

export function StateSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Select label={label} value={value} options={options} onChange={onChange} placeholder="Select state" />;
}
