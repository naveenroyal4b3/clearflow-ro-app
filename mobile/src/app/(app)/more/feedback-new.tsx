import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Field, Notice, Screen, Select } from '@/components/ui';
import { errorMessage, newId, today } from '@/lib/format';
import { useSession } from '@/lib/session';
import { saveWorkspaceRecords } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { Feedback } from '@/lib/types';

const toOptions = (values: string[]) => values.map(value => ({ value, label: value }));

// Feedback is allowed even when the plan has ended, so people can still report problems.
export default function NewFeedback() {
  const { profile, offlineSince, setData } = useSession();
  const [form, setForm] = useState({ type: 'Customer feedback', priority: 'Normal', reference: '', title: '', description: '' });
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));

  const send = async () => {
    setError('');
    if (!profile) return;
    const entry: Feedback = {
      ...form, id: newId('FB'), customerId: profile.customer_id || '', name: profile.full_name, phone: profile.phone, email: profile.login_email,
      status: 'New', date: today(), createdAt: new Date().toISOString()
    };
    try {
      await saveWorkspaceRecords(supabase, profile, 'feedback', [entry]);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Not sent. Try again.'));
      return;
    }
    setData(current => ({ ...current, feedback: [entry, ...current.feedback] }));
    router.back();
  };

  return (
    <Screen>
      {offlineSince ? <Notice tone="warning">You are offline. Feedback can be sent once you are back online.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Select label="What would you like to share? *" value={form.type} options={toOptions(['Customer feedback', 'Issue', 'Bug', 'Feature request'])} onChange={set('type')} />
      <Select label="Priority" value={form.priority} options={toOptions(['Normal', 'High', 'Urgent'])} onChange={set('priority')} />
      <Field label="Product, job or invoice reference" value={form.reference} onChangeText={set('reference')} placeholder="Optional" />
      <Field label="Subject *" value={form.title} onChangeText={set('title')} maxLength={100} />
      <Field label="Details *" value={form.description} onChangeText={set('description')} multiline maxLength={2000} />
      <Button label="Send feedback" onPress={send} disabled={Boolean(offlineSince) || !form.title.trim() || !form.description.trim()} />
    </Screen>
  );
}
