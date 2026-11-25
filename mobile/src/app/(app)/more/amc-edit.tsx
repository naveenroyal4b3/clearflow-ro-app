import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { Button, Card, colors, Field, Notice, Screen, Select, styles as ui } from '@/components/ui';
import { errorMessage, newId, today } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { addMonths, amcRenewal, saveWorkspaceRecords } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { AmcContract } from '@/lib/types';

// One year from the start date, ending the day before (25 Nov 2026 to 24 Nov 2027).
function yearFrom(start: string) {
  const end = new Date(`${addMonths(start, 12)}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return end.toISOString().slice(0, 10);
}

type Form = { customerId: string; appliance: string; start: string; end: string; amount: string; visits: string; visitsUsed: number; notes: string };

// A new AMC contract (a year from today by default), an existing one, or (renew=<id>) the renewal
// of an existing one for the next year.
export default function EditAmc() {
  const { id, renew } = useLocalSearchParams<{ id?: string; renew?: string }>();
  const { data, profile, setData } = useSession();
  const readOnly = useReadOnlyReason();
  const existing = data.amc.find(item => item.id === id);
  const renewing = renew ? data.amc.find(item => item.id === renew) : undefined;
  const base: AmcContract | undefined = existing || (renewing && amcRenewal(renewing));
  const start = today();
  const [form, setForm] = useState<Form>({
    customerId: base?.customerId || '', appliance: base?.appliance || '', start: base?.start || start, end: base?.end || yearFrom(start),
    amount: base ? String(base.amount) : '', visits: base ? String(base.visits) : '3', visitsUsed: base?.visitsUsed ?? 0, notes: base?.notes || ''
  });
  const [error, setError] = useState('');
  const set = (key: keyof Form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const customer = data.customers.find(item => item.id === form.customerId);
  const visits = Number(form.visits);
  const valid = form.customerId && form.start && form.end && form.end >= form.start && Number(form.amount) >= 0 && form.amount.trim() !== ''
    && Number.isInteger(visits) && visits >= 0 && visits <= 52;

  const save = async (status: AmcContract['status'] = existing?.status || 'Active') => {
    setError('');
    if (!profile) return;
    const next: AmcContract = {
      id: existing?.id || newId('AMC'), customerId: form.customerId, appliance: form.appliance.trim(), start: form.start, end: form.end,
      amount: Number(form.amount), visits, visitsUsed: Math.min(form.visitsUsed, visits), notes: form.notes.trim(), status
    };
    try {
      await saveWorkspaceRecords(supabase, profile, 'amc', [next]);
      setData(current => ({ ...current, amc: existing ? current.amc.map(item => item.id === next.id ? next : item) : [...current.amc, next] }));
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError, t('Save failed. Try again.')));
    }
  };

  const cancel = () => Alert.alert(t('Cancel this contract?'), t('It stays in the list as cancelled and is no longer reminded for renewal.'), [
    { text: t('Keep'), style: 'cancel' },
    { text: t('Cancel contract'), style: 'destructive', onPress: () => save('Cancelled') }
  ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('AMC contract') : renewing ? t('Renew AMC') : t('New AMC contract') }} />
      {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Select label={t('Customer *')} value={form.customerId} placeholder={t('Choose customer')}
        options={data.customers.map(item => ({ value: item.id, label: `${item.name} · ${item.phone}` }))}
        onChange={value => setForm(current => ({ ...current, customerId: value, appliance: current.appliance || data.customers.find(item => item.id === value)?.purifier || '' }))} />
      <Field label={t('Appliance / model')} value={form.appliance} onChangeText={set('appliance')} placeholder={customer?.purifier || t('e.g. Kent RO, LG 1.5 ton AC')} />
      <View style={local.row}>
        <View style={ui.flex}><DateField label={t('Starts on')} value={form.start} onChange={value => setForm(current => ({ ...current, start: value, end: current.end && current.end > value ? current.end : yearFrom(value) }))} /></View>
        <View style={ui.flex}><DateField label={t('Ends on')} value={form.end} onChange={set('end')} /></View>
      </View>
      <View style={local.row}>
        <View style={ui.flex}><Field label={t('Amount (₹) *')} value={form.amount} onChangeText={set('amount')} keyboardType="decimal-pad" placeholder="1500" /></View>
        <View style={ui.flex}><Field label={t('Visits included')} value={form.visits} onChangeText={set('visits')} keyboardType="number-pad" maxLength={2} /></View>
      </View>
      {existing ? (
        <Card>
          <Text style={ui.label}>{t('Visits used')}</Text>
          <View style={local.counter}>
            <Button label="−" variant="secondary" onPress={() => setForm(current => ({ ...current, visitsUsed: Math.max(0, current.visitsUsed - 1) }))} disabled={form.visitsUsed <= 0} />
            <Text style={local.count}>{t('{used} of {total}', { used: form.visitsUsed, total: Number.isFinite(visits) ? visits : 0 })}</Text>
            <Button label="+" variant="secondary" onPress={() => setForm(current => ({ ...current, visitsUsed: Math.min(visits, current.visitsUsed + 1) }))} disabled={form.visitsUsed >= visits} />
          </View>
        </Card>
      ) : null}
      <Field label={t('Notes')} value={form.notes} onChangeText={set('notes')} multiline placeholder={t('What is covered, for example filters and service, not spare parts')} />
      <Text style={ui.hint}>{t('To bill the contract, make an invoice for it in Sales.')}</Text>
      <Button label={existing ? t('Save changes') : renewing ? t('Save renewal') : t('Add contract')} onPress={() => save()} disabled={Boolean(readOnly) || !valid} />
      {existing && existing.status !== 'Cancelled' ? (
        <>
          <Button label={t('Renew for next year')} variant="secondary" onPress={() => router.replace({ pathname: '/more/amc-edit', params: { renew: existing.id } })} disabled={Boolean(readOnly)} />
          <Button label={t('Cancel contract')} variant="link" onPress={cancel} disabled={Boolean(readOnly)} />
        </>
      ) : null}
    </Screen>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  count: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.ink }
});
