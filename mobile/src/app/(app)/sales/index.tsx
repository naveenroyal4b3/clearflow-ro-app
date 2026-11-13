import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { PlanNotice, useReadOnlyReason } from '@/components/PlanNotice';
import { Badge, Button, colors, Empty, styles as ui } from '@/components/ui';
import { detailsFor, statusTone } from '@/lib/documents';
import { errorMessage, formatDate, money, today, totals } from '@/lib/format';
import { sharePdf } from '@/lib/pdf';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { invoiceRegisterHtml, invoiceRegisterRows } from '@/lib/shared';

const tabs = [msg('All'), msg('Quotations'), msg('Invoices')] as const;

export default function Sales() {
  const { data, profile, organization, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const owner = profile?.role === 'owner';
  const [tab, setTab] = useState<(typeof tabs)[number]>('All');
  const [refreshing, setRefreshing] = useState(false);
  const docs = [...data.documents]
    .filter(doc => tab === 'All' || (tab === 'Quotations' ? doc.type === 'Quotation' : doc.type === 'Invoice'))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const customerName = (id: string) => data.customers.find(item => item.id === id)?.name || t('Customer');

  const add = () => {
    if (readOnly) { Alert.alert(t('Can’t create documents'), readOnly); return; }
    if (!data.customers.length || !data.products.length) { Alert.alert(t('Add a customer and a product first'), t('A quotation or invoice needs a customer and at least one product.')); return; }
    router.push('/sales/new');
  };

  // A PDF register of every invoice for the accountant.
  const exportInvoices = async () => {
    const rows = invoiceRegisterRows(data.documents, doc => detailsFor(doc, data, organization));
    if (!rows.length) { Alert.alert(t('No invoices yet'), t('There are no invoices to export yet.')); return; }
    const title = `${organization?.name || 'Clearflow'} invoices ${today()}`;
    try { await sharePdf(invoiceRegisterHtml(title, rows), title); } catch (error) { Alert.alert(t('Export failed'), errorMessage(error, t('Try again.'))); }
  };

  return (
    <View style={ui.screen}>
      {owner ? (
        <Stack.Screen options={{ headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel={t('New quotation or invoice')} onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
            <Ionicons name="add-circle" size={28} color={colors.teal} />
          </Pressable>
        ) }} />
      ) : null}
      <FlatList
        data={docs}
        keyExtractor={item => item.id}
        contentContainerStyle={ui.padded}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} colors={[colors.teal]} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <PlanNotice />
            <Chips label={t('Document type')} options={tabs} value={tab} onChange={setTab} />
          </View>
        }
        ListEmptyComponent={<Empty text={owner ? t('No documents yet. Tap + to create a quotation or invoice.') : t('No documents yet.')} />}
        ListFooterComponent={owner && data.documents.some(doc => doc.type === 'Invoice') ? <View style={{ marginTop: 14 }}><Button label={t('Export invoice register (PDF)')} variant="secondary" onPress={exportInvoices} /></View> : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable style={local.card} onPress={() => router.push({ pathname: '/sales/[id]', params: { id: item.id } })} accessibilityHint={t('Opens the document')}>
            <View style={ui.flex}>
              <Text style={local.title}>{customerName(item.customerId)}</Text>
              <Text style={local.note}>{`${t(item.type)} · ${item.id}`}</Text>
              <Text style={local.note}>{`${formatDate(item.date)} · ${item.gst ? 'GST' : t('No GST')}`}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 8 }}>
              <Text style={local.amount}>{money(totals(item).grand)}</Text>
              <Badge label={t(item.status)} tone={statusTone(item.status)} />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const local = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }
});
