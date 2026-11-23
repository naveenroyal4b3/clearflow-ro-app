import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ChipMenu } from '@/components/Chips';
import { PlanNotice, useReadOnlyReason } from '@/components/PlanNotice';
import { ProductImage } from '@/components/ProductImage';
import { Badge, colors, Empty, styles as ui } from '@/components/ui';
import { money } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useProductImageUrls } from '@/lib/productImages';
import { useSession } from '@/lib/session';
import { applianceGroup, groupsIn, photoCredits } from '@/lib/shared';
import type { Product } from '@/lib/types';
import { headerWithFeedback } from '@/components/FeedbackButton';

const categories = [msg('All'), msg('Purifiers'), msg('Accessories'), msg('Spare parts')] as const;
type Tier = 'customer' | 'technician' | 'shop';

// The owner sees all three price lists; everyone else sees only their own (enforced in the database).
export default function Catalog() {
  const { data, profile, reload } = useSession();
  const readOnly = useReadOnlyReason();
  const owner = profile?.role === 'owner';
  const canViewStock = owner || profile?.role === 'technician';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [type, setType] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const tier: Tier = profile?.role === 'technician' || profile?.role === 'shop' ? profile.role : 'customer';
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = data.products.filter(item => words.every(word => `${item.name} ${item.hsn || ''} ${item.description || ''}`.toLowerCase().includes(word)));
  const inCategory = matching.filter(item => category === 'All' || item.category === category);
  // Appliance types with products in this category; a type with none here shows all types.
  const types = groupsIn(inCategory);
  const shownType = types.some(([key]) => key === type) ? type : 'all';
  const products = inCategory.filter(item => shownType === 'all' || applianceGroup(item) === shownType).sort((a, b) => a.name.localeCompare(b.name));
  const imageUrls = useProductImageUrls(data.products);
  const price = (item: Product) => item[tier] ?? item.customer ?? 0;

  const add = () => {
    if (readOnly) { Alert.alert(t('Can’t add products'), readOnly); return; }
    router.push('/catalog/pick');
  };

  return (
    <View style={ui.screen}>
      {owner ? (
        <Stack.Screen options={{ headerRight: headerWithFeedback(
          <Pressable accessibilityRole="button" accessibilityLabel={t('Add product')} onPress={add} hitSlop={12} style={{ paddingHorizontal: 8 }}>
            <Ionicons name="add-circle" size={28} color={colors.teal} />
          </Pressable>
        ) }} />
      ) : null}
      <FlatList
        data={products}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={ui.padded}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); setRefreshing(false); }} colors={[colors.teal]} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <PlanNotice />
            {data.products.length ? (
              <View style={local.search}>
                <Ionicons name="search" size={18} color={colors.muted} />
                <TextInput value={query} onChangeText={setQuery} placeholder={t('Search name or HSN…')} placeholderTextColor={colors.muted} style={local.input} autoCorrect={false} accessibilityLabel={t('Search products')} />
                {query ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('Clear search')} hitSlop={10} onPress={() => setQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.filters} accessibilityLabel={t('Category')}>
              {types.length > 1 ? (
                <ChipMenu label={t('Type')} value={shownType} onChange={setType} options={[{ value: 'all', label: t('All types') }, ...types.map(([key, label]) => ({ value: key, label: t(label) }))]} />
              ) : null}
              {categories.map(option => (
                <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: option === category }} onPress={() => setCategory(option)} style={[local.chip, option === category && local.chipOn]}>
                  <Text style={[local.chipText, option === category && local.chipTextOn]}>{t(option)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {!owner ? <Text style={local.note}>{tierNotice(tier)}</Text> : null}
          </View>
        }
        ListEmptyComponent={<Empty text={data.products.length ? t('No matching products.') : owner ? t('No products yet. Tap + to add one.') : t('No products yet.')} />}
        ListFooterComponent={photoCredits(products).length ? (
          <Text style={[local.note, { marginTop: 16 }]}>
            {t('Photo credits:')}{' '}
            {photoCredits(products).map((photo, index) => (
              <Text key={photo.link} onPress={() => Linking.openURL(photo.link)} style={{ textDecorationLine: 'underline' }}>{index ? ' · ' : ''}{photo.credit}</Text>
            ))}
          </Text>
        ) : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable style={local.card} disabled={!owner} onPress={() => router.push({ pathname: '/catalog/edit', params: { id: item.id } })} accessibilityHint={owner ? t('Opens the product to edit it') : undefined}>
            <View style={local.top}>
              <ProductImage product={item} url={item.image ? imageUrls[item.image] : undefined} />
              <View style={ui.flex}>
                <Text style={local.title}>{item.name}</Text>
                <Text style={local.note}>{`${t(item.category)}${item.hsn ? ` · HSN ${item.hsn}` : ''} · GST ${item.gst}% · ${item.unit}`}</Text>
              </View>
              {canViewStock ? <Badge label={t('{count} in stock', { count: item.stock ?? 0 })} tone={(item.stock ?? 0) < 5 ? 'warning' : 'good'} /> : null}
            </View>
            {item.description ? <Text style={local.note} numberOfLines={2}>{item.description}</Text> : null}
            {owner ? (
              <View style={local.prices}>
                <Price label={t('Customer')} value={item.customer} main />
                <Price label={t('Technician')} value={item.technician} />
                <Price label={t('Shop')} value={item.shop} />
              </View>
            ) : <Text style={local.price}>{t('{price} per {unit}', { price: money(price(item)), unit: item.unit })}</Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

function Price({ label, value, main }: { label: string; value?: number; main?: boolean }) {
  return (
    <View style={ui.flex}>
      <Text style={local.priceLabel}>{label}</Text>
      <Text style={[local.priceValue, main && local.priceMain]}>{money(value ?? 0)}</Text>
    </View>
  );
}

function tierNotice(tier: Tier) {
  if (tier === 'technician') return t('Showing the technician prices assigned to your account.');
  if (tier === 'shop') return t('Showing the shop prices assigned to your account.');
  return t('Showing the customer prices assigned to your account.');
}

const local = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.ink },
  filters: { gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  chipOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted },
  price: { fontSize: 18, fontWeight: '800', color: colors.tealDark, fontVariant: ['tabular-nums'] },
  prices: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderColor: colors.line, paddingTop: 8 },
  priceLabel: { fontSize: 11, color: colors.muted },
  priceValue: { fontSize: 14, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  priceMain: { color: colors.tealDark }
});
