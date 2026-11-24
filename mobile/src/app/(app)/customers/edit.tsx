import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Field, Notice, Screen, Select } from '@/components/ui';
import { DateField } from '@/components/DateField';
import { StateSelect } from '@/components/StateSelect';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { errorMessage, newId, today } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { firstServiceDate, joinPhone, saveWorkspaceRecords, splitPhone, stateFromGstin, validPhone } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/lib/types';

const customerTypes = [msg('Residential'), msg('Commercial'), msg('Apartment')];
// Regular service intervals in months ('' for none).
const serviceIntervals = ['', '1', '2', '3', '4', '6', '12'];

export default function EditCustomer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, profile, setData } = useSession();
  const readOnly = useReadOnlyReason();
  const existing = data.customers.find(item => item.id === id);
  const [form, setForm] = useState<Customer>(existing || {
    id: '', name: '', phone: '', email: '', address: '', type: 'Residential', installed: '', purifier: '', notes: '', gstin: '', state: ''
  });
  const [error, setError] = useState('');
  // Country code (+91 by default) and number, as on the business form.
  const [code, setCode] = useState(splitPhone(existing?.phone).code);
  const [number, setNumber] = useState(splitPhone(existing?.phone).number);
  const set = (key: keyof Customer) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  // Choosing an interval fills in the next service date (from the installation date) if it is empty.
  const setInterval = (value: string) => setForm(current => ({
    ...current,
    serviceEvery: value ? Number(value) : null,
    nextService: value && !current.nextService ? firstServiceDate(current.installed, Number(value), today()) : value ? current.nextService : ''
  }));
  const validDate = !form.installed || (/^\d{4}-\d{2}-\d{2}$/.test(form.installed) && form.installed <= today());

  const save = async () => {
    setError('');
    if (!profile) return;
    const phone = validPhone(joinPhone(code, number));
    if (!phone) { setError(t('Enter a valid mobile number and country code.')); return; }
    const next: Customer = { ...form, id: existing?.id || newId('C'), name: form.name.trim(), phone, gstin: form.gstin.trim().toUpperCase(), state: form.state || stateFromGstin(form.gstin) };
    try {
      await saveWorkspaceRecords(supabase, profile, 'customers', [next]);
    } catch (saveError) {
      setError(errorMessage(saveError, t('Save failed. Try again.')));
      return;
    }
    setData(current => ({ ...current, customers: existing ? current.customers.map(item => item.id === next.id ? next : item) : [next, ...current.customers] }));
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('Edit customer') : t('Add customer') }} />
      {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label={t('Customer / business name *')} value={form.name} onChangeText={set('name')} maxLength={160} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ width: 92 }}><Field label={t('Country code')} value={code} onChangeText={setCode} keyboardType="phone-pad" maxLength={5} /></View>
        <View style={{ flex: 1 }}><Field label={t('Phone number *')} value={number} onChangeText={setNumber} keyboardType="phone-pad" maxLength={18} placeholder="98480 12345" /></View>
      </View>
      <Field label={t('Email')} value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Select label={t('Customer type')} value={form.type} options={customerTypes.map(value => ({ value, label: t(value) }))} onChange={set('type')} />
      <Field label={t('Full address')} value={form.address} onChangeText={set('address')} multiline />
      <Field label={t('Customer GSTIN (business customers)')} value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" maxLength={15} />
      <StateSelect label={t('State (place of supply)')} value={form.state} onChange={set('state')} />
      <Field label={t('Appliance / model installed')} value={form.purifier} onChangeText={set('purifier')} />
      <DateField label={t('Installation date')} value={form.installed} onChange={set('installed')} optional maximumDate={new Date()} />
      <Select label={t('Regular service')} value={form.serviceEvery ? String(form.serviceEvery) : ''} options={serviceIntervals.map(value => ({ value, label: value ? (value === '1' ? t('Every month') : t('Every {count} months', { count: value })) : t('No regular service') }))} onChange={setInterval} />
      {form.serviceEvery ? <DateField label={t('Next service date')} value={form.nextService || ''} onChange={set('nextService')} optional /> : null}
      <Field label={t('Notes')} value={form.notes} onChangeText={set('notes')} multiline />
      <Button label={existing ? t('Save changes') : t('Add customer')} onPress={save} disabled={Boolean(readOnly) || !form.name.trim() || !number.trim() || !validDate} />
    </Screen>
  );
}
