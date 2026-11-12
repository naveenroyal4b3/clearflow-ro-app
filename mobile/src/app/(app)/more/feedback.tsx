import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Badge, colors, Empty, styles as ui } from '@/components/ui';
import { errorMessage, formatDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { setFeedbackStatus } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

const statuses = ['New', 'In review', 'In progress', 'Planned', 'Resolved', 'Closed'] as const;

export default function Feedback() {
  const { data, profile, offlineSince, setData } = useSession();
  const owner = profile?.role === 'owner';
  const entries = [...data.feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const changeStatus = async (id: string, status: string) => {
    if (offlineSince) { Alert.alert('Offline', 'Try again once you are back online.'); return; }
    try {
      await setFeedbackStatus(supabase, id, status);
      setData(current => ({ ...current, feedback: current.feedback.map(item => item.id === id ? { ...item, status } : item) }));
    } catch (error) {
      Alert.alert('Status not changed', errorMessage(error, 'Try again.'));
    }
  };

  return (
    <View style={ui.screen}>
      <Stack.Screen options={{ headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Submit feedback" onPress={() => router.push('/more/feedback-new')} hitSlop={12} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="add-circle" size={28} color={colors.teal} />
        </Pressable>
      ) }} />
      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        contentContainerStyle={ui.padded}
        ListEmptyComponent={<Empty text="No feedback yet. Tap + to report a problem or share an idea." />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <View style={local.card}>
            <View style={local.row}>
              <Text style={[local.title, ui.flex]}>{item.title}</Text>
              <Badge label={item.priority} tone={item.priority === 'Urgent' ? 'bad' : item.priority === 'High' ? 'warning' : 'neutral'} />
            </View>
            <Text style={local.note}>{`${item.type} · ${formatDate(item.date)} · ${item.name}${item.phone ? ` · ${item.phone}` : ''}`}</Text>
            <Text style={local.body}>{item.description}</Text>
            {item.reference ? <Text style={local.note}>{`Ref: ${item.reference}`}</Text> : null}
            {owner ? <Chips label={`Status for ${item.title}`} options={statuses} value={item.status as (typeof statuses)[number]} onChange={status => changeStatus(item.id, status)} /> : <Badge label={item.status} tone="good" />}
          </View>
        )}
      />
    </View>
  );
}

const local = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted },
  body: { fontSize: 14, color: colors.ink, lineHeight: 20 }
});
