import { useCallback, useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Badge, Button, colors, Empty, Notice, styles as ui } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { usePlatformAdmin } from '@/lib/productImages';
import { loadBusinesses, type Business } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

const day = 24 * 60 * 60 * 1000;
const filters = ['All', 'Active', 'Stuck', 'At risk', 'Trial', 'Paid', 'Ended'] as const;
type Filter = (typeof filters)[number];

const ago = (value: string | null, now: number) => {
  if (!value) return 'never';
  const days = Math.floor((now - new Date(value).getTime()) / day);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};
const shortDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

function plan(item: Business, now: number) {
  if (item.paid_until && new Date(item.paid_until).getTime() > now) return { label: `Paid · ${item.plan_interval || ''}`.trim(), tone: 'good' as const, kind: 'Paid' };
  if (new Date(item.trial_ends_at).getTime() > now) return { label: `Trial · ends ${shortDate(item.trial_ends_at)}`, tone: 'warning' as const, kind: 'Trial' };
  return { label: 'Ended', tone: 'bad' as const, kind: 'Ended' };
}
const activeWithin = (item: Business, days: number, now: number) => Boolean(item.last_activity && now - new Date(item.last_activity).getTime() < days * day);
// Signed up but nothing added yet.
const stuck = (item: Business) => item.customers + item.products === 0;
// On trial and quiet for 3 days or more.
const atRisk = (item: Business, now: number) => plan(item, now).kind === 'Trial' && !activeWithin(item, 3, now);

function matches(item: Business, filter: Filter, now: number) {
  if (filter === 'All') return true;
  if (filter === 'Active') return activeWithin(item, 7, now);
  if (filter === 'Stuck') return stuck(item);
  if (filter === 'At risk') return atRisk(item, now);
  return plan(item, now).kind === filter;
}

const whatsapp = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`;

// Every business on TiruFix with its plan and how much it uses the app. For platform admins only
// (the app's operator), so it is not translated. Pull down to refresh.
export default function Businesses() {
  const admin = usePlatformAdmin();
  // The list and the time it was loaded (ages and plans are worked out from that time).
  const [{ rows, now }, setList] = useState<{ rows: Business[]; now: number }>({ rows: [], now: 0 });
  const [filter, setFilter] = useState<Filter>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { const list = await loadBusinesses(supabase); setList({ rows: list, now: Date.now() }); }
    catch (loadError) { setError(errorMessage(loadError, 'Could not load businesses.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!admin) return;
    let live = true;
    loadBusinesses(supabase)
      .then(list => { if (live) setList({ rows: list, now: Date.now() }); })
      .catch(loadError => { if (live) setError(errorMessage(loadError, 'Could not load businesses.')); });
    return () => { live = false; };
  }, [admin]);

  if (admin === null) return null;
  if (!admin) return <View style={ui.padded}><Notice tone="warning">Only the TiruFix team can see businesses.</Notice></View>;

  const week = rows.filter(item => now - new Date(item.signed_up).getTime() < 7 * day).length;
  const active = rows.filter(item => activeWithin(item, 7, now)).length;
  const paid = rows.filter(item => plan(item, now).kind === 'Paid').length;
  const everPaid = rows.filter(item => item.paid_until).length;
  const trialsOver = rows.filter(item => new Date(item.trial_ends_at).getTime() < now).length;
  const shown = rows.filter(item => matches(item, filter, now));

  return (
    <FlatList
      data={shown}
      keyExtractor={item => item.id}
      contentContainerStyle={ui.padded}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.teal]} />}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <View style={local.metrics}>
            <Metric label="Businesses" value={rows.length} note={`${week} new this week`} />
            <Metric label="Active (7 days)" value={active} note={rows.length ? `${Math.round(active / rows.length * 100)}% of all` : ''} />
            <Metric label="Paying now" value={paid} note={trialsOver ? `${Math.round(everPaid / trialsOver * 100)}% of ended trials paid` : 'No trials ended yet'} />
            <Metric label="Stuck" value={rows.filter(stuck).length} note="No customers or products" />
          </View>
          <Chips label="Filter" options={filters} value={filter} onChange={setFilter} format={value => `${value} (${rows.filter(item => matches(item, value, now)).length})`} />
          <Text style={local.note}>Newest first. Active = changed something in 7 days. At risk = on trial, quiet for 3+ days. Pull down to refresh.</Text>
        </View>
      }
      ListEmptyComponent={loading ? undefined : <Empty text="No businesses here." />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => {
        const status = plan(item, now);
        return (
          <View style={local.card}>
            <View style={local.top}>
              <View style={ui.flex}>
                <Text style={local.title}>{item.name}</Text>
                <Text style={local.note} selectable>{[item.owner_name, item.owner_email, item.phone].filter(Boolean).join(' · ')}</Text>
              </View>
              <Badge label={status.label} tone={status.tone} />
            </View>
            <View style={local.stats}>
              <Stat label="Customers" value={item.customers} />
              <Stat label="Products" value={item.products} />
              <Stat label="Jobs" value={item.jobs} />
              <Stat label="Invoices" value={item.invoices} />
              <Stat label="Team" value={item.team} />
            </View>
            <Text style={local.note}>{`Signed up ${shortDate(item.signed_up)} · last active ${ago(item.last_activity, now)} · last sign-in ${ago(item.last_sign_in, now)} · ${item.invoices_30d} invoices in 30 days`}</Text>
            {stuck(item) || atRisk(item, now) ? <Text style={local.flag}>{stuck(item) ? 'Stuck: has not added anything yet' : 'At risk: trial is quiet'}</Text> : null}
            <View style={local.actions}>
              {item.phone ? <View style={ui.flex}><Button label="WhatsApp" variant="secondary" onPress={() => Linking.openURL(whatsapp(item.phone))} /></View> : null}
              {item.phone ? <View style={ui.flex}><Button label="Call" variant="secondary" onPress={() => Linking.openURL(`tel:${item.phone.replace(/\s/g, '')}`)} /></View> : null}
              {item.owner_email ? <View style={ui.flex}><Button label="Email" variant="secondary" onPress={() => Linking.openURL(`mailto:${item.owner_email}`)} /></View> : null}
            </View>
          </View>
        );
      }}
    />
  );
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <View style={local.metric}>
      <Text style={local.note}>{label}</Text>
      <Text style={local.metricValue}>{value}</Text>
      {note ? <Text style={local.note}>{note}</Text> : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Pressable style={local.stat} disabled>
      <Text style={[local.statValue, !value && { color: colors.muted }]}>{value}</Text>
      <Text style={local.statLabel}>{label}</Text>
    </Pressable>
  );
}

const local = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 2 },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted },
  flag: { fontSize: 12, fontWeight: '700', color: colors.orange },
  stats: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 8 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 11, color: colors.muted },
  actions: { flexDirection: 'row', gap: 8 }
});
