import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, CardTitle, colors, Empty, Heading, styles as ui } from '@/components/ui';
import { PlanNotice } from '@/components/PlanNotice';
import { money, shortDate, today, totals } from '@/lib/format';
import { useSession } from '@/lib/session';

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function Overview() {
  const { profile, data, reload } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const owner = profile?.role === 'owner';
  const canViewStock = owner || profile?.role === 'technician';
  const now = new Date();
  const invoices = data.documents.filter(doc => doc.type === 'Invoice' && doc.status !== 'Cancelled');
  const monthTotal = invoices.filter(doc => doc.date.startsWith(monthKey(now))).reduce((sum, doc) => sum + totals(doc).grand, 0);
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = monthKey(date);
    return { label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date), total: invoices.filter(doc => doc.date.startsWith(key)).reduce((sum, doc) => sum + totals(doc).grand, 0) };
  });
  const chartMax = Math.max(1, ...months.map(item => item.total));
  const openJobs = data.jobs.filter(job => job.status !== 'Completed' && job.status !== 'Cancelled');
  const upcoming = [...openJobs].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const customerName = (id: string) => data.customers.find(item => item.id === id)?.name || 'Customer';
  const firstName = profile?.full_name?.split(/\s+/)[0] || 'there';
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const refresh = async () => { setRefreshing(true); await reload(); setRefreshing(false); };

  return (
    <SafeAreaView style={ui.screen} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={ui.padded} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.teal]} />}>
        <PlanNotice />
        <Heading eyebrow={new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)} title={`${greeting}, ${firstName}`} subtitle="Here’s what’s happening across your water business today." />

        <View style={local.metrics}>
          <Metric label={`${new Intl.DateTimeFormat('en', { month: 'long' }).format(now)} sales`} value={money(monthTotal)} />
          <Metric label="Customers" value={String(data.customers.length)} />
          <Metric label="Open service jobs" value={String(openJobs.length)} />
          <Metric label="Products" value={String(data.products.length)} />
        </View>

        {owner && !data.customers.length && !data.products.length ? (
          <Card style={{ backgroundColor: colors.tealPale }}>
            <CardTitle title="Set up your RO workspace" note="Add your first customer to start managing service and sales." />
            <Button label="Add customer" onPress={() => router.push('/customers/edit')} />
          </Card>
        ) : null}

        {owner ? (
          <Card>
            <CardTitle title="Sales overview" note="Invoice value · last 6 months" />
            <View style={local.chart} accessibilityLabel={months.map(item => `${item.label} ${money(item.total)}`).join(', ')}>
              {months.map((item, index) => (
                <View key={item.label} style={local.barGroup}>
                  <View style={[local.bar, { height: `${Math.max(3, Math.round(item.total / chartMax * 100))}%` }, index === months.length - 1 && local.barCurrent]} />
                  <Text style={local.barLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card>
          <CardTitle title="Upcoming service" note="Next scheduled visits" />
          {upcoming.length ? upcoming.map(job => (
            <View key={job.id} style={local.listRow}>
              <View style={ui.flex}>
                <Text style={local.rowTitle}>{customerName(job.customerId)}</Text>
                <Text style={local.rowNote}>{`${job.type} · ${job.date < today() ? 'overdue · ' : ''}${shortDate(job.date)} · ${job.technician || 'Unassigned'}`}</Text>
              </View>
              <Badge label={job.status} tone={job.status === 'In progress' ? 'good' : 'warning'} />
            </View>
          )) : <Empty text="No upcoming service jobs." />}
        </Card>

        {canViewStock ? (
          <Card>
            <CardTitle title="Stock watch" note="Current availability" />
            {data.products.length ? data.products.slice(0, 5).map(item => (
              <View key={item.id} style={local.listRow}>
                <View style={ui.flex}>
                  <Text style={local.rowTitle}>{item.name}</Text>
                  <Text style={local.rowNote}>{`${item.category} · ${item.stock ?? 0} in stock`}</Text>
                </View>
                <Badge label={(item.stock ?? 0) < 5 ? 'Low stock' : 'In stock'} tone={(item.stock ?? 0) < 5 ? 'warning' : 'good'} />
              </View>
            )) : <Empty text="Add products to start tracking stock." />}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={local.metric}>
      <Text style={local.metricLabel}>{label}</Text>
      <Text style={local.metricValue}>{value}</Text>
    </View>
  );
}

const local = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 },
  metricLabel: { fontSize: 12, color: colors.muted },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.ink },
  chart: { height: 140, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  barGroup: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  bar: { width: '70%', borderRadius: 6, backgroundColor: colors.tealPale },
  barCurrent: { backgroundColor: colors.teal },
  barLabel: { fontSize: 11, color: colors.muted },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  rowNote: { fontSize: 12, color: colors.muted, marginTop: 2 }
});
