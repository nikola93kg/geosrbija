#!/usr/bin/env python3
"""
Generates modern, studio-grade 44.1 kHz STEREO WAV sound effects (Duolingo/Kahoot-style
liquid UI pops, glassy FM-kalimba chimes, warm Rhodes pads, and stereo reverb) into assets/sfx/.
"""
import math, os, struct, wave

SR = 44100
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assets', 'sfx'))
os.makedirs(OUT, exist_ok=True)


def synth_voice(freq, t, dur, kind, pan=0.0):
    if t < 0 or t >= dur:
        return 0.0, 0.0
    w = 2 * math.pi * freq

    if kind == 'pop':
        # Modern iOS/Duolingo liquid bubble-pop: fast downward pitch sweep + clean sine body
        env = (t / 0.002) if t < 0.002 else math.exp(-38 * (t - 0.002))
        phase = w * t + 1.8 * (1 - math.exp(-70 * t))
        s = 0.85 * math.sin(phase) + 0.25 * math.sin(2 * phase) * math.exp(-60 * t)
        val = s * env

    elif kind == 'chime':
        # Glassy FM kalimba + celesta shimmer (Duolingo-style "correct" bell)
        att = 0.003
        env = (t / att) if t < att else (0.7 * math.exp(-5.5 * (t - att) / dur) + 0.3 * math.exp(-1.8 * (t - att) / dur))
        mod = 1.4 * math.exp(-18 * t) * math.sin(2.0 * w * t)
        sL = (0.60 * math.sin(w * t + mod) +
              0.25 * math.sin(2.001 * w * t) * math.exp(-4 * t) +
              0.12 * math.sin(3.002 * w * t) * math.exp(-8 * t) +
              0.06 * math.sin(5.99 * w * t) * math.exp(-22 * t))
        sR = (0.60 * math.sin(w * 1.0018 * t + mod + 0.25) +
              0.25 * math.sin(1.999 * w * t + 0.4) * math.exp(-4 * t) +
              0.12 * math.sin(2.998 * w * t) * math.exp(-8 * t) +
              0.06 * math.sin(6.01 * w * t) * math.exp(-22 * t))
        # Crisp pluck transient
        if t < 0.005:
            trans = 0.30 * math.sin(4.5 * w * t) * (1 - t / 0.005)
            sL += trans
            sR += trans
        return sL * env * (1 - 0.3 * pan), sR * env * (1 + 0.3 * pan)

    elif kind == 'pad':
        # Warm stereo Rhodes / Neo-soul electric piano chord layer
        att = 0.012
        env = (t / att) if t < att else math.exp(-2.8 * (t - att) / dur)
        mod = 0.45 * math.exp(-6 * t) * math.sin(w * t)
        sL = 0.70 * math.sin(w * t + mod) + 0.20 * math.sin(2 * w * t) * math.exp(-3 * t)
        sR = 0.70 * math.sin(w * 1.0015 * t + mod + 0.35) + 0.20 * math.sin(2 * w * 0.999 * t) * math.exp(-3 * t)
        return sL * env, sR * env

    elif kind == 'bonk':
        # Soft, rounded low-mid marimba/wood bonk for wrong/timeout (warm, never harsh)
        env = (t / 0.004) if t < 0.004 else math.exp(-9.0 * (t - 0.004) / dur)
        sweep = w * t - 0.5 * math.exp(-40 * t)
        s = 0.78 * math.sin(sweep) + 0.22 * math.sin(2 * sweep) * math.exp(-15 * t)
        val = s * env

    elif kind == 'sparkle':
        # High fairy/glockenspiel sparkle
        env = (t / 0.002) if t < 0.002 else math.exp(-9.0 * (t - 0.002) / dur)
        sL = math.sin(w * t) + 0.3 * math.sin(2 * w * t)
        sR = math.sin(w * 1.003 * t + 0.5) + 0.3 * math.sin(2 * w * 0.997 * t)
        return sL * env * (1 - 0.4 * pan), sR * env * (1 + 0.4 * pan)
    else:
        val = 0.0

    gL = math.cos((pan + 1) * math.pi / 4)
    gR = math.sin((pan + 1) * math.pi / 4)
    return val * gL, val * gR


def render_stereo(events, total_dur, reverb=0.25):
    n = int(SR * total_dur)
    L = [0.0] * n
    R = [0.0] * n
    for ev in events:
        freq, start, dur, kind, gain = ev[:5]
        pan = ev[5] if len(ev) > 5 else 0.0
        i0 = int(start * SR)
        i1 = min(n, int((start + dur) * SR))
        inv_sr = 1.0 / SR
        for i in range(i0, i1):
            sL, sR = synth_voice(freq, (i - i0) * inv_sr, dur, kind, pan)
            L[i] += gain * sL
            R[i] += gain * sR

    # Lush stereo multi-tap studio room diffusion (cross-fed L/R reflections)
    if reverb > 0:
        taps = [(int(0.023 * SR), 0.45), (int(0.041 * SR), 0.32), (int(0.067 * SR), 0.22), (int(0.097 * SR), 0.14)]
        for delay, fb in taps:
            g = reverb * fb
            for i in range(delay, n):
                l_prev = L[i - delay]
                r_prev = R[i - delay]
                L[i] += g * (0.7 * l_prev + 0.3 * r_prev)
                R[i] += g * (0.7 * r_prev + 0.3 * l_prev)

    peak = max(max(abs(x) for x in L), max(abs(x) for x in R), 1e-6)
    scale = min(1.0, 0.92 / peak)
    out = bytearray(n * 4)
    for i in range(n):
        l_int = int(max(-1.0, min(1.0, L[i] * scale)) * 32767)
        r_int = int(max(-1.0, min(1.0, R[i] * scale)) * 32767)
        struct.pack_into('<hh', out, i * 4, l_int, r_int)
    return bytes(out)


def save(name, events, dur, reverb=0.25):
    pcm = render_stereo(events, dur, reverb)
    path = os.path.join(OUT, name + '.wav')
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm)


# Notes (Hz)
C3, F3, G3, A3 = 130.81, 174.61, 196.00, 220.00
C4, D4, Eb4, E4, F4, G4, A4, Bb4, B4 = 261.63, 293.66, 311.13, 329.63, 349.23, 392.00, 440.00, 466.16, 493.88
C5, D5, E5, F5, G5, A5, B5 = 523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77
C6, D6, E6, G6, A6 = 1046.50, 1174.66, 1318.51, 1567.98, 1760.00

# 1. click.wav: Modern tactile liquid UI pop
save('click', [
    (520, 0.000, 0.05, 'pop', 0.55, -0.15),
    (1040, 0.012, 0.06, 'pop', 0.70, 0.15),
], 0.09, reverb=0.06)

# 2. tap.wav: Map pin drop (soft low thump + bright droplet plink)
save('tap', [
    (190, 0.000, 0.06, 'pop', 0.65, 0.0),
    (784, 0.015, 0.12, 'chime', 0.60, 0.1),
    (1175, 0.030, 0.10, 'sparkle', 0.35, -0.1),
], 0.16, reverb=0.12)

# 3. tick.wav: Soft modern countdown pulse
save('tick', [
    (320, 0.000, 0.04, 'pop', 0.40, 0.0),
    (988, 0.000, 0.06, 'pop', 0.65, 0.0),
], 0.08, reverb=0.05)

# 4. good.wav: Duolingo-inspired sparkling two-step major lift + shimmer
save('good', [
    # Warm major chord bed
    (C4, 0.00, 0.60, 'pad', 0.30, 0.0),
    (E4, 0.00, 0.60, 'pad', 0.22, -0.3),
    (G4, 0.00, 0.60, 'pad', 0.22, 0.3),
    # Crisp rising chime melody (G5 -> C6 -> E6)
    (G5, 0.00, 0.32, 'chime', 0.65, -0.25),
    (C6, 0.09, 0.40, 'chime', 0.72, 0.0),
    (E6, 0.18, 0.55, 'chime', 0.85, 0.25),
    (G6, 0.24, 0.45, 'sparkle', 0.35, -0.2),
], 0.78, reverb=0.28)

# 5. ok.wav: Pleasant encouraging double chime (Fmaj7 -> G6)
save('ok', [
    (F4, 0.00, 0.35, 'pad', 0.28, -0.2),
    (A4, 0.00, 0.35, 'pad', 0.24, 0.2),
    (C5, 0.00, 0.25, 'chime', 0.60, -0.2),
    (D5, 0.11, 0.38, 'chime', 0.65, 0.0),
    (G5, 0.11, 0.40, 'chime', 0.72, 0.25),
], 0.55, reverb=0.22)

# 6. bad.wav: Soft, warm muted double-bonk (no harsh buzz)
save('bad', [
    (A3, 0.00, 0.22, 'pad', 0.35, 0.0),
    (E4, 0.00, 0.18, 'bonk', 0.65, -0.15),
    (F3, 0.14, 0.34, 'pad', 0.40, 0.0),
    (B4 * 0.5, 0.14, 0.32, 'bonk', 0.70, 0.15),
], 0.50, reverb=0.16)

# 7. win.wav: Celebratory stereo victory fanfare with sparkle cascade
save('win', [
    (C4, 0.00, 0.35, 'pad', 0.32, 0.0),
    (C5, 0.00, 0.24, 'chime', 0.65, -0.3),
    (E5, 0.09, 0.24, 'chime', 0.65, 0.0),
    (G5, 0.18, 0.24, 'chime', 0.70, 0.3),
    (F4, 0.28, 0.30, 'pad', 0.30, -0.2),
    (A5, 0.28, 0.26, 'chime', 0.72, -0.2),
    (G4, 0.40, 0.30, 'pad', 0.30, 0.2),
    (B5, 0.40, 0.26, 'chime', 0.75, 0.2),
    # Grand C major 9 resolution + sparkle
    (C3, 0.54, 0.75, 'pad', 0.38, 0.0),
    (G4, 0.54, 0.75, 'pad', 0.30, -0.3),
    (E5, 0.54, 0.70, 'pad', 0.30, 0.3),
    (C6, 0.54, 0.72, 'chime', 0.85, 0.0),
    (D6, 0.62, 0.55, 'sparkle', 0.40, -0.35),
    (E6, 0.68, 0.55, 'sparkle', 0.45, 0.35),
    (G6, 0.74, 0.55, 'sparkle', 0.50, 0.0),
], 1.32, reverb=0.32)

# 8. lose.wav: Gentle warm descending resolve
save('lose', [
    (D4, 0.00, 0.35, 'pad', 0.30, -0.2),
    (A4, 0.00, 0.28, 'chime', 0.55, -0.2),
    (G4, 0.18, 0.28, 'chime', 0.55, 0.0),
    (C4, 0.36, 0.48, 'pad', 0.38, 0.0),
    (E4, 0.36, 0.48, 'pad', 0.28, 0.2),
    (F4, 0.36, 0.45, 'chime', 0.58, 0.2),
], 0.86, reverb=0.25)

print('Generated 44.1kHz stereo SFX in', OUT)
