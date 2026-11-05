#!/usr/bin/env python3
"""Generates warm, musical WAV sound effects (marimba/celesta/chime synthesis with room tail) into assets/sfx/."""
import math, os, struct, wave

SR = 22050
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx'))
os.makedirs(OUT, exist_ok=True)


def note_sample(freq, t, dur, kind='bell'):
    if t < 0 or t > dur:
        return 0.0
    attack = min(0.006, dur * 0.1)
    env = (t / attack) if t < attack else math.exp(-4.5 * (t - attack) / dur)
    w = 2 * math.pi * freq
    if kind == 'bell':
        # Celesta / glockenspiel: detuned fundamental + warm harmonics + fast-decaying chime overtone
        s = (0.55 * math.sin(w * t) +
             0.35 * math.sin(w * 1.0025 * t + 0.3) +
             0.28 * math.sin(2 * w * t) * math.exp(-3 * t) +
             0.12 * math.sin(3 * w * t) * math.exp(-6 * t) +
             0.07 * math.sin(4.01 * w * t) * math.exp(-12 * t))
        # Soft mallet transient on first 8 ms
        if t < 0.008:
            s += 0.25 * math.sin(6.3 * w * t) * (1 - t / 0.008)
        return s * env
    if kind == 'wood':
        # Warm marimba / woodblock: fundamental + 4th harmonic + quick woody body
        env_w = (t / 0.003) if t < 0.003 else math.exp(-14 * t)
        return (0.75 * math.sin(w * t) + 0.35 * math.sin(3.98 * w * t) * math.exp(-35 * t)) * env_w
    if kind == 'warm':
        # Soft Rhodes / warm pad-horn for bass & sad cues
        env_p = (t / 0.015) if t < 0.015 else math.exp(-3.2 * (t - 0.015) / dur)
        return (0.65 * math.sin(w * t) + 0.25 * math.sin(2 * w * t) + 0.12 * math.sin(3 * w * t)) * env_p
    return 0.0


def render(events, total_dur, reverb=0.22):
    n = int(SR * total_dur)
    buf = [0.0] * n
    for freq, start, dur, kind, gain in events:
        i0 = int(start * SR)
        i1 = min(n, int((start + dur) * SR))
        for i in range(i0, i1):
            buf[i] += gain * note_sample(freq, (i - i0) / SR, dur, kind)
    # Two-tap room reflection for natural space
    if reverb > 0:
        d1, d2 = int(0.029 * SR), int(0.053 * SR)
        for i in range(n):
            if i >= d1:
                buf[i] += reverb * 0.6 * buf[i - d1]
            if i >= d2:
                buf[i] += reverb * 0.35 * buf[i - d2]
    peak = max(max(abs(x) for x in buf), 1e-6)
    scale = min(1.0, 0.92 / peak)
    return [int(max(-1.0, min(1.0, x * scale)) * 32767) for x in buf]


def save(name, events, dur, reverb=0.22):
    samples = render(events, dur, reverb)
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(struct.pack('<' + 'h' * len(samples), *samples))


# Musical frequencies (Hz)
C4, D4, E4, F4, G4, Ab4, A4, Bb4, B4 = 261.63, 293.66, 329.63, 349.23, 392.00, 415.30, 440.00, 466.16, 493.88
C5, D5, Eb5, E5, F5, G5, A5, B5, C6, D6, E6, G6 = 523.25, 587.33, 622.25, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51, 1567.98

# 1. UI button click: crisp marimba double-pop
save('click', [
    (G5, 0.00, 0.08, 'wood', 0.6),
    (D6, 0.025, 0.09, 'wood', 0.8),
], 0.14, reverb=0.08)

# 2. Countdown tick: clean woodblock tick
save('tick', [
    (1180, 0.00, 0.07, 'wood', 0.8),
    (1760, 0.00, 0.04, 'wood', 0.4),
], 0.10, reverb=0.05)

# 3. Great guess (>= 700 pts): C major 9th celesta arpeggio + warm root
save('good', [
    (C4, 0.00, 0.55, 'warm', 0.35),
    (C5, 0.00, 0.35, 'bell', 0.55),
    (E5, 0.06, 0.35, 'bell', 0.55),
    (G5, 0.12, 0.40, 'bell', 0.60),
    (B5, 0.18, 0.42, 'bell', 0.55),
    (C6, 0.24, 0.55, 'bell', 0.75),
    (G6, 0.30, 0.45, 'bell', 0.35),
], 0.85)

# 4. Okay guess (1..699 pts): pleasant two-step chime (F -> G major)
save('ok', [
    (F4, 0.00, 0.25, 'warm', 0.30),
    (A4, 0.00, 0.25, 'bell', 0.50),
    (C5, 0.03, 0.25, 'bell', 0.50),
    (G4, 0.14, 0.38, 'warm', 0.35),
    (B4, 0.14, 0.38, 'bell', 0.55),
    (D5, 0.17, 0.38, 'bell', 0.65),
], 0.58)

# 5. Miss / timeout (0 pts): soft descending muted interval
save('bad', [
    (E4, 0.00, 0.22, 'warm', 0.45),
    (Bb4, 0.00, 0.20, 'bell', 0.35),
    (C4, 0.16, 0.40, 'warm', 0.55),
    (F4, 0.16, 0.36, 'bell', 0.35),
], 0.60)

# 6. Round passed fanfare
save('win', [
    (C4, 0.00, 0.30, 'warm', 0.35), (C5, 0.00, 0.22, 'bell', 0.60), (E5, 0.00, 0.22, 'bell', 0.40),
    (G5, 0.12, 0.22, 'bell', 0.60),
    (E5, 0.24, 0.22, 'bell', 0.55),
    (F4, 0.36, 0.30, 'warm', 0.35), (A5, 0.36, 0.26, 'bell', 0.65),
    (G4, 0.52, 0.30, 'warm', 0.35), (B5, 0.52, 0.26, 'bell', 0.65),
    (C4, 0.68, 0.65, 'warm', 0.45), (G4, 0.68, 0.65, 'warm', 0.35),
    (E5, 0.68, 0.65, 'bell', 0.50), (G5, 0.70, 0.65, 'bell', 0.50), (C6, 0.72, 0.65, 'bell', 0.80),
], 1.38)

# 7. Round failed cadence
save('lose', [
    (F4, 0.00, 0.28, 'warm', 0.35), (A4, 0.00, 0.26, 'bell', 0.50),
    (E4, 0.20, 0.28, 'warm', 0.35), (G4, 0.20, 0.26, 'bell', 0.50),
    (D4, 0.40, 0.45, 'warm', 0.45), (F4, 0.40, 0.45, 'bell', 0.55),
], 0.90)

print('Generated SFX in', OUT)
