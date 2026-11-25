import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { StateSelect } from '@/components/StateSelect';
import { Button, Card, CardTitle, colors, Field, Notice, Screen, Select, styles as ui } from '@/components/ui';
import { errorMessage, money, newId, today } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { createPurchaseBill, purchaseTotals, saveWorkspaceRecords, stateFromGstin } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { PurchaseBill, Supplier } from '@/lib/types';

type Line = { productId: string; qty: string; rate: string; gst: string };
const NEW = '__new__';

// A bill from a supplier: its items go into stock when saved. A new supplier can be added here.
export default function NewPurchase() {
  const { data, profile, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const product = (id: string) => data.products.find(item => item.id === id);
  const [supplierId, setSupplierId] = useState(data.suppliers.length ? '' : NEW);
  const [supplier, setSupplier] = useState({ name: '', phone: '', gstin: '', state: '' });
  const [billNumber, setBillNumber] = useState('');
  const [date, setDate] = useState(today());
  const [gst, setGst] = useState(true);
  const [lines, setLines] = useState<Line[]>([{ productId: '', qty: '1', rate: '', gst: '' }]);
  const [error, setError] = useState('');

  const update = (index: number, change: Partial<Line>) => setLines(current => current.map((line, i) => i === index ? { ...line, ...change } : line));
  const items = lines.map(line => ({ productId: line.productId, qty: Number(line.qty), rate: Number(line.rate), gst: Number(line.gst) || 0 }));
  const linesValid = items.every(item => item.productId && Number.isInteger(item.qty) && item.qty > 0 && item.rate >= 0 && lines.every(line => line.rate.trim() !== ''));
  const supplierValid = supplierId === NEW ? supplier.name.trim().length > 0 : Boolean(supplierId);
  const total = purchaseTotals({ id: '', supplierId: '', billNumber: '', date, gst, items: items.filter(item => item.productId) });

  const save = async () => {
    setError('');
    if (!profile) return;
    try {
      let chosen = supplierId;
      if (supplierId === NEW) {
        const next: Supplier = { id: newId('SUP'), name: supplier.name.trim(), phone: supplier.phone.trim(), gstin: supplier.gstin.trim().toUpperCase(), state: supplier.state || stateFromGstin(supplier.gstin), address: '' };
        await saveWorkspaceRecords(supabase, profile, 'suppliers', [next]);
        chosen = next.id;
      }
      const bill: PurchaseBill = { id: newId('PB'), supplierId: chosen, billNumber: billNumber.trim(), date, gst, items };
      await createPurchaseBill(supabase, bill);
      await reload();
      router.back();
    } catch (saveError) {
      setError(errorMessage(saveError, t('Save failed. Try again.')));
    }
  };

  return (
    <Screen>
      {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Select label={t('Supplier *')} value={supplierId} placeholder={t('Choose supplier')}
        options={[...data.suppliers.map(item => ({ value: item.id, label: item.name })), { value: NEW, label: t('+ New supplier') }]} onChange={setSupplierId} />
      {supplierId === NEW ? (
        <Card>
          <CardTitle title={t('New supplier')} />
          <Field label={t('Supplier name *')} value={supplier.name} onChangeText={name => setSupplier(current => ({ ...current, name }))} maxLength={160} />
          <Field label={t('Phone')} value={supplier.phone} onChangeText={phone => setSupplier(current => ({ ...current, phone }))} keyboardType="phone-pad" />
          <Field label={t('Supplier GSTIN')} value={supplier.gstin} onChangeText={gstin => setSupplier(current => ({ ...current, gstin }))} autoCapitalize="characters" maxLength={15} />
          <StateSelect label={t('State')} value={supplier.state} onChange={state => setSupplier(current => ({ ...current, state }))} />
        </Card>
      ) : null}
      <View style={local.row}>
        <View style={ui.flex}><Field label={t('Supplier bill number')} value={billNumber} onChangeText={setBillNumber} maxLength={40} /></View>
        <View style={ui.flex}><DateField label={t('Bill date')} value={date} onChange={setDate} maximumDate={new Date()} /></View>
      </View>

      {lines.map((line, index) => (
        <Card key={index}>
          <View style={local.row}>
            <Text style={[ui.label, ui.flex]}>{t('Item {number}', { number: index + 1 })}</Text>
            {lines.length > 1 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('Remove item {number}', { number: index + 1 })} hitSlop={10} onPress={() => setLines(current => current.filter((_, i) => i !== index))}>
                <Ionicons name="trash-outline" size={20} color={colors.red} />
              </Pressable>
            ) : null}
          </View>
          <Select label={t('Product')} value={line.productId} placeholder={t('Choose product')}
            options={data.products.map(item => ({ value: item.id, label: `${item.name} · ${t('{count} in stock', { count: item.stock ?? 0 })}` }))}
            onChange={productId => update(index, { productId, gst: String(product(productId)?.gst ?? 18), rate: line.rate || String(product(productId)?.shop ?? '') })} />
          <View style={local.row}>
            <View style={ui.flex}><Field label={t('Qty')} value={line.qty} onChangeText={qty => update(index, { qty })} keyboardType="number-pad" /></View>
            <View style={ui.flex}><Field label={t('Rate ₹ (before GST)')} value={line.rate} onChangeText={rate => update(index, { rate })} keyboardType="decimal-pad" /></View>
            <View style={{ width: 80 }}><Field label={t('GST %')} value={line.gst} onChangeText={value => update(index, { gst: value })} keyboardType="decimal-pad" /></View>
          </View>
        </Card>
      ))}
      <Button label={t('Add another item')} variant="secondary" onPress={() => setLines(current => [...current, { productId: '', qty: '1', rate: '', gst: '' }])} />

      <Card>
        <View style={local.row}>
          <View style={ui.flex}><CardTitle title={t('GST on this bill')} note={t('Turn off if the supplier did not charge GST.')} /></View>
          <Switch value={gst} onValueChange={setGst} trackColor={{ true: colors.teal, false: colors.line }} accessibilityLabel={t('GST on this bill')} />
        </View>
        <Total label={t('Taxable value')} value={money(total.taxable)} />
        <Total label={t('GST paid')} value={money(total.tax)} />
        <Total label={t('Total')} value={money(total.total)} strong />
      </Card>
      <Button label={t('Save and add to stock')} onPress={save} disabled={Boolean(readOnly) || !supplierValid || !linesValid} />
    </Screen>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={local.row}>
      <Text style={[strong ? local.strong : ui.hint, ui.flex]}>{label}</Text>
      <Text style={[local.money, strong && local.strong]}>{value}</Text>
    </View>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  money: { fontSize: 15, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  strong: { fontSize: 17, fontWeight: '800', color: colors.ink }
});
