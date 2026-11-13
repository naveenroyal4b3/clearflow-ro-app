import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, Empty, Notice, styles as ui } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { loadAuditLog } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

// English labels, shown with t().
const tableLabels: Record<string, string> = { customers: msg('Customer'), products: msg('Product'), product_prices: msg('Price'), service_jobs: msg('Service job'), sales_documents: msg('Sales document'), profiles: msg('Team account'), organizations: msg('Business details') };
const actionLabels: Record<string, string> = { insert: msg('added by {person}'), update: msg('changed by {person}'), delete: msg('deleted by {person}') };
type Entry = Awaited<ReturnType<typeof loadAuditLog>>[number];

async function fetchEntries(organizationId: string, offline: boolean): Promise<{ entries: Entry[]; error: string }> {
  if (!organizationId || offline) return { entries: [], error: '' };
  try {
    return { entries: await loadAuditLog(supabase, organizationId), error: '' };
  } catch (loadError) {
    return { entries: [], error: errorMessage(loadError, t('The activity log could not be loaded.')) };
  }
}

function actionText(action: string, person: string) {
  return actionLabels[action] ? t(actionLabels[action], { person }) : t('{action} by {person}', { action, person });
}

// The last 50 changes to business records, for the owner.
export default function Activity() {
  const { profile, data, offlineSince } = useSession();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const names = new Map(data.accounts.map(account => [account.id, account.name || account.username]));

  const organizationId = profile?.organization_id || '';
  const offline = Boolean(offlineSince);

  const load = async () => {
    setLoading(true);
    const result = await fetchEntries(organizationId, offline);
    setEntries(result.entries); setError(result.error); setLoading(false);
  };

  useEffect(() => {
    let active = true;
    fetchEntries(organizationId, offline).then(result => { if (active) { setEntries(result.entries); setError(result.error); setLoading(false); } });
    return () => { active = false; };
  }, [organizationId, offline]);

  return (
    <FlatList
      style={ui.screen}
      data={entries}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={ui.padded}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[colors.teal]} />}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          {offlineSince ? <Notice tone="warning">{t('The activity log needs a connection.')}</Notice> : null}
          {error ? <Notice tone="error">{error}</Notice> : null}
        </View>
      }
      ListEmptyComponent={loading ? undefined : <Empty text={t('No changes recorded yet.')} />}
      renderItem={({ item }) => (
        <View style={local.line}>
          <View style={local.dot} />
          <View style={ui.flex}>
            <Text style={local.text}>
              {`${tableLabels[item.table_name] ? t(tableLabels[item.table_name]) : item.table_name} `}
              <Text style={{ fontWeight: '700' }}>{item.record_id}</Text>
              {` ${actionText(item.action, names.get(item.changed_by || '') || (item.changed_by ? t('a removed account') : t('the system')))}`}
            </Text>
            <Text style={local.time}>{new Date(item.changed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
          </View>
        </View>
      )}
    />
  );
}

const local = StyleSheet.create({
  line: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal, marginTop: 6 },
  text: { fontSize: 14, color: colors.ink, lineHeight: 20 },
  time: { fontSize: 12, color: colors.muted, marginTop: 2 }
});
