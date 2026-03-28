import { Pause, Play, SkipForward } from "lucide-react";
import { Button } from "~/components/ui/button";
import { playbackRates } from "~/hooks/use-playback";
import { useSimulationUi } from "~/lib/simulation-ui-context";

export function SpeedSlider() {
  const { playbackRate, setPlaybackRate, paused, togglePaused, stepForward } =
    useSimulationUi();

  const currentIndex = playbackRates.findIndex((rate) => rate === playbackRate);

  return (
    <div className="neo-panel flex min-h-11 items-center gap-2 bg-[var(--background)] p-2">
      <label className="text-[11px] font-black uppercase tracking-wide">
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
        className="h-2 w-28 accent-[var(--main)] md:w-36"
        aria-label="Playback speed"
      />

      <span className="min-w-10 text-center text-xs font-black">
        {playbackRate}x
      </span>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={togglePaused}
        aria-label={paused ? "Resume" : "Pause"}
        className="h-10 w-10 p-0"
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!paused}
        onClick={stepForward}
        aria-label="Step one event"
        className="h-10 w-10 p-0"
      >
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  );
}
