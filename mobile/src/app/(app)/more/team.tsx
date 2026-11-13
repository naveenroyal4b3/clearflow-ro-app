import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, colors, Notice, styles as ui } from '@/components/ui';
import { initials } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';

// English labels, shown with t().
const priceList: Record<string, string> = { Technician: msg('Technician prices'), Shop: msg('Shop prices'), Customer: msg('Customer prices'), Owner: msg('All prices') };

export default function Team() {
  const { data, offlineSince } = useSession();
  const accounts = [...data.accounts].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
  const add = () => {
    if (offlineSince) { Alert.alert(t('Offline'), t('Invitations can be sent once you are back online.')); return; }
    router.push('/more/team-edit');
  };
  return (
    <View style={ui.screen}>
      <Stack.Screen options={{ headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel={t('Invite a team member')} onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="person-add" size={24} color={colors.teal} />
        </Pressable>
      ) }} />
      <FlatList
        data={accounts}
        keyExtractor={item => item.id}
        contentContainerStyle={ui.padded}
        ListHeaderComponent={<Notice title={t('Access.')}>{t('Each person signs in with their own email and password, and sees only the records and price tier their role allows. Tap + to invite someone.')}</Notice>}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable style={local.card} disabled={item.role === 'Owner'} onPress={() => router.push({ pathname: '/more/team-edit', params: { id: item.id } })} accessibilityHint={item.role === 'Owner' ? undefined : t('Opens the account to edit it')}>
            <View style={local.avatar}><Text style={local.avatarText}>{initials(item.name || item.username)}</Text></View>
            <View style={ui.flex}>
              <Text style={local.name}>{item.name || item.username}</Text>
              <Text style={local.note}>{item.username}</Text>
              <Text style={local.note}>{`${t(item.role)} · ${priceList[item.role] ? t(priceList[item.role]) : ''}${item.phone ? ` · ${item.phone}` : ''}`}</Text>
            </View>
            <Badge label={t(item.status)} tone={item.status === 'Active' ? 'good' : 'neutral'} />
          </Pressable>
        )}
      />
    </View>
  );
}

const local = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.tealDark, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 }
});
