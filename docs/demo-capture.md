# Demo Capture Guide

## Goal

Record a short walkthrough showing one scenario run, learn pages, and the summary card.

## Recommended Timeline (60-90 seconds)

1. Open landing page and click quick start.
2. Show one scenario phase transition and event flow.
3. Toggle playback speed and pause/step controls.
4. Open an event detail in the log.
5. Navigate to learn glossary and one concept page.
6. Return to scenario and show summary/comparison card.

## Capture Options

### Quick GIF (Linux)

- Use Peek, Kooha, or ffmpeg + palette workflow.
- Keep width around 1280px for README compatibility.

### Video (MP4/WebM)

- Use OBS Studio for better quality.
- Export 1080p at 30 FPS.

## ffmpeg GIF Conversion Example

```bash
ffmpeg -i demo.mp4 -vf "fps=12,scale=1280:-1:flags=lanczos" -y demo.gif
```

## Placement

- Put output files in `docs/demo/`
- Reference them from `README.md`
