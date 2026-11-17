import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from './ui';
import { useCatalogPhotos } from '@/lib/productImages';
import { webAppAddress } from '@/lib/plan';
import { catalogPhotoUrl, productArtSvg } from '@/lib/shared';

// Built-in photos of some product types are served from the website.
const typePhotoBase = `https://${webAppAddress}/`;

type Props = { product: { name: string; category: string }; url?: string; size?: number };

// The product's own photo when there is one, else the shared catalogue photo for its model or
// type, else a colour drawing of its type.
export function ProductImage({ product, url, size = 48 }: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const shared = useCatalogPhotos();
  const frame = { width: size, height: size, borderRadius: Math.round(size / 5) };
  const link = [url, catalogPhotoUrl(product, shared, typePhotoBase)].find(item => item && !failed.includes(item));
  if (link) {
    return <Image source={{ uri: link }} style={[local.box, frame]} resizeMode="cover" onError={() => setFailed(list => [...list, link])} accessibilityIgnoresInvertColors />;
  }
  const icon = Math.round(size * 0.86);
  return (
    <View style={[local.box, frame]} accessible={false} importantForAccessibility="no-hide-descendants">
      <SvgXml xml={productArtSvg(product)} width={icon} height={icon} />
    </View>
  );
}

const local = StyleSheet.create({
  box: { backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
});
