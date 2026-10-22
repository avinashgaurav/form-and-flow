import { EMERGENCY } from '@ff/engines';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';
import { color, space } from '../src/theme';
import { Button, Card, Screen, T } from '../src/ui';

/**
 * S36 safety stop. Fixed text from local code so it works offline. No diagnostic questions.
 * "I'm OK now" goes to Today in rest mode; workouts stay paused until the user confirms a doctor
 * has checked them (Settings). Wording pending professional review (plan/14).
 */
export default function Safety() {
  const { kind } = useLocalSearchParams<{ kind?: 'red_flag' | 'crisis' }>();
  const crisis = kind === 'crisis';
  return (
    <Screen>
      <View style={{ gap: space.lg, paddingTop: space.xl }}>
        <T v="title" style={{ color: color.danger }}>{crisis ? 'You do not have to handle this alone' : 'Stop exercising now'}</T>
        <Card tone="danger">
          <T>{crisis ? "I'm really glad you reached out. Please talk to someone now. Tele-MANAS is free, 24 hours a day, in many languages." : 'If this is happening now, call for emergency help. Sit or lie down somewhere safe.'}</T>
        </Card>
        {crisis ? (
          <>
            <Button label={`Call Tele-MANAS ${EMERGENCY.mentalHealth.numbers[0]}`} kind="danger" icon="phone" tall onPress={() => Linking.openURL(`tel:${EMERGENCY.mentalHealth.numbers[0]}`)} />
            <Button label={`Emergency ${EMERGENCY.number}`} kind="secondary" icon="phone" onPress={() => Linking.openURL(`tel:${EMERGENCY.number}`)} />
          </>
        ) : (
          <>
            <Button label={`Call ${EMERGENCY.number} (emergency)`} kind="danger" icon="phone" tall onPress={() => Linking.openURL(`tel:${EMERGENCY.number}`)} />
            <Button label={`Call ${EMERGENCY.ambulance} (ambulance)`} kind="secondary" icon="phone" onPress={() => Linking.openURL(`tel:${EMERGENCY.ambulance}`)} />
          </>
        )}
        <T v="small">Workouts stay paused until you confirm a doctor has checked you. Logging still works.</T>
        <Button label="I'm OK now" kind="ghost" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
