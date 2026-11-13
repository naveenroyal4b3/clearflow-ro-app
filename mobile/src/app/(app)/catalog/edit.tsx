import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { Button, Field, Notice, Screen, Select } from '@/components/ui';
import { errorMessage, newId } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { saveWorkspaceRecords } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';

const categories = [msg('Purifiers'), msg('Accessories'), msg('Spare parts')];
// Unit codes are printed on GST invoices as they are.
const units = ['Nos', 'Pcs', 'Set', 'Box', 'Kg', 'Ltr', 'Mtr'].map(value => ({ value, label: value }));
type Form = { name: string; category: string; description: string; hsn: string; unit: string; customer: string; technician: string; shop: string; stock: string; gst: string };

const isAmount = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;

export default function EditProduct() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, profile, setData } = useSession();
  const readOnly = useReadOnlyReason();
  const existing = data.products.find(item => item.id === id);
  const [form, setForm] = useState<Form>({
    name: existing?.name || '', category: existing?.category || 'Purifiers', description: existing?.description || '', hsn: existing?.hsn || '',
    unit: existing?.unit || 'Nos', customer: String(existing?.customer ?? ''), technician: String(existing?.technician ?? ''), shop: String(existing?.shop ?? ''),
    stock: String(existing?.stock ?? 0), gst: String(existing?.gst ?? 18)
  });
  const [error, setError] = useState('');
  const set = (key: keyof Form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const valid = form.name.trim() && ['customer', 'technician', 'shop', 'stock'].every(key => isAmount(form[key as keyof Form]))
    && isAmount(form.gst) && Number(form.gst) <= 100 && Number.isInteger(Number(form.stock)) && /^\d{0,8}$/.test(form.hsn.trim());

  const save = async () => {
    setError('');
    if (!profile) return;
    const next: Product = {
      id: existing?.id || newId('P'), name: form.name.trim(), category: form.category, description: form.description.trim(), hsn: form.hsn.trim(), unit: form.unit,
      customer: Number(form.customer), technician: Number(form.technician), shop: Number(form.shop), stock: Number(form.stock), gst: Number(form.gst)
    };
    try {
      await saveWorkspaceRecords(supabase, profile, 'products', [next]);
    } catch (saveError) {
      setError(errorMessage(saveError, t('Save failed. Try again.')));
      return;
    }
    setData(current => ({ ...current, products: existing ? current.products.map(item => item.id === next.id ? next : item) : [...current.products, next] }));
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('Edit product') : t('Add product') }} />
      {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field label={t('Product name *')} value={form.name} onChangeText={set('name')} />
      <Select label={t('Category')} value={form.category} options={categories.map(value => ({ value, label: t(value) }))} onChange={set('category')} />
      <Field label={t('Description')} value={form.description} onChangeText={set('description')} />
      <Field label={t('HSN code (needed for GST invoices)')} value={form.hsn} onChangeText={set('hsn')} keyboardType="number-pad" maxLength={8} placeholder={t('e.g. 8421')} />
      <Select label={t('Unit')} value={form.unit} options={units} onChange={set('unit')} />
      <Field label={t('Customer price (₹) *')} value={form.customer} onChangeText={set('customer')} keyboardType="decimal-pad" />
      <Field label={t('Technician price (₹) *')} value={form.technician} onChangeText={set('technician')} keyboardType="decimal-pad" />
      <Field label={t('Shop price (₹) *')} value={form.shop} onChangeText={set('shop')} keyboardType="decimal-pad" />
      <Field label={t('Stock quantity')} value={form.stock} onChangeText={set('stock')} keyboardType="number-pad" />
      <Field label={t('GST rate (%)')} value={form.gst} onChangeText={set('gst')} keyboardType="decimal-pad" />
      <Button label={existing ? t('Save changes') : t('Add product')} onPress={save} disabled={Boolean(readOnly) || !valid} />
    </Screen>
  );
}
