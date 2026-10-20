import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { exerciseVideo } from './exerciseVideos';
import { Figure } from '../icons';
import { T } from '../ui';
import { color, radius, space } from '../theme';

/** The clips are rendered on white, so their frame is white too. */
const VIDEO_BACKGROUND = '#ffffff';

/**
 * The looping demo for an exercise: a short, silent 3D clip. It plays on its own unless the
 * phone asks for reduced motion; tapping pauses or plays it. If the clip cannot play (missing,
 * broken, or not saved for offline use yet), the text cues stand alone.
 */
export function ExerciseVideo({ exerciseId, name }: { exerciseId: string; name: string }) {
  const source = exerciseVideo(exerciseId);
  if (source === undefined) return <NoDemo />;
  return <Player key={exerciseId} source={source} name={name} />;
}

function NoDemo() {
  return (
    <View style={{ alignItems: 'center', backgroundColor: color.sunken, borderRadius: radius.card, paddingVertical: space.sm }}>
      <Figure size={88} />
      <T v="small">Demo not available. Text cues below.</T>
    </View>
  );
}

/** Whether the phone asks for reduced motion; null until known. */
function useReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => { if (live) setReduce(r); })
      .catch(() => { if (live) setReduce(false); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub?.remove(); // react-native-web returns nothing when the browser cannot report it
    };
  }, []);
  return reduce;
}

function Player({ source, name }: { source: number; name: string }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });
  // The label follows what the player is really doing, not what was asked of it.
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const reduce = useReduceMotion();

  useEffect(() => {
    if (reduce === false) player.play();
    if (reduce === true) player.pause();
  }, [player, reduce]);

  if (status === 'error') return <NoDemo />;

  return (
    <View style={{ gap: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${isPlaying ? 'Pause' : 'Play'} ${name} demo`}
        onPress={() => (isPlaying ? player.pause() : player.play())}
        style={{ width: '100%', maxWidth: 360, alignSelf: 'center', backgroundColor: VIDEO_BACKGROUND, borderRadius: radius.card, overflow: 'hidden' }}
      >
        <VideoView player={player} nativeControls={false} playsInline contentFit="contain" style={{ width: '100%', aspectRatio: 1 }} pointerEvents="none" />
      </Pressable>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <T v="small" style={{ textAlign: 'center' }}>{isPlaying ? '3D demo (draft). Tap to pause.' : '3D demo (draft). Tap to play.'}</T>
      </View>
    </View>
  );
}
