import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { DateField } from '@/components/DateField';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { Button, Card, CardTitle, colors, Field, Notice, Screen, Select, styles as ui } from '@/components/ui';
import { errorMessage, money, today } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { createSalesDocument, taxBreakup } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { SalesDocument } from '@/lib/types';

type Line = { productId: string; qty: string; price: string; discount: string };
const types = [msg('Quotation'), msg('Invoice')] as const;

function plusDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return today(value);
}

export default function NewDocument() {
  const { data, organization, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const product = (id: string) => data.products.find(item => item.id === id);
  const newLine = (productId = data.products[0]?.id || ''): Line => ({ productId, qty: '1', price: String(product(productId)?.customer ?? 0), discount: '0' });
  const [type, setType] = useState<SalesDocument['type']>('Quotation');
  const [customerId, setCustomerId] = useState(data.customers[0]?.id || '');
  const [date, setDate] = useState(today());
  const [due, setDue] = useState(plusDays(today(), 14));
  // Only a GST-registered business may charge GST.
  const [gst, setGst] = useState(Boolean(organization?.gstin));
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [error, setError] = useState('');

  const update = (index: number, change: Partial<Line>) => setLines(current => current.map((line, i) => i === index ? { ...line, ...change } : line));
  const parsed = lines.map(line => ({ productId: line.productId, qty: Number(line.qty), price: Number(line.price), discount: Number(line.discount) || 0, gst: product(line.productId)?.gst ?? 0 }));
  const lineError = parsed.some(line => !line.productId || !(line.qty >= 1) || !(line.price >= 0))
    ? t('Check item quantities and prices.')
    : type === 'Invoice' && parsed.some(line => !Number.isInteger(line.qty)) ? t('Invoice quantities must be whole units.')
      : parsed.some(line => line.discount < 0 || line.discount > line.qty * line.price) ? t('A discount cannot be more than the line amount.') : '';
  const bill = taxBreakup(parsed, { gstEnabled: gst });

  const save = async () => {
    setError('');
    try {
      const id = await createSalesDocument(supabase, { type, customerId, date, due, gst, items: parsed });
      await reload();
      router.replace({ pathname: '/sales/[id]', params: { id } });
    } catch (saveError) {
      setError(errorMessage(saveError, t('Save failed. Try again.')));
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: type === 'Quotation' ? t('New quotation') : t('New invoice') }} />
      {readOnly ? <Notice tone="warning">{readOnly}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Chips label={t('Document type')} options={types} value={type} onChange={setType} />
      <Select label={t('Customer *')} value={customerId} options={data.customers.map(item => ({ value: item.id, label: `${item.name} · ${item.phone}` }))} onChange={setCustomerId} />
      <DateField label={t('Document date')} value={date} onChange={setDate} />
      <DateField label={type === 'Quotation' ? t('Valid until') : t('Due date')} value={due} onChange={setDue} optional />

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
          <Select label={t('Product')} value={line.productId} options={data.products.map(item => ({ value: item.id, label: `${item.name} · ${money(item.customer ?? 0)}` }))} onChange={productId => update(index, { productId, price: String(product(productId)?.customer ?? 0) })} />
          <View style={local.row}>
            <View style={ui.flex}><Field label={t('Qty')} value={line.qty} onChangeText={qty => update(index, { qty })} keyboardType="number-pad" /></View>
            <View style={ui.flex}><Field label={t('Unit price ₹')} value={line.price} onChangeText={price => update(index, { price })} keyboardType="decimal-pad" /></View>
            <View style={ui.flex}><Field label={t('Discount ₹')} value={line.discount} onChangeText={discount => update(index, { discount })} keyboardType="decimal-pad" /></View>
          </View>
        </Card>
      ))}
      <Button label={t('Add another item')} variant="secondary" onPress={() => setLines(current => [...current, newLine()])} />

      <Card>
        <View style={local.row}>
          <View style={ui.flex}>
            <CardTitle title={t('Apply GST')} note={organization?.gstin ? t('At each product’s rate.') : t('Add your GSTIN on the website (Accounts → Business details) to charge GST.')} />
          </View>
          <Switch value={gst} onValueChange={setGst} disabled={!organization?.gstin} trackColor={{ true: colors.teal, false: colors.line }} accessibilityLabel={t('Apply GST')} />
        </View>
        {bill.discount ? <Total label={t('Discount')} value={`−${money(bill.discount)}`} /> : null}
        <Total label={t('Taxable value')} value={money(bill.taxable)} />
        <Total label={gst ? t('GST (product rates)') : t('GST (not applied)')} value={money(bill.total - bill.taxable)} />
        <Total label={t('Total')} value={money(bill.total)} strong />
      </Card>
      {lineError ? <Notice tone="warning">{lineError}</Notice> : null}
      <Button label={type === 'Quotation' ? t('Save quotation') : t('Save invoice')} onPress={save} disabled={Boolean(readOnly) || Boolean(lineError) || !customerId || !date} />
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
