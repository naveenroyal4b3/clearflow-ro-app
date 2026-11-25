import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { headerWithFeedback } from '@/components/FeedbackButton';
import { useReadOnlyReason } from '@/components/PlanNotice';
import { Badge, colors, Empty, styles as ui } from '@/components/ui';
import { formatDate, money, today } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { amcActive, amcRenewals, whatsappLink } from '@/lib/shared';
import type { AmcContract } from '@/lib/types';

const filters = [msg('Running'), msg('Renewal due'), msg('All')] as const;

// The owner's AMC contracts: running ones, those due for renewal, or all.
export default function AmcContracts() {
  const { data, organization } = useSession();
  const readOnly = useReadOnlyReason();
  const [filter, setFilter] = useState<(typeof filters)[number]>('Running');
  const now = today();
  const due = new Set(amcRenewals(data.amc, now).map(entry => entry.contract.id));
  const customer = (id: string) => data.customers.find(item => item.id === id);
  const matches = (item: AmcContract, value: (typeof filters)[number]) => value === 'All' || (value === 'Running' ? amcActive(item, now) : due.has(item.id));
  const shown = data.amc.filter(item => matches(item, filter)).sort((a, b) => a.end.localeCompare(b.end));

  const add = () => {
    if (readOnly) { Alert.alert(t('Not available'), readOnly); return; }
    if (!data.customers.length) { Alert.alert(t('Add a customer first'), t('An AMC contract is for one of your customers.')); return; }
    router.push('/more/amc-edit');
  };

  const status = (item: AmcContract) => item.status === 'Cancelled' ? { label: t('Cancelled'), tone: 'neutral' as const }
    : item.end < now ? { label: t('Ended'), tone: 'bad' as const }
      : due.has(item.id) ? { label: t('Renewal due'), tone: 'warning' as const }
        : item.start > now ? { label: t('Starts {date}', { date: formatDate(item.start) }), tone: 'neutral' as const }
          : { label: t('Running'), tone: 'good' as const };

  return (
    <View style={ui.screen}>
      <Stack.Screen options={{ headerRight: headerWithFeedback(
        <Pressable accessibilityRole="button" accessibilityLabel={t('New AMC contract')} onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="add-circle" size={28} color={colors.teal} />
        </Pressable>
      ) }} />
      <FlatList
        data={shown}
        keyExtractor={item => item.id}
        contentContainerStyle={ui.padded}
        ListHeaderComponent={<Chips label={t('Filter')} options={filters} value={filter} onChange={setFilter} format={value => `${t(value)} (${data.amc.filter(item => matches(item, value)).length})`} />}
        ListEmptyComponent={<Empty text={data.amc.length ? t('No contracts here.') : t('No AMC contracts yet. Tap + to add one.')} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const person = customer(item.customerId);
          const badge = status(item);
          const message = t('Hello {name}, your {appliance} AMC ends on {date}. Renew for {amount} to keep free service visits. – {business}', { name: person?.name || '', appliance: item.appliance || t('appliance'), date: formatDate(item.end), amount: money(item.amount), business: organization?.name || '' });
          const link = person ? whatsappLink(person.phone, message) : '';
          return (
            <Pressable style={local.card} onPress={() => router.push({ pathname: '/more/amc-edit', params: { id: item.id } })}>
              <View style={local.top}>
                <View style={ui.flex}>
                  <Text style={local.title}>{person?.name || t('Customer')}</Text>
                  <Text style={local.note}>{`${item.appliance || t('appliance')} · ${money(item.amount)} · ${formatDate(item.start)} – ${formatDate(item.end)}`}</Text>
                  <Text style={local.note}>{t('{used} of {total} visits used', { used: item.visitsUsed, total: item.visits })}</Text>
                </View>
                <Badge label={badge.label} tone={badge.tone} />
              </View>
              {due.has(item.id) && link ? (
                <Pressable accessibilityRole="button" style={local.remind} onPress={() => Linking.openURL(link)}>
                  <Ionicons name="logo-whatsapp" size={16} color="#1f9d55" />
                  <Text style={local.remindText}>{t('Send renewal reminder')}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const local = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  remind: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  remindText: { fontSize: 13, fontWeight: '700', color: colors.ink }
});
