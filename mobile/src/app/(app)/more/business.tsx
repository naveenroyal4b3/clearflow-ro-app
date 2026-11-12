import { router } from 'expo-router';
import { useState } from 'react';
import { StateSelect } from '@/components/StateSelect';
import { Button, Field, Notice, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { stateFromGstin, updateOrganization } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

// The seller details printed on quotations and GST invoices. Allowed even when the plan has ended.
export default function BusinessDetails() {
  const { organization, profile, offlineSince, setOrganization } = useSession();
  const [form, setForm] = useState({ name: organization?.name || '', gstin: organization?.gstin || '', address: organization?.address || '', state: organization?.state_code || '', phone: organization?.phone || '' });
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  if (profile?.role !== 'owner' || !organization) return <Screen><Notice>Only the business owner can change business details.</Notice></Screen>;

  const save = async () => {
    setError('');
    try {
      setOrganization(await updateOrganization(supabase, organization.id, { ...form, state: form.state || stateFromGstin(form.gstin) }));
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Save failed. Try again.'));
    }
  };

  return (
    <Screen>
      {offlineSince ? <Notice tone="warning">You are offline. Changes can be made once you are back online.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="Business name *" value={form.name} onChangeText={set('name')} maxLength={160} />
      <Field label="GSTIN" value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" maxLength={15} hint="Needed to issue GST invoices." />
      <StateSelect label="State" value={form.state} onChange={set('state')} />
      <Field label="Business address" value={form.address} onChangeText={set('address')} multiline maxLength={300} />
      <Field label="Business phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Button label="Save details" onPress={save} disabled={Boolean(offlineSince) || form.name.trim().length < 2} />
    </Screen>
  );
}
