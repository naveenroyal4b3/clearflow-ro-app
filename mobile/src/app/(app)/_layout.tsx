import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { colors } from '@/components/ui';
import { useSession } from '@/lib/session';

type IconName = keyof typeof Ionicons.glyphMap;
function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
  };
}

// Each role sees only the tabs it has data for, as in the web app.
export default function AppLayout() {
  const { profile } = useSession();
  const owner = profile?.role === 'owner';
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTitleStyle: { color: colors.ink, fontWeight: '700' },
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.canvas }
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Overview', tabBarIcon: icon('grid-outline') }} />
      <Tabs.Protected guard={owner}>
        <Tabs.Screen name="customers" options={{ title: 'Customers', headerShown: false, tabBarIcon: icon('people-outline') }} />
      </Tabs.Protected>
      <Tabs.Screen name="account" options={{ title: 'My account', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
