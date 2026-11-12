import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { DateField } from '@/components/DateField';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { Button, Card, CardTitle, Field, Notice, Screen, Select, styles } from '@/components/ui';
import { errorMessage, newId, today } from '@/lib/format';
import { useSession } from '@/lib/session';
import { saveWorkspaceRecords } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/lib/types';

const jobTypes = ['Installation', 'Filter replacement', 'Routine maintenance', 'Quarterly maintenance', 'Low water flow', 'Repair', 'Other'];
const allStatuses = ['Scheduled', 'In progress', 'Completed', 'Cancelled'];
const toOptions = (values: string[]) => values.map(value => ({ value, label: value }));

// Owners schedule and edit jobs; technicians can only start or complete their assigned jobs.
export default function EditJob() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, profile, setData } = useSession();
  const readOnly = useReadOnlyReason();
  const existing = data.jobs.find(item => item.id === id);
  const technicianMode = profile?.role === 'technician';
  const [form, setForm] = useState<Job>(existing || { id: '', customerId: data.customers[0]?.id || '', type: 'Installation', date: today(), technician: '', status: 'Scheduled', notes: '' });
  const [error, setError] = useState('');
  const set = (key: keyof Job) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const customer = data.customers.find(item => item.id === form.customerId);
  const technicians = data.accounts.filter(account => account.role === 'Technician' && account.status === 'Active');
  const technicianOptions = [{ value: '', label: 'Unassigned' }, ...technicians.map(account => ({ value: account.name, label: account.name }))];
  if (form.technician && !technicians.some(account => account.name === form.technician)) technicianOptions.push({ value: form.technician, label: form.technician });

  const save = async () => {
    setError('');
    if (!profile) return;
    try {
      if (technicianMode && existing) {
        const { error: updateError } = await supabase.rpc('set_service_job_status', { job_id: existing.id, next_status: form.status, job_notes: form.notes || null });
        if (updateError) throw updateError;
        setData(current => ({ ...current, jobs: current.jobs.map(item => item.id === existing.id ? { ...item, status: form.status, notes: form.notes } : item) }));
      } else {
        const next: Job = { ...form, id: existing?.id || newId('SR') };
        await saveWorkspaceRecords(supabase, profile, 'jobs', [next], data.accounts);
        setData(current => ({ ...current, jobs: existing ? current.jobs.map(item => item.id === next.id ? next : item) : [next, ...current.jobs] }));
      }
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Save failed. Try again.'));
    }
  };

  if (technicianMode && existing) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Update service job' }} />
        {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Card>
          <CardTitle title={customer?.name || 'Customer'} note={`${existing.type} · ${existing.id}`} />
          {customer?.address ? <Text style={styles.hint}>{customer.address}</Text> : null}
        </Card>
        <Select label="Status" value={form.status} options={toOptions(['In progress', 'Completed'])} onChange={set('status')} />
        <Field label="Service notes" value={form.notes} onChangeText={set('notes')} multiline placeholder="What was done, parts used, readings…" />
        <Button label="Save update" onPress={save} disabled={Boolean(readOnly)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit service job' : 'Schedule service' }} />
      {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Select label="Customer *" value={form.customerId} options={data.customers.map(item => ({ value: item.id, label: `${item.name} · ${item.phone}` }))} onChange={set('customerId')} />
      <Select label="Service type *" value={form.type} options={toOptions(jobTypes)} onChange={set('type')} />
      <DateField label="Visit date *" value={form.date} onChange={set('date')} />
      <Select label="Technician" value={form.technician} options={technicianOptions} onChange={set('technician')} />
      <Select label="Status" value={form.status} options={toOptions(allStatuses)} onChange={set('status')} />
      <Field label="Job notes" value={form.notes} onChangeText={set('notes')} multiline />
      <Button label={existing ? 'Save changes' : 'Schedule job'} onPress={save} disabled={Boolean(readOnly) || !form.customerId || !form.date} />
    </Screen>
  );
}
