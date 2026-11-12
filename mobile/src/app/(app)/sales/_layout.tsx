import { Stack } from 'expo-router';
import { colors } from '@/components/ui';

export default function SalesLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: 'Sales & invoices' }} />
      <Stack.Screen name="[id]" options={{ title: 'Document' }} />
      <Stack.Screen name="new" options={{ title: 'New document', presentation: 'modal' }} />
    </Stack>
  );
}
