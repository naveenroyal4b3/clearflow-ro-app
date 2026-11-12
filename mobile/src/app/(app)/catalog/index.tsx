import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { PlanNotice, useReadOnlyReason } from '@/components/PlanNotice';
import { Badge, colors, Empty, Notice, styles as ui } from '@/components/ui';
import { money } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Product } from '@/lib/types';

const categories = ['All', 'Purifiers', 'Accessories', 'Spare parts'] as const;
const tiers = ['Customer', 'Technician', 'Shop'] as const;
type Tier = 'customer' | 'technician' | 'shop';

// Each role sees only its own price tier (enforced in the database); the owner can preview each.
export default function Catalog() {
  const { data, profile, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const owner = profile?.role === 'owner';
  const canViewStock = owner || profile?.role === 'technician';
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [preview, setPreview] = useState<(typeof tiers)[number]>('Customer');
  const [refreshing, setRefreshing] = useState(false);
  const tier: Tier = owner ? (preview.toLowerCase() as Tier) : (profile?.role === 'technician' || profile?.role === 'shop' ? profile.role : 'customer');
  const products = data.products.filter(item => category === 'All' || item.category === category).sort((a, b) => a.name.localeCompare(b.name));
  const price = (item: Product) => item[tier] ?? item.customer ?? 0;

  const add = () => {
    if (readOnly) { Alert.alert('Can’t add products', readOnly); return; }
    router.push('/catalog/edit');
  };

  return (
    <View style={ui.screen}>
      {owner ? (
        <Stack.Screen options={{ headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Add product" onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
            <Ionicons name="add-circle" size={28} color={colors.teal} />
          </Pressable>
        ) }} />
      ) : null}
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        contentContainerStyle={ui.padded}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} colors={[colors.teal]} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <PlanNotice />
            {owner ? (
              <>
                <Notice>{`Previewing ${preview.toLowerCase()} prices. Each signed-in role can only see its own price tier.`}</Notice>
                <Chips label="Price list" options={tiers} value={preview} onChange={setPreview} />
              </>
            ) : <Notice>{`Showing the ${tier} prices assigned to your account.`}</Notice>}
            <Chips label="Category" options={categories} value={category} onChange={setCategory} />
          </View>
        }
        ListEmptyComponent={<Empty text={data.products.length ? 'No products in this category.' : owner ? 'No products yet. Tap + to add one.' : 'No products yet.'} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable style={local.card} disabled={!owner} onPress={() => router.push({ pathname: '/catalog/edit', params: { id: item.id } })} accessibilityHint={owner ? 'Opens the product to edit it' : undefined}>
            <View style={local.top}>
              <View style={ui.flex}>
                <Text style={local.title}>{item.name}</Text>
                <Text style={local.note}>{`${item.category}${item.hsn ? ` · HSN ${item.hsn}` : ''} · GST ${item.gst}%`}</Text>
              </View>
              {canViewStock ? <Badge label={`${item.stock ?? 0} in stock`} tone={(item.stock ?? 0) < 5 ? 'warning' : 'good'} /> : null}
            </View>
            {item.description ? <Text style={local.note}>{item.description}</Text> : null}
            <Text style={local.price}>{`${money(price(item))} per ${item.unit}`}</Text>
            {owner ? <Text style={local.note}>{`Customer ${money(item.customer ?? 0)} · Technician ${money(item.technician ?? 0)} · Shop ${money(item.shop ?? 0)}`}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const local = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted },
  price: { fontSize: 18, fontWeight: '800', color: colors.tealDark, fontVariant: ['tabular-nums'] }
});
