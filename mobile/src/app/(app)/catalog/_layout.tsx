import { Stack } from 'expo-router';
import { colors } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function CatalogLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: t('Product catalogue') }} />
      <Stack.Screen name="edit" options={{ title: t('Product'), presentation: 'modal' }} />
    </Stack>
  );
}
