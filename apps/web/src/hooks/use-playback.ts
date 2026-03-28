import { useCallback, useState } from "react";

export const playbackRates = [0.25, 0.5, 1, 2, 4] as const;

export type PlaybackRate = (typeof playbackRates)[number];

export function usePlayback(): {
  playbackRate: PlaybackRate;
  paused: boolean;
  stepCounter: number;
  setPlaybackRate: (rate: PlaybackRate) => void;
  togglePaused: () => void;
  stepForward: () => void;
} {
  const [playbackRate, setPlaybackRateState] = useState<PlaybackRate>(1);
  const [paused, setPaused] = useState<boolean>(false);
  const [stepCounter, setStepCounter] = useState<number>(0);

  const setPlaybackRate = useCallback((rate: PlaybackRate) => {
    setPlaybackRateState(rate);
  }, []);

  const togglePaused = useCallback(() => {
    setPaused((current) => !current);
  }, []);

  const stepForward = useCallback(() => {
    setStepCounter((current) => current + 1);
  }, []);

  return {
    playbackRate,
    paused,
    stepCounter,
    setPlaybackRate,
    togglePaused,
    stepForward,
  };
}
