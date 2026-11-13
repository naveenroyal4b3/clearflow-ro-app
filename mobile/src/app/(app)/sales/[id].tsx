import { Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { Badge, Button, Card, CardTitle, colors, Divider, Empty, Notice, Screen, styles as ui } from '@/components/ui';
import { detailsFor, documentStatuses, htmlFor, statusTone } from '@/lib/documents';
import { errorMessage, formatDate, rupees } from '@/lib/format';
import { t } from '@/lib/i18n';
import { printDocument, sharePdf } from '@/lib/pdf';
import { useSession } from '@/lib/session';
import { amountInWords, setSalesDocumentStatus, stateLabel } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

export default function DocumentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, profile, organization, setData, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const doc = data.documents.find(item => item.id === id);
  if (!doc) return <Screen><Empty text={t('This document is no longer available.')} /></Screen>;
  const owner = profile?.role === 'owner';
  const { seller, buyer, tax } = detailsFor(doc, data, organization);
  const html = () => htmlFor(doc, data, organization);

  const setStatus = (next: string) => {
    if (next === doc.status) return;
    if (readOnly) { Alert.alert(t('Can’t change the status'), readOnly); return; }
    const apply = async () => {
      try {
        await setSalesDocumentStatus(supabase, doc.id, next);
        // Cancelling an invoice returns its items to stock, so reload the workspace.
        if (doc.type === 'Invoice' && next === 'Cancelled') await reload();
        else setData(current => ({ ...current, documents: current.documents.map(item => item.id === doc.id ? { ...item, status: next } : item) }));
      } catch (error) {
        Alert.alert(t('Status not changed'), errorMessage(error, t('Try again.')));
      }
    };
    if (next === 'Cancelled') {
      Alert.alert(t('Cancel {id}?', { id: doc.id }), doc.type === 'Invoice' ? t('Its items go back into stock. This cannot be undone.') : t('This cannot be undone.'), [
        { text: t('Keep it'), style: 'cancel' },
        { text: t('Cancel document'), style: 'destructive', onPress: apply }
      ]);
    } else {
      apply();
    }
  };

  const share = async () => { try { await sharePdf(html(), doc.id); } catch (error) { Alert.alert(t('Could not share'), errorMessage(error, t('Try again.'))); } };
  const print = async () => { try { await printDocument(html()); } catch (error) { Alert.alert(t('Could not print'), errorMessage(error, t('Try again.'))); } };

  return (
    <Screen>
      <Stack.Screen options={{ title: doc.id }} />
      <Card>
        <View style={local.row}>
          <View style={ui.flex}>
            <Text style={local.kind}>{doc.type === 'Quotation' ? t('Quotation') : doc.gst && seller.gstin ? t('Tax invoice') : t('Invoice')}</Text>
            <Text style={local.total}>{rupees(tax.total)}</Text>
          </View>
          <Badge label={t(doc.status)} tone={statusTone(doc.status)} />
        </View>
        <Text style={ui.hint}>{doc.type === 'Quotation' ? t('{date} · Valid until {due}', { date: formatDate(doc.date), due: formatDate(doc.due) }) : t('{date} · Due {due}', { date: formatDate(doc.date), due: formatDate(doc.due) })}</Text>
        <Text style={ui.hint}>{`${t('For {name}', { name: buyer.name })}${buyer.gstin ? ` · GSTIN ${buyer.gstin}` : ''}`}</Text>
        {doc.gst ? <Text style={ui.hint}>{t('Place of supply: {state}', { state: stateLabel(tax.placeOfSupply) || t('Not specified') })}</Text> : <Text style={ui.hint}>{t('GST not applied.')}</Text>}
      </Card>

      <View style={{ gap: 10 }}>
        <Button label={t('Share PDF')} onPress={share} />
        <Button label={t('Print or save as PDF')} variant="secondary" onPress={print} />
      </View>

      {owner && doc.status !== 'Cancelled' ? (
        <Card>
          <CardTitle title={t('Status')} note={doc.type === 'Invoice' ? t('Mark paid when the customer pays.') : t('Mark sent once you share it.')} />
          <Chips label={t('Status')} options={documentStatuses[doc.type]} value={doc.status} onChange={setStatus} />
        </Card>
      ) : null}

      <Card>
        <CardTitle title={t('Items')} />
        {tax.rows.map((row, index) => (
          <View key={`${row.productId}-${index}`} style={{ gap: 2 }}>
            <View style={local.row}>
              <Text style={[local.item, ui.flex]}>{row.name}</Text>
              <Text style={local.money}>{rupees(row.total)}</Text>
            </View>
            <Text style={ui.hint}>{`${row.qty} ${row.unit || 'Nos'} × ${rupees(row.price)}${row.discount ? ` − ${rupees(row.discount)}` : ''}${doc.gst ? ` · GST ${row.rate}%` : ''}${row.hsn ? ` · HSN ${row.hsn}` : ''}`}</Text>
          </View>
        ))}
        <Divider />
        {tax.discount ? <Line label={t('Discount')} value={rupees(tax.discount)} /> : null}
        <Line label={t('Taxable value')} value={rupees(tax.taxable)} />
        {doc.gst ? (tax.interState ? <Line label="IGST" value={rupees(tax.igst)} /> : <><Line label="CGST" value={rupees(tax.cgst)} /><Line label="SGST" value={rupees(tax.sgst)} /></>) : null}
        <Line label={t('Total')} value={rupees(tax.total)} strong />
        <Text style={ui.hint}>{t('Amount in words: {amount}', { amount: amountInWords(tax.total) })}</Text>
      </Card>
      {doc.status === 'Cancelled' ? <Notice tone="warning">{t('This document is cancelled. Its number is kept, as GST rules require.')}</Notice> : null}
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={local.row}>
      <Text style={[strong ? local.item : ui.hint, ui.flex]}>{label}</Text>
      <Text style={[local.money, strong && { fontSize: 17 }]}>{value}</Text>
    </View>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kind: { fontSize: 13, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  total: { fontSize: 28, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  item: { fontSize: 15, fontWeight: '700', color: colors.ink },
  money: { fontSize: 15, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] }
});
