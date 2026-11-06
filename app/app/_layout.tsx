import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/bricolage-grotesque';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackendSync } from '../src/lib/BackendSync';
import { ReminderSync } from '../src/lib/ReminderSync';
import { StoreProvider, useStore } from '../src/store/store';
import { color } from '../src/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: color.canvas }} />;
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <ReminderSync />
        <BackendSync />
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { state } = useStore();
  if (!state.hydrated) return <View style={{ flex: 1, backgroundColor: color.canvas }} accessibilityLabel="Loading" />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="session/[key]" />
      <Stack.Screen name="pain" options={{ presentation: 'modal' }} />
      <Stack.Screen name="safety" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="review" />
      <Stack.Screen name="memory" />
      <Stack.Screen name="account" />
      <Stack.Screen name="meal" />
      <Stack.Screen name="food-settings" />
    </Stack>
  );
}
