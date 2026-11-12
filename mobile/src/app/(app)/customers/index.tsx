import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, Empty, styles as ui } from '@/components/ui';
import { PlanNotice, useReadOnlyReason } from '@/components/PlanNotice';
import { formatDate, initials } from '@/lib/format';
import { useSession } from '@/lib/session';

const types = ['All', 'Residential', 'Commercial', 'Apartment'];

export default function Customers() {
  const { data, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  const customers = useMemo(() => data.customers
    .filter(item => type === 'All' || item.type === type)
    .filter(item => `${item.name} ${item.phone} ${item.address} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)), [data.customers, query, type]);

  const add = () => {
    if (readOnly) { Alert.alert('Can’t add customers', readOnly); return; }
    router.push('/customers/edit');
  };

  return (
    <View style={ui.screen}>
      <Stack.Screen options={{ headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Add customer" onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
          <Ionicons name="add-circle" size={28} color={colors.teal} />
        </Pressable>
      ) }} />
      <FlatList
        data={customers}
        keyExtractor={item => item.id}
        contentContainerStyle={ui.padded}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} colors={[colors.teal]} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <PlanNotice />
            <TextInput style={ui.input} placeholder="Search name, phone, address…" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} accessibilityLabel="Search customers" />
            <View style={local.chips}>
              {types.map(item => (
                <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: item === type }} onPress={() => setType(item)} style={[local.chip, item === type && local.chipActive]}>
                  <Text style={[local.chipText, item === type && local.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={ui.hint}>{`${customers.length} of ${data.customers.length} customers`}</Text>
          </View>
        }
        ListEmptyComponent={<Empty text={data.customers.length ? 'No matching customers.' : 'No customers yet. Tap + to add one.'} />}
        renderItem={({ item }) => (
          <Pressable style={local.card} onPress={() => router.push({ pathname: '/customers/edit', params: { id: item.id } })} accessibilityHint="Opens the customer to view or edit">
            <View style={local.avatar}><Text style={local.avatarText}>{initials(item.name)}</Text></View>
            <View style={ui.flex}>
              <Text style={local.name}>{item.name}</Text>
              <Text style={local.note}>{`${item.type} · ${item.purifier || 'No unit recorded'}`}</Text>
              {item.installed ? <Text style={local.note}>{`Installed ${formatDate(item.installed)}`}</Text> : null}
              {item.address ? <Text style={local.note} numberOfLines={2}>{item.address}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Call ${item.name}`} hitSlop={10} onPress={() => Linking.openURL(`tel:${item.phone.replace(/\s/g, '')}`)} style={local.call}>
              <Ionicons name="call" size={18} color={colors.teal} />
            </Pressable>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

const local = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  chipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.tealDark, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  call: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }
});
