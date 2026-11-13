import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Field, Notice, Screen, Select } from '@/components/ui';
import { errorMessage, newId, today } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { saveWorkspaceRecords } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { Feedback } from '@/lib/types';

// Values are stored in English and shown translated.
const toOptions = (values: string[]) => values.map(value => ({ value, label: t(value) }));

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
      setError(errorMessage(saveError, t('Not sent. Try again.')));
      return;
    }
    setData(current => ({ ...current, feedback: [entry, ...current.feedback] }));
    router.back();
  };

  return (
    <Screen>
      {offlineSince ? <Notice tone="warning">{t('You are offline. Feedback can be sent once you are back online.')}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Select label={t('What would you like to share? *')} value={form.type} options={toOptions([msg('Customer feedback'), msg('Issue'), msg('Bug'), msg('Feature request')])} onChange={set('type')} />
      <Select label={t('Priority')} value={form.priority} options={toOptions([msg('Normal'), msg('High'), msg('Urgent')])} onChange={set('priority')} />
      <Field label={t('Product, job or invoice reference')} value={form.reference} onChangeText={set('reference')} placeholder={t('Optional')} />
      <Field label={t('Subject *')} value={form.title} onChangeText={set('title')} maxLength={100} />
      <Field label={t('Details *')} value={form.description} onChangeText={set('description')} multiline maxLength={2000} />
      <Button label={t('Send feedback')} onPress={send} disabled={Boolean(offlineSince) || !form.title.trim() || !form.description.trim()} />
    </Screen>
  );
}
