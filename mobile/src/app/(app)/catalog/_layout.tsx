import { Stack } from 'expo-router';
import { colors } from '@/components/ui';

export default function CatalogLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: 'Product catalogue' }} />
      <Stack.Screen name="edit" options={{ title: 'Product', presentation: 'modal' }} />
    </Stack>
  );
}
