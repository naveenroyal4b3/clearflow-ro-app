import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from './ui';
import { productIconSvg } from '@/lib/shared';

type Props = { product: { name: string; category: string }; url?: string; size?: number };

// The product's photo when there is one, otherwise a drawn icon for its type.
export function ProductImage({ product, url, size = 48 }: Props) {
  const [failed, setFailed] = useState<string>();
  const frame = { width: size, height: size, borderRadius: Math.round(size / 5) };
  if (url && failed !== url) {
    return <Image source={{ uri: url }} style={[local.box, frame]} resizeMode="cover" onError={() => setFailed(url)} accessibilityIgnoresInvertColors />;
  }
  const icon = Math.round(size * 0.6);
  return (
    <View style={[local.box, frame]} accessible={false} importantForAccessibility="no-hide-descendants">
      <SvgXml xml={productIconSvg(product, colors.teal)} width={icon} height={icon} />
    </View>
  );
}

const local = StyleSheet.create({
  box: { backgroundColor: colors.tealPale, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
});
