# Drum Machine Handoff

## Current State

`index.html` is a self-contained HTML/CSS/JS drum machine. It has no visible text in the UI. The design direction is compact, dark, matte, physical hardware: small black rotary encoders, rubber button caps, subtle LEDs, and a functional LED screen.

Core workflow:
- Four drum voices, one row each.
- 16-step grid per voice.
- Step click toggles hits.
- Double-click or Alt-click a step toggles accent.
- Shift-click a step cycles trigger probability.
- After touching an active step, turn a per-voice encoder to create a temporary parameter lock on that step.
- Play/pause preserves the current playhead position and resumes from there.
- Current playhead column is shown by white illumination on the step buttons themselves.
- Four pattern banks, each with its own LED color.
- Active bank color also drives the six geometric LED-screen indicators.
- Blade/shift toggles mixer mode in normal operation.
- Alt+blade/shift rotates the selected pattern row.

## Controls

The six rotary encoders follow an Elektron-style workflow:
- **Tempo** — global
- **Swing** — global
- **Tune** — per-voice (pitch/frequency character)
- **Decay** — per-voice (envelope length)
- **Grit** — per-voice (drive/saturation)
- **Echo** — per-voice (delay send level)

Selecting a voice (clicking the voice button on the left of a step row) snaps encoders 3–6 to that voice's stored parameter values. The four per-voice screen indicators tint to the selected voice's color.

### Mixer Mode

**Blade/shift button** toggles mixer mode when not in source mode.

In mixer mode:
- Encoders 1–2 remain tempo and swing.
- Encoder 3 controls voice 1 level.
- Encoder 4 controls voice 2 level.
- Encoder 5 controls voice 3 level.
- Encoder 6 controls voice 4 level.
- Click a row voice button to toggle mute.
- Shift-click or Alt-click a row voice button to toggle solo.
- Muted rows dim; soloed rows show a stronger voice-color indicator.

### Source Mode (Alt+click voice button)

**Click** a voice button: select voice + audition sound (original behavior).
**Alt+click** a voice button: toggle source/sample selection mode for that voice.

In source mode, the 64-button step matrix becomes a **sample/engine browser**:
- First 10 buttons = synth engines (kick, snare, hat, perc, rim, tom, clap, zap, cow, FM)
- Next 28 buttons = built-in generated ROM one-shot sample slots
- Next 8 buttons = user recorded/loaded sample slots
- Remaining buttons = inactive
- Click a button to preview + assign that engine to the voice
- The currently assigned engine is highlighted with the voice's LED color
- **Drag and drop** audio files from desktop onto user sample slot buttons to load them

Encoders in source mode:
- Synth engines: encoders work normally (tune, decay, grit, echo)
- Sample engines have two latched pages toggled by the blade/shift button:
  - Slice page: tune→sampleStart, decay→sampleEnd, grit→samplePitch, echo→echo send
  - Envelope page: tune→sampleAttack, decay→sampleDecay, grit→sampleSustain, echo→sampleRelease

The screen morphs: bars 3–6 merge into a single wide preview showing either a synth identity waveform, a sample waveform with start/end markers, or an ADSR curve over the sample waveform.

Exit source mode by: clicking a voice button, or Alt+clicking the same voice again.

### Recording

While in source mode, tap the **mist** button (normally randomize) to arm mic recording:
- Screen shows live waveform building up
- Max ~3 seconds
- Tap mist again or release voice button to stop
- Sample auto-normalizes and assigns to the current voice
- Stored in a sample slot (8 max, round-robin)

## Timing / Sequencer Depth

Playback now uses a Web Audio lookahead scheduler instead of relying on a single visual `setTimeout` loop. Notes are scheduled against `AudioContext.currentTime`, while visual playhead updates are queued separately.

Per-step state now includes:
- `probabilities[row][col]` for chance-based triggering.
- `locks[row][col]` for per-step overrides of tune, decay, grit, and echo.

Banks persist steps, accents, probabilities, locks, mixer levels, mutes, solos, and voice parameters.

Sample voice parameters include slice controls and ADSR-style one-shot shaping:
- `sampleStart`
- `sampleEnd`
- `samplePitch`
- `sampleAttack`
- `sampleDecay`
- `sampleSustain`
- `sampleRelease`
- `samplePage`

The screen above the encoders shows six abstract SVG shape indicators, one per encoder. These are not progress bars. They map knob values to geometric properties like vertex count, arc completion, star complexity, bounded fill, spiral turns, and helix spread.

The knobs support:
- Drag up/down to adjust.
- Hover + mouse wheel to adjust slowly.

## Sound Engine

### Engine Registry (10 synths + 28 ROM samples + 8 user sample slots)

| # | Engine | Character |
|---|--------|-----------|
| 0 | Kick | sine drop + click |
| 1 | Snare | bandpass noise + click |
| 2 | Hat | highpass noise |
| 3 | Perc | triangle drop |
| 4 | Rim | short square click, high, tight |
| 5 | Tom | sine drop, longer/deeper |
| 6 | Clap | layered noise bursts with pre-delay |
| 7 | Zap | fast sine sweep upward |
| 8 | Cow | two detuned squares, bandpass |
| 9 | FM | FM synthesis metallic hit |
| 10-37 | ROM Sample 0-27 | generated one-shot AudioBuffers |
| 38-45 | User Sample 0-7 | loaded/recorded AudioBuffers |

Each voice stores an `engine` index in its voiceParams.

### Audio Routing

Per-voice:
- Each voice has its own WaveShaperNode (grit) and echo send GainNode.
- Voice chain: envGain → voiceShaper[i] → master → destination.
- voiceShaper[i] → echoSend[i] → shared delay bus.
- Tune and decay read per-voice, affecting pitch/filter/envelope per instrument.

Global:
- Shared delay/feedback loop (delay time and feedback are global).
- Master gain to destination.

### Sample Playback

When a voice's engine points to a sample slot (≥10):
- Creates AudioBufferSourceNode
- Reads sampleStart/sampleEnd for slice boundaries
- samplePitch controls playbackRate (0.25x–4x range)
- Applies a one-shot ADSR gain envelope to the sample
- Grit and echo still apply on top

## Color System

8 distinct colors, no overlap between voices and banks:

**Voices:** warm red (#e85d3a), bone cream (#d4c898), cyan (#38d4be), periwinkle (#5c7cf0)
**Banks:** amber gold (#d4a030), magenta pink (#d84888), lime green (#78c838), violet (#a878e8)

## Important Design Constraints

- No visible text, numbers, labels, or instructions in the UI.
- Avoid decorative features that do not serve loop-making.
- Keep the device compact and physically plausible.
- Prefer matte material, subdued LED bloom, and restrained luminance.
- Knobs should look like real knobs: black/plastic/metal with a simple painted notch, not illuminated value rings.
- If a visual exists, it should correspond to actual state or parameter control.

## Likely Next Steps

- Per-voice **level** or mute/solo performance gestures.
- More explicit probability editing beyond the current shift-click cycle.
- Parameter-lock clearing/copy gestures.
- **Copy/paste** voices or patterns between banks.
- **Swing per voice** or per step group.
