import { router, Stack, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { ProductImage } from '@/components/ProductImage';
import { catalogItem } from '@/lib/catalog';
import { Button, colors, Field, Notice, Screen, Select } from '@/components/ui';
import { errorMessage, newId } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { photoBytes, pickProductPhoto, useProductImageUrls, type PickedPhoto } from '@/lib/productImages';
import { useSession } from '@/lib/session';
import { removeProductImages, saveWorkspaceRecords, uploadProductImage } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';

const categories = [msg('Purifiers'), msg('Accessories'), msg('Spare parts')];
// Unit codes are printed on GST invoices as they are.
const units = ['Nos', 'Pcs', 'Set', 'Box', 'Kg', 'Ltr', 'Mtr'].map(value => ({ value, label: value }));
type Form = { name: string; category: string; description: string; hsn: string; unit: string; customer: string; technician: string; shop: string; stock: string; gst: string };

const isAmount = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;

export default function EditProduct() {
  // id edits a product; from starts a new one from a catalogue item.
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const { data, profile, setData } = useSession();
  const readOnly = useReadOnlyReason();
  const existing = data.products.find(item => item.id === id);
  const template = existing ? undefined : catalogItem(from || '');
  const [form, setForm] = useState<Form>({
    name: existing?.name || template?.name || '', category: existing?.category || template?.category || 'Purifiers', description: existing?.description || '', hsn: existing?.hsn || template?.hsn || '',
    unit: existing?.unit || template?.unit || 'Nos', customer: String(existing?.customer ?? ''), technician: String(existing?.technician ?? ''), shop: String(existing?.shop ?? ''),
    stock: String(existing?.stock ?? 0), gst: String(existing?.gst ?? template?.gst ?? 18)
  });
  const [error, setError] = useState('');
  // A newly taken or chosen photo (uploaded on save), or removed: true to drop the saved one.
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [removed, setRemoved] = useState(false);
  const savedUrls = useProductImageUrls(existing ? [existing] : []);
  const owner = profile?.role === 'owner';
  const oldImage = existing?.image || '';
  const shownUrl = photo ? photo.uri : removed || !oldImage ? undefined : savedUrls[oldImage];
  const hasPhoto = Boolean(photo) || (!removed && Boolean(oldImage));
  const set = (key: keyof Form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const valid = form.name.trim() && ['customer', 'technician', 'shop', 'stock'].every(key => isAmount(form[key as keyof Form]))
    && isAmount(form.gst) && Number(form.gst) <= 100 && Number.isInteger(Number(form.stock)) && /^\d{0,8}$/.test(form.hsn.trim());

  const choosePhoto = async (source: 'camera' | 'library') => {
    setError('');
    try {
      const picked = await pickProductPhoto(source);
      if (picked) { setPhoto(picked); setRemoved(false); }
    } catch (pickError) {
      setError(errorMessage(pickError, t('Could not get the photo. Try again.')));
    }
  };

  const removePhoto = () => { setPhoto(null); setRemoved(true); };

  const save = async () => {
    setError('');
    if (!profile) return;
    const productId = existing?.id || newId('P');
    let image = removed ? '' : oldImage;
    if (photo) {
      if (!profile.organization_id) return;
      try {
        image = await uploadProductImage(supabase, profile.organization_id, productId, await photoBytes(photo.uri), 'image/jpeg');
      } catch (uploadError) {
        setError(errorMessage(uploadError, t('Photo upload failed. Try again.')));
        return;
      }
    }
    const next: Product = {
      id: productId, name: form.name.trim(), category: form.category, description: form.description.trim(), hsn: form.hsn.trim(), unit: form.unit,
      customer: Number(form.customer), technician: Number(form.technician), shop: Number(form.shop), stock: Number(form.stock), gst: Number(form.gst), image
    };
    try {
      await saveWorkspaceRecords(supabase, profile, 'products', [next]);
    } catch (saveError) {
      // The new photo isn't used by any product, so delete it.
      if (photo && image) removeProductImages(supabase, [image]).catch(() => {});
      setError(errorMessage(saveError, t('Save failed. Try again.')));
      return;
    }
    if (oldImage && oldImage !== image) removeProductImages(supabase, [oldImage]).catch(() => {});
    setData(current => ({ ...current, products: existing ? current.products.map(item => item.id === next.id ? next : item) : [...current.products, next] }));
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? t('Edit product') : t('Add product') }} />
      {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <View style={local.photo}>
        <ProductImage product={{ name: form.name, category: form.category }} url={shownUrl} size={120} />
        {owner ? (
          <View style={local.photoButtons}>
            <Button label={t('Take photo')} variant="secondary" icon={<Ionicons name="camera-outline" size={18} color={colors.teal} />} onPress={() => choosePhoto('camera')} disabled={Boolean(readOnly)} />
            <Button label={t('Choose photo')} variant="secondary" icon={<Ionicons name="image-outline" size={18} color={colors.teal} />} onPress={() => choosePhoto('library')} disabled={Boolean(readOnly)} />
            {hasPhoto ? <Button label={t('Remove photo')} variant="link" onPress={removePhoto} disabled={Boolean(readOnly)} /> : null}
          </View>
        ) : null}
      </View>
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

const local = StyleSheet.create({
  photo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoButtons: { flex: 1, gap: 8 }
});
