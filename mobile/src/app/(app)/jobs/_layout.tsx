import { Stack } from 'expo-router';
import { colors } from '@/components/ui';

export default function JobsLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: 'Service jobs' }} />
      <Stack.Screen name="edit" options={{ title: 'Service job', presentation: 'modal' }} />
    </Stack>
  );
}
