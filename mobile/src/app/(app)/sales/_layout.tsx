import { Stack } from 'expo-router';
import { colors } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function SalesLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: t('Sales & invoices') }} />
      <Stack.Screen name="[id]" options={{ title: t('Document') }} />
      <Stack.Screen name="new" options={{ title: t('New document'), presentation: 'modal' }} />
    </Stack>
  );
}
