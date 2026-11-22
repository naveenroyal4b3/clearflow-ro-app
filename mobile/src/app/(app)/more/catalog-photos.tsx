import { useMemo, useState } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Button, colors, Field, Notice, styles as ui } from '@/components/ui';
import { searchCatalog } from '@/lib/catalog';
import { errorMessage } from '@/lib/format';
import { photoBytes, pickProductPhoto, refreshCatalogPhotos, useCatalogPhotos, usePlatformAdmin } from '@/lib/productImages';
import { productArtSvg, productKindLabels, productKinds, removeCatalogPhoto, uploadCatalogPhoto } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

type Row = { key: string; title: string; note: string; product: { name: string; category: string } };

// The shared photo library, for platform admins only (the app's operator), so it is not translated:
// a photo per product type and per catalogue model, shown to every business for products without
// their own photo. Taken with the camera or chosen from the phone.
export default function CatalogPhotos() {
  const admin = usePlatformAdmin();
  const photos = useCatalogPhotos();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const rows = useMemo<Row[]>(() => {
    if (query.trim()) return searchCatalog(query).slice(0, 40).map(item => ({ key: item.name, title: item.name, note: `${item.brand} · ${item.category}`, product: item }));
    return productKinds.map(kind => ({ key: `type:${kind}`, title: productKindLabels[kind] || kind, note: 'Every product of this type without a model photo', product: { name: productKindLabels[kind] || kind, category: kind === 'purifier' ? 'Purifiers' : 'Spare parts' } }));
  }, [query]);

  const setPhoto = async (key: string, source: 'camera' | 'library') => {
    try {
      const photo = await pickProductPhoto(source);
      if (!photo) return;
      setBusy(key);
      await uploadCatalogPhoto(supabase, key, await photoBytes(photo.uri), 'image/jpeg');
      await refreshCatalogPhotos();
    } catch (error) {
      Alert.alert('Photo not saved', errorMessage(error, 'Try again.'));
    } finally {
      setBusy('');
    }
  };
  const remove = (key: string) => Alert.alert('Remove this photo?', 'Every business will see the drawing again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: async () => {
      setBusy(key);
      try { await removeCatalogPhoto(supabase, key); await refreshCatalogPhotos(); }
      catch (error) { Alert.alert('Not removed', errorMessage(error, 'Try again.')); }
      finally { setBusy(''); }
    } }
  ]);

  if (admin === null) return null;
  if (!admin) return <View style={ui.padded}><Notice tone="warning">Only the TiruFix team can change catalogue photos.</Notice></View>;
  return (
    <FlatList
      data={rows}
      keyExtractor={row => row.key}
      contentContainerStyle={ui.padded}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 10 }}>
          <Notice>Photos here are shown to every business. Take each photo on a plain background, with the part filling the square.</Notice>
          <Field label="Find a catalogue model" value={query} onChangeText={setQuery} placeholder="Leave empty for product types" />
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderItem={({ item }) => {
        const link = photos[item.key];
        return (
          <View style={local.card}>
            <View style={local.top}>
              <View style={local.thumb}>
                {link ? <Image source={{ uri: link }} style={local.image} /> : <SvgXml xml={productArtSvg(item.product)} width={56} height={56} />}
              </View>
              <View style={ui.flex}>
                <Text style={local.title}>{item.title}</Text>
                <Text style={local.note}>{busy === item.key ? 'Saving…' : link ? 'Real photo' : 'Drawing'} · {item.note}</Text>
              </View>
            </View>
            <View style={local.actions}>
              <View style={ui.flex}><Button label="Take photo" onPress={() => setPhoto(item.key, 'camera')} disabled={Boolean(busy)} /></View>
              <View style={ui.flex}><Button label="Gallery" variant="secondary" onPress={() => setPhoto(item.key, 'library')} disabled={Boolean(busy)} /></View>
            </View>
            {link ? <Button label="Remove photo" variant="secondary" onPress={() => remove(item.key)} disabled={Boolean(busy)} /> : null}
          </View>
        );
      }}
    />
  );
}

const local = StyleSheet.create({
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: 72, height: 72 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 }
});
