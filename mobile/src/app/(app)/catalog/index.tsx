import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { PlanNotice, useReadOnlyReason } from '@/components/PlanNotice';
import { Badge, colors, Empty, Notice, styles as ui } from '@/components/ui';
import { money } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import type { Product } from '@/lib/types';

const categories = [msg('All'), msg('Purifiers'), msg('Accessories'), msg('Spare parts')] as const;
const tiers = [msg('Customer'), msg('Technician'), msg('Shop')] as const;
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
    if (readOnly) { Alert.alert(t('Can’t add products'), readOnly); return; }
    router.push('/catalog/edit');
  };

  return (
    <View style={ui.screen}>
      {owner ? (
        <Stack.Screen options={{ headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel={t('Add product')} onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
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
                <Notice>{previewNotice(tier)}</Notice>
                <Chips label={t('Price list')} options={tiers} value={preview} onChange={setPreview} />
              </>
            ) : <Notice>{tierNotice(tier)}</Notice>}
            <Chips label={t('Category')} options={categories} value={category} onChange={setCategory} />
          </View>
        }
        ListEmptyComponent={<Empty text={data.products.length ? t('No products in this category.') : owner ? t('No products yet. Tap + to add one.') : t('No products yet.')} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable style={local.card} disabled={!owner} onPress={() => router.push({ pathname: '/catalog/edit', params: { id: item.id } })} accessibilityHint={owner ? t('Opens the product to edit it') : undefined}>
            <View style={local.top}>
              <View style={ui.flex}>
                <Text style={local.title}>{item.name}</Text>
                <Text style={local.note}>{`${t(item.category)}${item.hsn ? ` · HSN ${item.hsn}` : ''} · GST ${item.gst}%`}</Text>
              </View>
              {canViewStock ? <Badge label={t('{count} in stock', { count: item.stock ?? 0 })} tone={(item.stock ?? 0) < 5 ? 'warning' : 'good'} /> : null}
            </View>
            {item.description ? <Text style={local.note}>{item.description}</Text> : null}
            <Text style={local.price}>{t('{price} per {unit}', { price: money(price(item)), unit: item.unit })}</Text>
            {owner ? <Text style={local.note}>{t('Customer {customer} · Technician {technician} · Shop {shop}', { customer: money(item.customer ?? 0), technician: money(item.technician ?? 0), shop: money(item.shop ?? 0) })}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

function previewNotice(tier: Tier) {
  if (tier === 'technician') return t('Previewing technician prices. Each signed-in role can only see its own price tier.');
  if (tier === 'shop') return t('Previewing shop prices. Each signed-in role can only see its own price tier.');
  return t('Previewing customer prices. Each signed-in role can only see its own price tier.');
}

function tierNotice(tier: Tier) {
  if (tier === 'technician') return t('Showing the technician prices assigned to your account.');
  if (tier === 'shop') return t('Showing the shop prices assigned to your account.');
  return t('Showing the customer prices assigned to your account.');
}

const local = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 6 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted },
  price: { fontSize: 18, fontWeight: '800', color: colors.tealDark, fontVariant: ['tabular-nums'] }
});
