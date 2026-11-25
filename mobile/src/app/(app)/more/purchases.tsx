import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { headerWithFeedback } from '@/components/FeedbackButton';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { colors, Empty, styles as ui } from '@/components/ui';
import { errorMessage, formatDate, money } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { deletePurchaseBill, purchaseTotals } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import type { PurchaseBill } from '@/lib/types';

// Bills from suppliers, newest first. Each one added stock; deleting it takes the stock off again.
export default function Purchases() {
  const { data, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const supplier = (id: string) => data.suppliers.find(item => item.id === id);
  const product = (id: string) => data.products.find(item => item.id === id);

  const add = () => {
    if (readOnly) { Alert.alert(t('Not available'), readOnly); return; }
    if (!data.products.length) { Alert.alert(t('Add a product first'), t('A purchase bill adds stock to your products.')); return; }
    router.push('/more/purchase-new');
  };

  const remove = (bill: PurchaseBill) => Alert.alert(t('Delete this purchase bill?'), t('Its quantities are taken off your stock again.'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Delete'), style: 'destructive', onPress: async () => {
      try { await deletePurchaseBill(supabase, bill.id); await reload(); }
      catch (deleteError) { Alert.alert(t('Not deleted'), errorMessage(deleteError, t('Try again.'))); }
    } }
  ]);

  return (
    <View style={ui.screen}>
      <Stack.Screen options={{ headerRight: headerWithFeedback(
        <Pressable accessibilityRole="button" accessibilityLabel={t('New purchase bill')} onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="add-circle" size={28} color={colors.teal} />
        </Pressable>
      ) }} />
      <FlatList
        data={data.purchases}
        keyExtractor={item => item.id}
        contentContainerStyle={ui.padded}
        ListHeaderComponent={<Text style={local.note}>{t('Saving a purchase bill adds its quantities to stock. GST paid on purchases shows in the Business report.')}</Text>}
        ListEmptyComponent={<Empty text={t('No purchase bills yet. Tap + to add one.')} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const total = purchaseTotals(item);
          return (
            <Pressable style={local.card} onLongPress={() => remove(item)} accessibilityHint={t('Long-press to delete')}>
              <View style={local.top}>
                <View style={ui.flex}>
                  <Text style={local.title}>{supplier(item.supplierId)?.name || t('Supplier')}</Text>
                  <Text style={local.note}>{`${item.billNumber ? `${t('Bill')} ${item.billNumber} · ` : ''}${formatDate(item.date)}`}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={local.amount}>{money(total.total)}</Text>
                  {total.tax ? <Text style={local.note}>{t('GST {amount}', { amount: money(total.tax) })}</Text> : null}
                </View>
              </View>
              <Text style={local.note} numberOfLines={2}>{item.items.map(line => `${product(line.productId)?.name || t('Removed product')} × ${line.qty}`).join(', ')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Delete this purchase bill?')} hitSlop={8} onPress={() => remove(item)} style={local.delete}>
                <Ionicons name="trash-outline" size={16} color={colors.red} />
                <Text style={local.deleteText}>{t('Delete')}</Text>
              </Pressable>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const local = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  deleteText: { fontSize: 12, fontWeight: '700', color: colors.red }
});
