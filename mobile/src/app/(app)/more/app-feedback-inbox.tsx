import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, colors, Empty, Notice, styles as ui } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { usePlatformAdmin } from '@/lib/productImages';
import { loadAppFeedback, removeAppFeedback, type AppFeedback } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

const when = (value: string) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

// Suggestions and problems that every business sent to Clearflow, newest first. For platform
// admins only (the app's operator), so it is not translated. Pull down to refresh.
export default function AppFeedbackInbox() {
  const admin = usePlatformAdmin();
  const [rows, setRows] = useState<AppFeedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setRows(await loadAppFeedback(supabase)); }
    catch (loadError) { setError(errorMessage(loadError, 'Could not load feedback.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!admin) return;
    let live = true;
    loadAppFeedback(supabase)
      .then(list => { if (live) setRows(list); })
      .catch(loadError => { if (live) setError(errorMessage(loadError, 'Could not load feedback.')); });
    return () => { live = false; };
  }, [admin]);

  const remove = (row: AppFeedback) => Alert.alert('Remove this feedback?', row.message.slice(0, 120), [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      try { await removeAppFeedback(supabase, row.id); setRows(current => current.filter(item => item.id !== row.id)); }
      catch (removeError) { Alert.alert('Not removed', errorMessage(removeError, 'Try again.')); }
    } }
  ]);

  if (admin === null) return null;
  if (!admin) return <View style={ui.padded}><Notice tone="warning">Only the Clearflow team can see app feedback.</Notice></View>;
  return (
    <FlatList
      data={rows}
      keyExtractor={row => row.id}
      contentContainerStyle={ui.padded}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={error ? <Notice tone="error">{error}</Notice> : <Text style={local.note}>{`${rows.length} from every business, newest first. Pull down to refresh.`}</Text>}
      ListEmptyComponent={loading ? undefined : <Empty text="No feedback yet." />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => (
        <View style={local.card}>
          <View style={local.top}>
            <Badge label={item.kind} tone={item.kind === 'Problem' ? 'bad' : 'good'} />
            <Text style={local.note}>{`${when(item.created_at)} · ${item.page || '—'} · ${item.platform} ${item.app_version}`}</Text>
          </View>
          <Text style={local.message} selectable>{item.message}</Text>
          <Text style={local.from}>{item.name || item.email}</Text>
          <Text style={local.note}>{[item.business, item.role, item.phone, item.email].filter(Boolean).join(' · ')}</Text>
          <View style={local.actions}>
            {item.phone ? <View style={ui.flex}><Button label="WhatsApp" variant="secondary" onPress={() => Linking.openURL(`https://wa.me/${item.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`)} /></View> : null}
            <View style={ui.flex}><Button label="Remove" variant="secondary" onPress={() => remove(item)} /></View>
          </View>
        </View>
      )}
    />
  );
}

const local = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  message: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  from: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 4 },
  note: { fontSize: 12, color: colors.muted },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 }
});
