import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { PlanNotice, useReadOnlyReason } from '@/components/PlanNotice';
import { Badge, colors, Empty, styles as ui } from '@/components/ui';
import { formatDate, today } from '@/lib/format';
import { useSession } from '@/lib/session';

const statuses = ['Open', 'All', 'Scheduled', 'In progress', 'Completed', 'Cancelled'] as const;

function jobTone(status: string) {
  return status === 'Completed' ? 'good' : status === 'Cancelled' ? 'neutral' : status === 'In progress' ? 'good' : 'warning';
}

export default function Jobs() {
  const { data, profile, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const owner = profile?.role === 'owner';
  const technician = profile?.role === 'technician';
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<(typeof statuses)[number]>('Open');
  const [refreshing, setRefreshing] = useState(false);
  const customer = (id: string) => data.customers.find(item => item.id === id);

  const jobs = useMemo(() => data.jobs
    .filter(job => status === 'All' || (status === 'Open' ? job.status !== 'Completed' && job.status !== 'Cancelled' : job.status === status))
    .filter(job => `${job.id} ${job.type} ${job.technician} ${customer(job.customerId)?.name || ''}`.toLowerCase().includes(query.trim().toLowerCase()))
    // Open jobs soonest first; finished jobs most recent first.
    .sort((a, b) => status === 'Open' || status === 'Scheduled' || status === 'In progress' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [data.jobs, data.customers, query, status]);

  const add = () => {
    if (readOnly) { Alert.alert('Can’t schedule a job', readOnly); return; }
    if (!data.customers.length) { Alert.alert('Add a customer first', 'Add a customer before scheduling a service job.'); return; }
    router.push('/jobs/edit');
  };

  return (
    <View style={ui.screen}>
      {owner ? (
        <Stack.Screen options={{ headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Schedule service" onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
            <Ionicons name="add-circle" size={28} color={colors.teal} />
          </Pressable>
        ) }} />
      ) : null}
      <FlatList
        data={jobs}
        keyExtractor={item => item.id}
        contentContainerStyle={ui.padded}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} colors={[colors.teal]} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <PlanNotice />
            <TextInput style={ui.input} placeholder="Search customer, job or technician…" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} accessibilityLabel="Search jobs" />
            <Chips label="Filter by status" options={statuses} value={status} onChange={setStatus} />
          </View>
        }
        ListEmptyComponent={<Empty text={data.jobs.length ? 'No matching service jobs.' : owner ? 'No service jobs yet. Tap + to schedule one.' : 'No service jobs yet.'} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => {
          const person = customer(item.customerId);
          const overdue = item.date < today() && item.status !== 'Completed' && item.status !== 'Cancelled';
          return (
            <Pressable
              style={local.card}
              disabled={!owner && !technician}
              onPress={() => router.push({ pathname: '/jobs/edit', params: { id: item.id } })}
              accessibilityHint={owner || technician ? 'Opens the job to update it' : undefined}
            >
              <View style={ui.flex}>
                <Text style={local.title}>{person?.name || 'Customer'}</Text>
                <Text style={local.note}>{`${item.type} · ${item.id}`}</Text>
                <Text style={[local.note, overdue && { color: colors.red, fontWeight: '700' }]}>{`${overdue ? 'Overdue · ' : ''}${formatDate(item.date)} · ${item.technician || 'Unassigned'}`}</Text>
                {item.notes ? <Text style={local.note} numberOfLines={2}>{item.notes}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 8 }}>
                <Badge label={item.status} tone={jobTone(item.status)} />
                {person?.phone && (owner || technician) ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Call ${person.name}`} hitSlop={10} onPress={() => Linking.openURL(`tel:${person.phone.replace(/\s/g, '')}`)} style={local.call}>
                    <Ionicons name="call" size={16} color={colors.teal} />
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const local = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  call: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }
});
