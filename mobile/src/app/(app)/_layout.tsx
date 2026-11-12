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
  const role = profile?.role;
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
      <Tabs.Protected guard={role === 'owner'}>
        <Tabs.Screen name="customers" options={{ title: 'Customers', headerShown: false, tabBarIcon: icon('people-outline') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={role !== 'shop'}>
        <Tabs.Screen name="jobs" options={{ title: 'Jobs', headerShown: false, tabBarIcon: icon('construct-outline') }} />
      </Tabs.Protected>
      <Tabs.Protected guard={role === 'owner' || role === 'customer'}>
        <Tabs.Screen name="sales" options={{ title: 'Sales', headerShown: false, tabBarIcon: icon('receipt-outline') }} />
      </Tabs.Protected>
      <Tabs.Screen name="catalog" options={{ title: 'Catalogue', headerShown: false, tabBarIcon: icon('cube-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
