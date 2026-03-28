import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePlayback, type PlaybackRate } from "~/hooks/use-playback";
import type { ServiceName } from "~/lib/event-types";

type SimulationUiContextValue = {
  playbackRate: PlaybackRate;
  setPlaybackRate: (rate: PlaybackRate) => void;
  paused: boolean;
  togglePaused: () => void;
  stepCounter: number;
  stepForward: () => void;
  currentPhase: number;
  setCurrentPhase: (phase: number) => void;
  selectedService: ServiceName | null;
  setSelectedService: (service: ServiceName | null) => void;
  whatIfEnabled: boolean;
  setWhatIfEnabled: (enabled: boolean) => void;
  whatIfService: ServiceName;
  setWhatIfService: (service: ServiceName) => void;
  failureCount: number;
  setFailureCount: (count: number) => void;
  phaseJumpRequest: number | null;
  requestPhaseJump: (phase: number) => void;
  clearPhaseJumpRequest: () => void;
};

const SimulationUiContext = createContext<SimulationUiContextValue | null>(
  null,
);

export function SimulationUiProvider({ children }: { children: ReactNode }) {
  const {
    playbackRate,
    paused,
    stepCounter,
    setPlaybackRate,
    togglePaused,
    stepForward,
  } = usePlayback();
  const [currentPhase, setCurrentPhase] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<ServiceName | null>(
    "elysia",
  );
  const [whatIfEnabled, setWhatIfEnabled] = useState<boolean>(false);
  const [whatIfService, setWhatIfService] = useState<ServiceName>("redis");
  const [failureCount, setFailureCount] = useState<number>(0);
  const [phaseJumpRequest, setPhaseJumpRequest] = useState<number | null>(null);

  const value = useMemo<SimulationUiContextValue>(
    () => ({
      playbackRate,
      setPlaybackRate,
      paused,
      togglePaused,
      stepCounter,
      stepForward,
      currentPhase,
      setCurrentPhase,
      selectedService,
      setSelectedService,
      whatIfEnabled,
      setWhatIfEnabled,
      whatIfService,
      setWhatIfService,
      failureCount,
      setFailureCount,
      phaseJumpRequest,
      requestPhaseJump: (phase: number) => {
        setPhaseJumpRequest(phase);
      },
      clearPhaseJumpRequest: () => {
        setPhaseJumpRequest(null);
      },
    }),
    [
      currentPhase,
      failureCount,
      paused,
      phaseJumpRequest,
      playbackRate,
      selectedService,
      setPlaybackRate,
      stepCounter,
      stepForward,
      togglePaused,
      whatIfEnabled,
      whatIfService,
    ],
  );

  return (
    <SimulationUiContext.Provider value={value}>
      {children}
    </SimulationUiContext.Provider>
  );
}

export function useSimulationUi(): SimulationUiContextValue {
  const context = useContext(SimulationUiContext);
  if (!context) {
    throw new Error("useSimulationUi must be used within SimulationUiProvider");
  }

  return context;
}
