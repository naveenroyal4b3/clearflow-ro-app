import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReadOnlyReason } from './PlanNotice';
import { Button, Card, CardTitle, colors } from './ui';
import { errorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { addSampleData, isSample, removeSampleData } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

// The owner's first steps on Home: add a product, a customer and a first quotation or invoice
// (sample records don't count). Hidden once all three are done and no sample data is left. A new
// business can add sample data to look around first, and remove it later.
export function GettingStarted() {
  const { profile, data, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const [error, setError] = useState('');
  if (profile?.role !== 'owner') return null;

  const real = <T extends { id: string }>(items: T[]) => items.filter(item => !isSample(item.id));
  const hasSamples = [...data.customers, ...data.products, ...data.jobs].some(item => isSample(item.id));
  const steps: { label: string; done: boolean; href: Href }[] = [
    { label: t('Add your first product'), done: real(data.products).length > 0, href: '/catalog/pick' },
    { label: t('Add your first customer'), done: real(data.customers).length > 0, href: '/customers/edit' },
    { label: t('Create your first quotation or invoice'), done: data.documents.length > 0, href: '/sales/new' }
  ];
  const doneCount = steps.filter(step => step.done).length;
  if (doneCount === steps.length && !hasSamples) return null;
  const empty = !data.customers.length && !data.products.length;

  const open = (step: (typeof steps)[number]) => {
    if (readOnly) { Alert.alert(t('Not available'), readOnly); return; }
    // A bill needs a customer and a product first.
    if (step.href === '/sales/new' && (!data.customers.length || !data.products.length)) {
      Alert.alert(t('Add a customer and a product first'), t('A quotation or invoice needs at least one customer and one product.'));
      return;
    }
    router.push(step.href);
  };

  const addSamples = async () => {
    setError('');
    if (!profile) return;
    try { await addSampleData(supabase, profile); await reload(); }
    catch (addError) { setError(errorMessage(addError, t('Could not add sample data. Try again.'))); }
  };

  const removeSamples = () => Alert.alert(t('Remove sample data?'), t('The example customers, products and jobs will be deleted. Your own records stay.'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Remove'), style: 'destructive', onPress: async () => {
      setError('');
      if (!profile?.organization_id) return;
      try {
        const kept = await removeSampleData(supabase, profile.organization_id);
        await reload();
        if (kept) Alert.alert(t('Some sample data was kept'), t('Sample records used on a quotation or invoice stay, because the document needs them.'));
      } catch (removeError) { setError(errorMessage(removeError, t('Could not remove sample data. Try again.'))); }
    } }
  ]);

  return (
    <Card style={{ backgroundColor: colors.tealPale, borderColor: '#cfe6dd' }}>
      <CardTitle title={t('Get started')} note={t('{done} of {total} done', { done: doneCount, total: steps.length })} />
      <View style={local.bar}><View style={[local.fill, { width: `${Math.round(doneCount / steps.length * 100)}%` }]} /></View>
      {steps.map(step => (
        <Pressable key={step.label} style={local.step} disabled={step.done} onPress={() => open(step)} accessibilityRole="button" accessibilityState={{ checked: step.done }}>
          <Ionicons name={step.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={step.done ? colors.teal : colors.muted} />
          <Text style={[local.label, step.done && local.done]}>{step.label}</Text>
          {step.done ? null : <Ionicons name="chevron-forward" size={18} color={colors.teal} />}
        </Pressable>
      ))}
      {error ? <Text style={local.error}>{error}</Text> : null}
      {empty ? (
        <>
          <Button label={t('Add sample data')} variant="secondary" onPress={addSamples} disabled={Boolean(readOnly)} />
          <Text style={local.hint}>{t('See how TiruFix works with a few example customers, products and jobs. You can remove them any time.')}</Text>
        </>
      ) : hasSamples ? (
        <>
          <Text style={local.hint}>{t('Sample data is in your app. Look around, then remove it when you add your own.')}</Text>
          <Button label={t('Remove sample data')} variant="secondary" onPress={removeSamples} disabled={Boolean(readOnly)} />
        </>
      ) : null}
    </Card>
  );
}

const local = StyleSheet.create({
  bar: { height: 6, borderRadius: 3, backgroundColor: '#cfe6dd', overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.teal },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  done: { color: colors.muted, textDecorationLine: 'line-through', fontWeight: '400' },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  error: { fontSize: 13, color: colors.red }
});
