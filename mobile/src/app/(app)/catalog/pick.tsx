import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, colors, Empty, styles as ui } from '@/components/ui';
import { catalogBrands, searchCatalog } from '@/lib/catalog';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';

const allBrands = msg('All brands');
const categories = [msg('All'), msg('Purifiers'), msg('Spare parts'), msg('Accessories')] as const;

// Step one of adding a product: pick it from the ready-made catalogue (name, HSN and GST filled in),
// or start an empty product for anything not listed.
export default function PickProduct() {
  const { data } = useSession();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState<string>(allBrands);
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const added = useMemo(() => new Set(data.products.map(item => item.name.toLowerCase())), [data.products]);
  const items = searchCatalog(query, { brand: brand === allBrands ? undefined : brand, category: category === 'All' ? undefined : category });

  const own = () => router.replace('/catalog/edit');

  return (
    <View style={ui.screen}>
      <FlatList
        data={items}
        keyExtractor={item => item.name}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={ui.padded}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <View style={local.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder={t('Search model or part, e.g. Kent Grand, membrane 80')} placeholderTextColor={colors.muted} style={local.input} autoCorrect={false} accessibilityLabel={t('Search the catalogue')} />
            </View>
            <Chips label={t('Category')} options={categories} value={category} onChange={setCategory} />
            <Chips label={t('Brand')} options={[allBrands, ...catalogBrands]} value={brand} onChange={setBrand} format={value => (value === allBrands ? t(value) : value)} />
            <Button label={t('Not in the list? Add your own product')} variant="secondary" onPress={own} />
          </View>
        }
        ListEmptyComponent={<Empty text={t('Nothing matches. Add it as your own product.')} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => {
          const already = added.has(item.name.toLowerCase());
          return (
            <Pressable
              style={[local.card, already && local.done]}
              onPress={() => router.replace({ pathname: '/catalog/edit', params: { from: item.name } })}
              accessibilityRole="button"
              accessibilityHint={t('Opens a new product with these details filled in')}
            >
              <View style={ui.flex}>
                <Text style={local.title}>{item.name}</Text>
                <Text style={local.note}>{`${t(item.category)} · HSN ${item.hsn} · GST ${item.gst}%`}</Text>
              </View>
              {already ? <Text style={local.badge}>{t('Added')}</Text> : <Ionicons name="add-circle-outline" size={24} color={colors.teal} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const local = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.ink },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 12 },
  done: { opacity: 0.6 },
  title: { fontSize: 14, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { fontSize: 12, fontWeight: '700', color: colors.tealDark }
});
