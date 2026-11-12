import { useState } from 'react';
import { Brand, Button, Card, Field, Heading, Notice, Screen } from '@/components/ui';
import { StateSelect } from '@/components/StateSelect';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { stateFromGstin, updateOrganization } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

// A new owner's last step: the business that will be printed as the seller on invoices.
export default function Setup() {
  const { session, reload, signOut } = useSession();
  const metadata = (session?.user.user_metadata || {}) as Record<string, string | undefined>;
  const [form, setForm] = useState({ name: metadata.organization_name || '', gstin: metadata.gstin || '', address: '', state: '', phone: metadata.phone || '' });
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  const create = async () => {
    setError('');
    const { data: organizationId, error: createError } = await supabase.rpc('create_organization', { organization_name: form.name.trim(), organization_gstin: form.gstin.trim() || null });
    if (createError) { setError(createError.message); return; }
    try {
      await updateOrganization(supabase, organizationId, { ...form, state: form.state || stateFromGstin(form.gstin) });
    } catch (detailsError) {
      setError(`Workspace created, but the business details were not saved: ${errorMessage(detailsError, 'unknown error')}`);
    }
    await reload();
  };

  return (
    <Screen>
      <Card>
        <Brand />
        <Heading title="Finish business setup" subtitle="Confirm the legal details for your business before adding customers or issuing invoices." />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label="Business name" value={form.name} onChangeText={set('name')} maxLength={160} />
        <Field label="GSTIN (optional)" value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" maxLength={15} />
        <Field label="Business address" value={form.address} onChangeText={set('address')} multiline maxLength={300} />
        <StateSelect label="State" value={form.state} onChange={set('state')} />
        <Field label="Business phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <Button label="Create workspace" onPress={create} disabled={form.name.trim().length < 2} />
        <Button label="Sign out" variant="link" onPress={signOut} />
      </Card>
    </Screen>
  );
}
