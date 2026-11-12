import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Field, Notice, Screen, Select, styles } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { inviteMember, loadWorkspace } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

const toOptions = (values: string[]) => values.map(value => ({ value, label: value }));

// Invites a technician, shop or customer by email (Supabase sends the sign-up link), or edits an
// existing team member's role, details and access.
export default function EditTeamMember() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, profile, offlineSince, setData } = useSession();
  const existing = data.accounts.find(item => item.id === id);
  const [form, setForm] = useState({
    name: existing?.name || '', email: existing?.username || '', role: existing?.role || 'Technician', phone: existing?.phone || '',
    address: existing?.address || '', gstin: existing?.gstin || '', linked: existing?.role === 'Customer' ? existing.linked : '', status: existing?.status || 'Active'
  });
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const roles = existing ? ['Technician', 'Shop', 'Customer', 'Owner'] : ['Technician', 'Shop', 'Customer'];
  const customerOptions = [{ value: '', label: 'Not linked' }, ...data.customers.map(item => ({ value: item.id, label: `${item.name} · ${item.phone}` }))];
  const valid = form.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && (form.role !== 'Customer' || form.linked);

  const save = async () => {
    setError('');
    if (!profile) return;
    try {
      if (existing) {
        const { error: updateError } = await supabase.from('profiles').update({
          full_name: form.name.trim(),
          phone: form.phone.trim(),
          role: form.role.toLowerCase(),
          business_name: form.role === 'Shop' ? form.name.trim() : '',
          business_address: form.address.trim(),
          gstin: form.gstin.trim(),
          customer_id: form.role === 'Customer' ? form.linked || null : null,
          active: form.status === 'Active'
        }).eq('user_id', existing.id).eq('organization_id', profile.organization_id);
        if (updateError) throw updateError;
      } else {
        await inviteMember(supabase, { email: form.email.trim(), name: form.name.trim(), phone: form.phone.trim(), role: form.role, linked: form.linked, address: form.address, gstin: form.gstin });
      }
      const fresh = await loadWorkspace(supabase, profile);
      setData(() => fresh);
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Save failed. Try again.'));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit team member' : 'Invite team member' }} />
      {offlineSince ? <Notice tone="warning">You are offline. Changes can be made once you are back online.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label="Name / business *" value={form.name} onChangeText={set('name')} />
      <Field label="Login email *" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" editable={!existing} />
      <Select label="Access role" value={form.role} options={toOptions(roles)} onChange={set('role')} />
      <Field label="Phone number" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Shop / business address" value={form.address} onChangeText={set('address')} />
      <Field label="GSTIN" value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" maxLength={15} />
      {form.role === 'Customer' ? <Select label="Linked customer record *" value={form.linked} options={customerOptions} onChange={set('linked')} /> : null}
      {existing ? <Select label="Account status" value={form.status} options={toOptions(['Active', 'Inactive'])} onChange={set('status')} /> : null}
      <Text style={styles.hint}>{existing ? 'Inactive accounts can no longer sign in.' : 'They receive an email to set their own password. Passwords are never stored here.'}</Text>
      <Button label={existing ? 'Save changes' : 'Send invitation'} onPress={save} disabled={Boolean(offlineSince) || !valid} />
    </Screen>
  );
}
