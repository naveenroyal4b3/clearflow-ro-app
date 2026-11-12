import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Field, Notice, Screen, Select } from '@/components/ui';
import { StateSelect } from '@/components/StateSelect';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { errorMessage, newId, today } from '@/lib/format';
import { useSession } from '@/lib/session';
import { saveWorkspaceRecords, stateFromGstin } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/lib/types';

const customerTypes = ['Residential', 'Commercial', 'Apartment'].map(value => ({ value, label: value }));

export default function EditCustomer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, profile, setData } = useSession();
  const readOnly = useReadOnlyReason();
  const existing = data.customers.find(item => item.id === id);
  const [form, setForm] = useState<Customer>(existing || {
    id: '', name: '', phone: '', email: '', address: '', type: 'Residential', installed: '', purifier: '', notes: '', gstin: '', state: ''
  });
  const [error, setError] = useState('');
  const set = (key: keyof Customer) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const validDate = !form.installed || (/^\d{4}-\d{2}-\d{2}$/.test(form.installed) && form.installed <= today());

  const save = async () => {
    setError('');
    if (!profile) return;
    const next: Customer = { ...form, id: existing?.id || newId('C'), name: form.name.trim(), phone: form.phone.trim(), gstin: form.gstin.trim().toUpperCase(), state: form.state || stateFromGstin(form.gstin) };
    try {
      await saveWorkspaceRecords(supabase, profile, 'customers', [next]);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Save failed. Try again.'));
      return;
    }
    setData(current => ({ ...current, customers: existing ? current.customers.map(item => item.id === next.id ? next : item) : [next, ...current.customers] }));
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit customer' : 'Add customer' }} />
      {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="Customer / business name *" value={form.name} onChangeText={set('name')} maxLength={160} />
      <Field label="Phone number *" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Select label="Customer type" value={form.type} options={customerTypes} onChange={set('type')} />
      <Field label="Full address" value={form.address} onChangeText={set('address')} multiline />
      <Field label="Customer GSTIN (business customers)" value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" maxLength={15} />
      <StateSelect label="State (place of supply)" value={form.state} onChange={set('state')} />
      <Field label="Purifier / model installed" value={form.purifier} onChangeText={set('purifier')} />
      <Field label="Installation date" value={form.installed} onChangeText={set('installed')} placeholder="YYYY-MM-DD" hint={validDate ? undefined : 'Use YYYY-MM-DD, not in the future.'} />
      <Field label="Notes" value={form.notes} onChangeText={set('notes')} multiline />
      <Button label={existing ? 'Save changes' : 'Add customer'} onPress={save} disabled={Boolean(readOnly) || !form.name.trim() || !form.phone.trim() || !validDate} />
    </Screen>
  );
}
