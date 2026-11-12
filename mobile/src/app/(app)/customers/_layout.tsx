import { Stack } from 'expo-router';
import { colors } from '@/components/ui';

export default function CustomersLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: 'Customers' }} />
      <Stack.Screen name="edit" options={{ title: 'Customer', presentation: 'modal' }} />
    </Stack>
  );
}
