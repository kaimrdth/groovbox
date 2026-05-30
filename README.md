# Dawson

![Static HTML](https://img.shields.io/badge/app-static%20HTML-2f3430)
![Web Audio](https://img.shields.io/badge/audio-Web%20Audio-4b6f67)
![No Build Step](https://img.shields.io/badge/build-none-5a5f58)
![License](https://img.shields.io/badge/license-unset-6b5f4a)

Dawson is a single-file browser drum machine built with HTML, CSS, SVG, and Web Audio. The interface is intentionally textless: controls are represented as physical buttons, encoders, LEDs, and screen glyphs rather than labels or menus.

The current direction is a compact hardware object seen in a browser viewport. The UI uses perspective, shadows, matte materials, responsive button states, and subtle parallax, but the interaction model is still meant to behave like an instrument rather than a decorative scene.

## Run

Open `index.html` directly, or serve the folder locally:

```sh
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/index.html
```

No build step or package install is required.

## Layout

```text
+---------------------------------------------------------+
| screen / waveform       | transport buttons             |
| six encoders            | four pattern banks            |
|---------------------------------------------------------|
| voice 1 | 16 step buttons                              |
| voice 2 | 16 step buttons                              |
| voice 3 | 16 step buttons                              |
| voice 4 | 16 step buttons                              |
+---------------------------------------------------------+
```

## Controls

```text
play button or Space        start / stop
voice button                select and audition a voice
Alt + voice button          enter source mode for that voice
step button                 toggle step
Alt / double-click step     toggle accent
Shift-click step            cycle trigger probability
touch step, then turn knob  create a parameter lock
blade button                toggle mixer mode
Alt + blade button          rotate selected pattern row
hover knob + wheel          fine adjustment
drag knob vertically        coarse adjustment
```

The six encoders are:

```text
tempo | swing | tune | decay | grit | echo
```

Tempo and swing are global. Tune, decay, grit, and echo are per voice. In sample source mode, the per-voice controls are remapped:

```text
slice page
tune  -> sample start
decay -> sample end
grit  -> sample pitch
echo  -> echo send

envelope page
tune  -> attack
decay -> decay
grit  -> sustain
echo  -> release
```

The blade button toggles between the slice and envelope pages while a sample is selected in source mode. The screen preview changes from waveform slice markers to an ADSR curve.

In mixer mode, the four right encoders become track levels:

```text
tune  -> voice 1 level
decay -> voice 2 level
grit  -> voice 3 level
echo  -> voice 4 level
```

In mixer mode, row voice buttons change role:

```text
voice button           toggle mute
Shift / Alt + voice    toggle solo
```

## Sequencer

The sequencer has four voices and sixteen steps per voice. Playback uses a Web Audio lookahead scheduler: notes are scheduled against `AudioContext.currentTime`, while the visual playhead is updated separately.

Swing uses paired long/short sixteenth-note intervals, so increasing swing changes the groove without stretching the bar length.

Each step can store:

```text
on/off
accent
trigger probability
parameter locks for tune, decay, grit, and echo
```

Pattern banks persist:

```text
steps
accents
probabilities
parameter locks
track levels
mutes
solos
voice parameters
```

## Sound Sources

Source mode turns the 64-button matrix into an engine/sample browser.

```text
0-9     synth engines
10-37   generated ROM one-shots
38-45   user sample slots
46-63   inactive
```

Synth engines:

```text
kick
snare
hat
perc
rim
tom
clap
zap
cow
FM
```

The ROM bank is generated in code on first audio initialization. It contains kicks, snares, hats, claps, metallic percussion, zaps, and FX hits. User sample slots can be filled by drag-and-drop or microphone recording while in source mode.

Samples support slice controls, pitch, echo send, and ADSR-style one-shot amplitude shaping.

## Audio Routing

```text
voice engine
  -> envelope gain
  -> per-voice waveshaper
  -> master gain
  -> compressor / limiter
  -> output

per-voice waveshaper
  -> per-voice echo send
  -> shared delay feedback loop
  -> output
```

The snare engine uses a membrane body, overtone layer, transient crack, bandpass wire noise, and highpass fizz/rattle layer. ROM snares use the same general model rendered into `AudioBuffer`s.

## File Structure

```text
.
├── index.html    # complete app: markup, styles, UI logic, synthesis, scheduler
├── HANDOFF.md    # implementation notes and current behavior
└── v2/           # older/alternate working area
```

## Hosting

The app is static and can be deployed to Netlify, GitHub Pages, Cloudflare Pages, or any static file host. For Netlify, use:

```text
build command:      none
publish directory:  .
```

Microphone recording requires a secure origin. HTTPS hosting works; localhost is also accepted by modern browsers for development.

## Design Constraints

- No visible labels, numbers, menus, or instructions inside the instrument UI.
- Visual state should correspond to instrument state or interaction feedback.
- Controls should feel like hardware controls: buttons depress, encoders rotate, LEDs indicate state.
- The 3D presentation should support the instrument metaphor without replacing sequencer depth.
- The app should remain self-contained unless a future change deliberately introduces assets or a build pipeline.
