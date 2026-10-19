import { Redirect, Tabs } from 'expo-router';
import { Icon, type IconName } from '../../src/icons';
import { useStore } from '../../src/store/store';
import { BORDER, color, font } from '../../src/theme';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ focused }: { focused: boolean }) => <Icon name={icon} size={22} stroke={focused ? color.primary : color.muted} width={focused ? 2.4 : 2} />,
});

export default function TabsLayout() {
  const { state } = useStore();
  if (!state.onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.muted,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: color.surface, borderTopWidth: BORDER, borderTopColor: color.line, height: 64, paddingTop: 6 },
        sceneStyle: { backgroundColor: color.canvas },
      }}
    >
      <Tabs.Screen name="index" options={tab('Today', 'home')} />
      <Tabs.Screen name="train" options={tab('Train', 'train')} />
      <Tabs.Screen name="eat" options={tab('Eat', 'eat')} />
      <Tabs.Screen name="coach" options={tab('Coach', 'coach')} />
      <Tabs.Screen name="progress" options={tab('Progress', 'progress')} />
    </Tabs>
  );
}
