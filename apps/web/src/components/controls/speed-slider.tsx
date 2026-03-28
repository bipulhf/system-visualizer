import { Pause, Play, SkipForward } from "lucide-react";
import { Button } from "~/components/ui/button";
import { playbackRates } from "~/hooks/use-playback";
import { useSimulationUi } from "~/lib/simulation-ui-context";

export function SpeedSlider() {
  const { playbackRate, setPlaybackRate, paused, togglePaused, stepForward } =
    useSimulationUi();

  const currentIndex = playbackRates.findIndex((rate) => rate === playbackRate);

  return (
    <div className="flex items-center gap-2">
      <label className="hidden text-xs font-medium text-[var(--muted)] md:block">
        Speed
      </label>

      <input
        type="range"
        min={0}
        max={playbackRates.length - 1}
        step={1}
        value={currentIndex}
        onChange={(event) => {
          const index = Number(event.currentTarget.value);
          const nextRate = playbackRates[index];
          if (nextRate !== undefined) {
            setPlaybackRate(nextRate);
          }
        }}
        className="hidden h-1.5 w-20 accent-[var(--main)] md:block md:w-28"
        aria-label="Playback speed"
      />

      <span className="hidden min-w-8 text-center text-xs font-semibold md:block">
        {playbackRate}x
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePaused}
        aria-label={paused ? "Resume" : "Pause"}
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={!paused}
        onClick={stepForward}
        aria-label="Step one event"
      >
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  );
}
