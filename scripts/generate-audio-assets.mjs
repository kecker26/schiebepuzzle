import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const MUSIC_DIR = path.join(ROOT, 'public', 'audio', 'music')
const SFX_DIR = path.join(ROOT, 'public', 'audio', 'sfx')
const SAMPLE_RATE = 22050
const TWO_PI = Math.PI * 2

function createRng(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

function clamp(value, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function oscillator(wave, phase) {
  const wrappedPhase = phase % 1
  switch (wave) {
    case 'triangle':
      return 1 - 4 * Math.abs(wrappedPhase - 0.5)
    case 'square':
      return wrappedPhase < 0.5 ? 1 : -1
    case 'saw':
      return wrappedPhase * 2 - 1
    default:
      return Math.sin(TWO_PI * wrappedPhase)
  }
}

function addStereoDelay(samples, delaySeconds, feedback, mix) {
  const delaySamples = Math.max(1, Math.round(delaySeconds * SAMPLE_RATE))
  const delayed = new Float32Array(samples.length)

  for (let index = delaySamples; index < samples.length; index += 1) {
    delayed[index] = samples[index - delaySamples] * mix + delayed[index - delaySamples] * feedback
  }

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] += delayed[index]
  }
}

function addTone(samples, options) {
  const {
    startSeconds,
    durationSeconds,
    frequency,
    gain,
    wave = 'sine',
    attackSeconds = 0.02,
    releaseSeconds = 0.2,
    frequencyDrift = 0,
    vibratoDepth = 0,
    vibratoRate = 0,
    phaseOffset = 0,
  } = options

  const startIndex = Math.max(0, Math.floor(startSeconds * SAMPLE_RATE))
  const endIndex = Math.min(samples.length, Math.ceil((startSeconds + durationSeconds) * SAMPLE_RATE))
  if (endIndex <= startIndex) return

  let phase = phaseOffset
  for (let index = startIndex; index < endIndex; index += 1) {
    const elapsed = (index - startIndex) / SAMPLE_RATE
    const remaining = durationSeconds - elapsed
    const attack = attackSeconds <= 0 ? 1 : Math.min(1, elapsed / attackSeconds)
    const release = releaseSeconds <= 0 ? 1 : Math.min(1, Math.max(remaining, 0) / releaseSeconds)
    const envelope = Math.sin((attack * Math.PI) / 2) * Math.sin((release * Math.PI) / 2)
    if (envelope <= 0) continue

    const vibrato =
      vibratoDepth > 0 && vibratoRate > 0 ? Math.sin(TWO_PI * elapsed * vibratoRate) * vibratoDepth : 0
    const currentFrequency = Math.max(8, frequency + frequencyDrift * elapsed + vibrato)
    phase += currentFrequency / SAMPLE_RATE
    samples[index] += oscillator(wave, phase) * gain * envelope
  }
}

function addBell(samples, options) {
  const { startSeconds, durationSeconds, frequency, gain } = options
  addTone(samples, {
    startSeconds,
    durationSeconds,
    frequency,
    gain,
    wave: 'sine',
    attackSeconds: 0.01,
    releaseSeconds: durationSeconds * 0.88,
    vibratoDepth: 0.6,
    vibratoRate: 5.2,
  })
  addTone(samples, {
    startSeconds,
    durationSeconds,
    frequency: frequency * 2,
    gain: gain * 0.4,
    wave: 'triangle',
    attackSeconds: 0.01,
    releaseSeconds: durationSeconds * 0.7,
  })
  addTone(samples, {
    startSeconds,
    durationSeconds,
    frequency: frequency * 3,
    gain: gain * 0.15,
    wave: 'sine',
    attackSeconds: 0.01,
    releaseSeconds: durationSeconds * 0.55,
  })
}

function addNoise(samples, options) {
  const { startSeconds, durationSeconds, gain, rng, highpass = 0.88 } = options
  const startIndex = Math.max(0, Math.floor(startSeconds * SAMPLE_RATE))
  const endIndex = Math.min(samples.length, Math.ceil((startSeconds + durationSeconds) * SAMPLE_RATE))
  let previous = 0

  for (let index = startIndex; index < endIndex; index += 1) {
    const elapsed = (index - startIndex) / SAMPLE_RATE
    const progress = durationSeconds <= 0 ? 1 : elapsed / durationSeconds
    const envelope = Math.pow(Math.max(0, 1 - progress), 1.8)
    const white = (rng() * 2 - 1) * gain * envelope
    const filtered = white - previous * highpass
    previous = white
    samples[index] += filtered
  }
}

function normalize(samples, peak = 0.9) {
  let maxAmplitude = 0
  for (const sample of samples) {
    const amplitude = Math.abs(sample)
    if (amplitude > maxAmplitude) {
      maxAmplitude = amplitude
    }
  }

  if (maxAmplitude === 0) return

  const scale = peak / maxAmplitude
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = clamp(samples[index] * scale)
  }
}

function softClip(samples, drive = 1) {
  if (drive <= 1) return
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.tanh(samples[index] * drive)
  }
}

async function writeWav(filePath, samples) {
  const dataLength = samples.length * 2
  const buffer = Buffer.alloc(44 + dataLength)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataLength, 40)

  for (let index = 0; index < samples.length; index += 1) {
    const value = clamp(samples[index])
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2)
  }

  await fs.writeFile(filePath, buffer)
}

function getChordIntervals(quality) {
  switch (quality) {
    case 'minor':
      return [0, 3, 7, 12]
    case 'minor7':
      return [0, 3, 7, 10]
    case 'sus2':
      return [0, 2, 7, 12]
    case 'dom7':
      return [0, 4, 7, 10]
    case 'power':
      return [0, 7, 12]
    default:
      return [0, 4, 7, 12]
  }
}

function buildChordFrequencies(rootMidi, quality, octaveShift = 0) {
  return getChordIntervals(quality).map((interval) => midiToFrequency(rootMidi + octaveShift + interval))
}

function readScaleInterval(scale, degree) {
  const length = Math.max(1, scale.length)
  const wrapped = ((degree % length) + length) % length
  const octaveOffset = Math.floor(degree / length) * 12
  return scale[wrapped] + octaveOffset
}

function addChordHit(samples, rng, options) {
  const {
    startSeconds,
    durationSeconds,
    frequencies,
    gain,
    wave,
    spreadSeconds,
    attackSeconds,
    releaseSeconds,
    harmonicGain,
    octaveSubGain,
  } = options

  frequencies.forEach((frequency, index) => {
    const start = startSeconds + spreadSeconds * index
    const gainScale = index === 0 ? 1 : 0.86
    addTone(samples, {
      startSeconds: start,
      durationSeconds,
      frequency,
      gain: gain * gainScale,
      wave,
      attackSeconds,
      releaseSeconds,
      phaseOffset: rng(),
    })

    if (harmonicGain > 0) {
      addTone(samples, {
        startSeconds: start,
        durationSeconds: durationSeconds * 0.92,
        frequency: frequency * 2,
        gain: gain * gainScale * harmonicGain,
        wave: wave === 'sine' ? 'triangle' : wave,
        attackSeconds,
        releaseSeconds: releaseSeconds * 0.85,
        phaseOffset: rng(),
      })
    }
  })

  if (octaveSubGain > 0 && frequencies.length > 0) {
    addTone(samples, {
      startSeconds,
      durationSeconds: durationSeconds * 0.9,
      frequency: frequencies[0] * 0.5,
      gain: gain * octaveSubGain,
      wave: 'sine',
      attackSeconds,
      releaseSeconds: releaseSeconds * 1.15,
      phaseOffset: rng(),
    })
  }
}

function addBassHit(samples, rng, options) {
  const { startSeconds, durationSeconds, frequency, gain, wave, frequencyDrift = -18 } = options
  addTone(samples, {
    startSeconds,
    durationSeconds,
    frequency,
    gain,
    wave,
    attackSeconds: 0.004,
    releaseSeconds: 0.12,
    frequencyDrift,
    phaseOffset: rng(),
  })
  addTone(samples, {
    startSeconds,
    durationSeconds: durationSeconds * 0.8,
    frequency: frequency * 0.5,
    gain: gain * 0.45,
    wave: 'sine',
    attackSeconds: 0.004,
    releaseSeconds: 0.14,
    phaseOffset: rng(),
  })
}

function addKick(samples, rng, options) {
  const { startSeconds, gain, bodyFrequency } = options
  addTone(samples, {
    startSeconds,
    durationSeconds: 0.22,
    frequency: bodyFrequency,
    gain,
    wave: 'sine',
    attackSeconds: 0.001,
    releaseSeconds: 0.12,
    frequencyDrift: -bodyFrequency * 1.1,
    phaseOffset: rng(),
  })
  addNoise(samples, {
    startSeconds,
    durationSeconds: 0.035,
    gain: gain * 0.18,
    rng,
    highpass: 0.28,
  })
}

function addSnare(samples, rng, options) {
  const { startSeconds, gain, toneFrequency } = options
  addNoise(samples, {
    startSeconds,
    durationSeconds: 0.12,
    gain,
    rng,
    highpass: 0.94,
  })
  addTone(samples, {
    startSeconds,
    durationSeconds: 0.11,
    frequency: toneFrequency,
    gain: gain * 0.4,
    wave: 'triangle',
    attackSeconds: 0.003,
    releaseSeconds: 0.08,
    frequencyDrift: -toneFrequency * 0.5,
    phaseOffset: rng(),
  })
}

function addHiHat(samples, rng, options) {
  const { startSeconds, gain, open = false } = options
  addNoise(samples, {
    startSeconds,
    durationSeconds: open ? 0.09 : 0.04,
    gain,
    rng,
    highpass: 0.985,
  })
}

function addLeadVoice(samples, rng, options) {
  const { startSeconds, durationSeconds, frequency, gain, wave, style, vibratoDepth, vibratoRate } = options
  if (style === 'bell') {
    addBell(samples, { startSeconds, durationSeconds, frequency, gain })
    return
  }

  addTone(samples, {
    startSeconds,
    durationSeconds,
    frequency,
    gain,
    wave,
    attackSeconds: 0.01,
    releaseSeconds: Math.max(0.09, durationSeconds * 0.55),
    vibratoDepth,
    vibratoRate,
    phaseOffset: rng(),
  })
  addTone(samples, {
    startSeconds,
    durationSeconds,
    frequency: frequency * 2,
    gain: gain * 0.22,
    wave: wave === 'square' ? 'triangle' : wave,
    attackSeconds: 0.01,
    releaseSeconds: Math.max(0.07, durationSeconds * 0.4),
    phaseOffset: rng(),
  })
}

function applyDrums(samples, rng, barStartSeconds, beatSeconds, blueprint) {
  ;(blueprint.kickPattern ?? []).forEach((position) => {
    addKick(samples, rng, {
      startSeconds: barStartSeconds + position * beatSeconds,
      gain: blueprint.kickGain ?? 0.1,
      bodyFrequency: blueprint.kickFrequency ?? 72,
    })
  })
  ;(blueprint.snarePattern ?? []).forEach((position) => {
    addSnare(samples, rng, {
      startSeconds: barStartSeconds + position * beatSeconds,
      gain: blueprint.snareGain ?? 0.09,
      toneFrequency: blueprint.snareFrequency ?? 190,
    })
  })
  ;(blueprint.hatPattern ?? []).forEach((position) => {
    addHiHat(samples, rng, {
      startSeconds: barStartSeconds + position * beatSeconds,
      gain: blueprint.hatGain ?? 0.03,
    })
  })
  ;(blueprint.openHatPattern ?? []).forEach((position) => {
    addHiHat(samples, rng, {
      startSeconds: barStartSeconds + position * beatSeconds,
      gain: blueprint.openHatGain ?? (blueprint.hatGain ?? 0.03) * 1.2,
      open: true,
    })
  })
}

function createStyleTrack(seed, blueprint) {
  const rng = createRng(seed)
  const samples = new Float32Array(Math.floor(blueprint.durationSeconds * SAMPLE_RATE))
  const beatSeconds = 60 / blueprint.beatsPerMinute
  const barSeconds = beatSeconds * 4
  const barCount = Math.ceil(blueprint.durationSeconds / barSeconds)
  const chordAttack = blueprint.texture === 'soft' ? 0.012 : 0.004
  const chordRelease = blueprint.texture === 'soft' ? 0.34 : blueprint.texture === 'groove' ? 0.14 : 0.1
  const chordSpread = blueprint.texture === 'soft' ? 0.012 : blueprint.texture === 'groove' ? 0.006 : 0.003
  const chordHoldBeats = blueprint.chordHoldBeats ?? (blueprint.texture === 'soft' ? 0.95 : 0.32)

  for (let bar = 0; bar < barCount; bar += 1) {
    const barStartSeconds = bar * barSeconds
    const chord = blueprint.progression[bar % blueprint.progression.length]
    const chordRootMidi = blueprint.rootMidi + chord.root
    const chordFrequencies = buildChordFrequencies(chordRootMidi, chord.quality, blueprint.chordOctaveOffset ?? 0)

    if (blueprint.texture === 'soft' && blueprint.padGain) {
      addChordHit(samples, rng, {
        startSeconds: barStartSeconds,
        durationSeconds: barSeconds * 1.55,
        frequencies: chordFrequencies,
        gain: blueprint.padGain,
        wave: blueprint.padWave ?? 'sine',
        spreadSeconds: 0.018,
        attackSeconds: 0.28,
        releaseSeconds: 0.8,
        harmonicGain: 0.08,
        octaveSubGain: 0.1,
      })
    }

    ;(blueprint.chordPattern ?? []).forEach((position, index) => {
      const swingOffset = position % 1 !== 0 ? blueprint.swing ?? 0 : 0
      addChordHit(samples, rng, {
        startSeconds: barStartSeconds + (position + swingOffset) * beatSeconds,
        durationSeconds: beatSeconds * chordHoldBeats,
        frequencies: chordFrequencies,
        gain: (blueprint.chordGain ?? 0.04) * (index % 2 === 0 ? 1 : 0.94),
        wave: blueprint.chordWave ?? 'triangle',
        spreadSeconds: chordSpread,
        attackSeconds: chordAttack,
        releaseSeconds: chordRelease,
        harmonicGain: blueprint.harmonicGain ?? (blueprint.texture === 'rock' ? 0.12 : 0.18),
        octaveSubGain: blueprint.subChordGain ?? 0.14,
      })
    })

    ;(blueprint.bassPattern ?? []).forEach((position, index) => {
      const bassIntervals = blueprint.bassIntervals ?? [0]
      const intervalOffset = bassIntervals[index % bassIntervals.length]
      addBassHit(samples, rng, {
        startSeconds: barStartSeconds + position * beatSeconds,
        durationSeconds: beatSeconds * (blueprint.bassHoldBeats ?? 0.62),
        frequency: midiToFrequency(chordRootMidi - 12 + intervalOffset + (blueprint.bassOctaveOffset ?? 0)),
        gain: blueprint.bassGain ?? 0.07,
        wave: blueprint.bassWave ?? 'sine',
        frequencyDrift: blueprint.bassDrift ?? -18,
      })
    })

    applyDrums(samples, rng, barStartSeconds, beatSeconds, blueprint)

    const leadDegrees = blueprint.leadPattern[bar % blueprint.leadPattern.length] ?? []
    leadDegrees.forEach((degree, index) => {
      const position = blueprint.leadPositions[index % blueprint.leadPositions.length] ?? index
      addLeadVoice(samples, rng, {
        startSeconds: barStartSeconds + position * beatSeconds + (rng() - 0.5) * 0.01,
        durationSeconds: beatSeconds * (blueprint.leadHoldBeats ?? 0.55),
        frequency: midiToFrequency(
          chordRootMidi + (blueprint.leadOctaveOffset ?? 12) + readScaleInterval(blueprint.scale, degree)
        ),
        gain: blueprint.leadGain ?? 0.03,
        wave: blueprint.leadWave ?? 'triangle',
        style: blueprint.leadStyle ?? 'tone',
        vibratoDepth: blueprint.leadVibratoDepth ?? 0.2,
        vibratoRate: blueprint.leadVibratoRate ?? 4.8,
      })
    })
  }

  if (blueprint.noiseBedGain) {
    addNoise(samples, {
      startSeconds: 0,
      durationSeconds: blueprint.durationSeconds,
      gain: blueprint.noiseBedGain,
      rng,
      highpass: blueprint.noiseBedHighpass ?? 0.96,
    })
  }

  if (blueprint.delayA) {
    addStereoDelay(samples, blueprint.delayA.seconds, blueprint.delayA.feedback, blueprint.delayA.mix)
  }
  if (blueprint.delayB) {
    addStereoDelay(samples, blueprint.delayB.seconds, blueprint.delayB.feedback, blueprint.delayB.mix)
  }

  softClip(samples, blueprint.clipDrive ?? 1)
  normalize(samples, blueprint.peak ?? 0.9)
  return samples
}

function createMoveSound(seed, options) {
  const rng = createRng(seed)
  const durationSeconds = 0.16
  const samples = new Float32Array(Math.floor(durationSeconds * SAMPLE_RATE))
  addNoise(samples, {
    startSeconds: 0,
    durationSeconds: 0.08,
    gain: 0.045 + options.variant * 0.004,
    rng,
    highpass: 0.78,
  })
  addTone(samples, {
    startSeconds: 0,
    durationSeconds,
    frequency: 260 + options.variant * 42,
    gain: 0.09,
    wave: options.variant % 2 === 0 ? 'triangle' : 'sine',
    attackSeconds: 0.002,
    releaseSeconds: 0.1,
    frequencyDrift: -460,
  })
  addTone(samples, {
    startSeconds: 0.01,
    durationSeconds: 0.09,
    frequency: 540 + options.variant * 32,
    gain: 0.03,
    wave: 'sine',
    attackSeconds: 0.002,
    releaseSeconds: 0.06,
    frequencyDrift: -720,
  })
  normalize(samples, 0.92)
  return samples
}

function createCorrectSound(seed, options) {
  const rng = createRng(seed)
  const durationSeconds = 1.35
  const samples = new Float32Array(Math.floor(durationSeconds * SAMPLE_RATE))
  ;[0, 4, 7, 11].forEach((interval, index) => {
    addBell(samples, {
      startSeconds: index * 0.06,
      durationSeconds: 0.95 + index * 0.08,
      frequency: midiToFrequency(options.rootMidi + interval),
      gain: index === 0 ? 0.12 : 0.07,
    })
  })
  for (let index = 0; index < 4; index += 1) {
    addTone(samples, {
      startSeconds: 0.24 + index * 0.16,
      durationSeconds: 0.52 + rng() * 0.28,
      frequency: midiToFrequency(options.rootMidi + 12 + [7, 11, 14, 16][index]),
      gain: 0.024,
      wave: 'triangle',
      attackSeconds: 0.03,
      releaseSeconds: 0.4,
      vibratoDepth: 0.36,
      vibratoRate: 5.5,
    })
  }
  addStereoDelay(samples, 0.19, 0.32, 0.22)
  normalize(samples, 0.9)
  return samples
}

function createWinSound(seed) {
  const rng = createRng(seed)
  const durationSeconds = 3.35
  const samples = new Float32Array(Math.floor(durationSeconds * SAMPLE_RATE))
  ;[0, 5, 7, 12].forEach((interval, index) => {
    const startSeconds = index * 0.54
    addBell(samples, {
      startSeconds,
      durationSeconds: 1.05,
      frequency: midiToFrequency(62 + interval),
      gain: 0.11,
    })
    addBell(samples, {
      startSeconds: startSeconds + 0.08,
      durationSeconds: 0.9,
      frequency: midiToFrequency(69 + interval),
      gain: 0.06,
    })
    addTone(samples, {
      startSeconds,
      durationSeconds: 1.55,
      frequency: midiToFrequency(50 + interval),
      gain: 0.05,
      wave: 'sine',
      attackSeconds: 0.02,
      releaseSeconds: 0.9,
      phaseOffset: rng(),
    })
  })

  for (let sparkle = 0; sparkle < 10; sparkle += 1) {
    addTone(samples, {
      startSeconds: 0.3 + sparkle * 0.23 + rng() * 0.08,
      durationSeconds: 0.42,
      frequency: midiToFrequency(81 + (sparkle % 5) * 2),
      gain: 0.028,
      wave: 'triangle',
      attackSeconds: 0.005,
      releaseSeconds: 0.26,
      frequencyDrift: 18,
      vibratoDepth: 1.4,
      vibratoRate: 7.2,
    })
  }

  addNoise(samples, {
    startSeconds: 0,
    durationSeconds: 0.5,
    gain: 0.022,
    rng,
    highpass: 0.95,
  })
  addStereoDelay(samples, 0.24, 0.34, 0.26)
  addStereoDelay(samples, 0.39, 0.24, 0.18)
  normalize(samples, 0.92)
  return samples
}

const EIGHTS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
const SIXTEENTHS = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]

const styleBlueprints = [
  {
    fileName: 'acoustic-pop-breeze.wav',
    texture: 'soft',
    durationSeconds: 22,
    beatsPerMinute: 98,
    rootMidi: 57,
    scale: [0, 2, 4, 7, 9],
    progression: [{ root: 0, quality: 'major' }, { root: 5, quality: 'major' }, { root: 7, quality: 'sus2' }, { root: 9, quality: 'minor' }],
    chordPattern: [0, 1.5, 2, 3.5],
    bassPattern: [0, 1.5, 2, 3.5],
    bassIntervals: [0, 0, 7, 0],
    kickPattern: [0, 2],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [3.5],
    leadPattern: [[0, 2, 4, 2], [1, 2, 4, 5], [2, 4, 5, 2], [1, 0, 2, 4]],
    leadPositions: [0.25, 1.25, 2.25, 3.25],
    chordWave: 'triangle',
    bassWave: 'sine',
    leadWave: 'triangle',
    chordGain: 0.04,
    bassGain: 0.065,
    leadGain: 0.028,
    kickGain: 0.09,
    snareGain: 0.075,
    hatGain: 0.03,
    padGain: 0.014,
    padWave: 'sine',
    delayA: { seconds: 0.16, feedback: 0.28, mix: 0.18 },
    delayB: { seconds: 0.31, feedback: 0.16, mix: 0.12 },
    clipDrive: 1.04,
  },
  {
    fileName: 'piano-focus.wav',
    texture: 'soft',
    durationSeconds: 24,
    beatsPerMinute: 76,
    rootMidi: 60,
    scale: [0, 2, 4, 7, 9, 11],
    progression: [{ root: 0, quality: 'major' }, { root: 9, quality: 'minor7' }, { root: 5, quality: 'major' }, { root: 7, quality: 'sus2' }],
    chordPattern: [0, 1, 2, 3],
    bassPattern: [0, 2],
    bassIntervals: [0, 0],
    leadPattern: [[0, 2, 4, 5], [2, 4, 5, 4], [1, 3, 4, 2], [0, 2, 1, 4]],
    leadPositions: [0.2, 1.15, 2.1, 3.05],
    chordWave: 'sine',
    bassWave: 'sine',
    leadStyle: 'bell',
    chordGain: 0.03,
    bassGain: 0.05,
    leadGain: 0.024,
    padGain: 0.018,
    padWave: 'triangle',
    chordHoldBeats: 1.1,
    bassHoldBeats: 0.9,
    leadHoldBeats: 0.9,
    delayA: { seconds: 0.22, feedback: 0.33, mix: 0.24 },
    delayB: { seconds: 0.37, feedback: 0.18, mix: 0.14 },
    peak: 0.86,
  },
  {
    fileName: 'blues-lane.wav',
    texture: 'soft',
    durationSeconds: 23,
    beatsPerMinute: 96,
    rootMidi: 52,
    scale: [0, 3, 5, 6, 7, 10],
    progression: [{ root: 0, quality: 'dom7' }, { root: 5, quality: 'dom7' }, { root: 7, quality: 'dom7' }, { root: 0, quality: 'dom7' }],
    chordPattern: [0, 0.67, 1.5, 2.17, 3],
    bassPattern: [0, 1, 2, 3],
    bassIntervals: [0, 7, 0, 10],
    kickPattern: [0, 2],
    snarePattern: [1, 3],
    hatPattern: [0, 0.67, 1, 1.67, 2, 2.67, 3, 3.67],
    leadPattern: [[0, 2, 3, 5], [0, 3, 5, 3], [2, 3, 5, 4], [0, 2, 0, 5]],
    leadPositions: [0.25, 1.05, 2.1, 3.15],
    chordWave: 'triangle',
    bassWave: 'triangle',
    leadWave: 'saw',
    chordGain: 0.043,
    bassGain: 0.075,
    leadGain: 0.03,
    kickGain: 0.1,
    snareGain: 0.085,
    hatGain: 0.028,
    padGain: 0.01,
    swing: 0.07,
    leadVibratoDepth: 0.35,
    leadVibratoRate: 5.2,
    delayA: { seconds: 0.14, feedback: 0.24, mix: 0.15 },
    delayB: { seconds: 0.27, feedback: 0.15, mix: 0.1 },
    clipDrive: 1.08,
  },
  {
    fileName: 'folk-pop-trail.wav',
    texture: 'soft',
    durationSeconds: 22,
    beatsPerMinute: 92,
    rootMidi: 55,
    scale: [0, 2, 4, 5, 7, 9, 11],
    progression: [{ root: 0, quality: 'major' }, { root: 7, quality: 'major' }, { root: 9, quality: 'minor' }, { root: 5, quality: 'sus2' }],
    chordPattern: [0, 1, 2, 3],
    bassPattern: [0, 2],
    bassIntervals: [0, 7],
    kickPattern: [0, 2],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [3.5],
    leadPattern: [[0, 1, 4, 2], [1, 2, 4, 5], [2, 4, 5, 4], [1, 0, 2, 4]],
    leadPositions: [0.35, 1.3, 2.25, 3.2],
    chordWave: 'triangle',
    bassWave: 'sine',
    leadWave: 'triangle',
    chordGain: 0.038,
    bassGain: 0.062,
    leadGain: 0.026,
    kickGain: 0.085,
    snareGain: 0.07,
    hatGain: 0.03,
    padGain: 0.012,
    delayA: { seconds: 0.17, feedback: 0.28, mix: 0.17 },
    delayB: { seconds: 0.3, feedback: 0.14, mix: 0.1 },
    clipDrive: 1.03,
  },
  {
    fileName: 'reggae-sun.wav',
    texture: 'groove',
    durationSeconds: 23,
    beatsPerMinute: 82,
    rootMidi: 50,
    scale: [0, 2, 4, 5, 7, 9, 10],
    progression: [{ root: 0, quality: 'major' }, { root: 5, quality: 'major' }, { root: 7, quality: 'major' }, { root: 0, quality: 'major' }],
    chordPattern: [0.5, 1.5, 2.5, 3.5],
    bassPattern: [0, 1.75, 2, 3.75],
    bassIntervals: [0, 0, 7, 0],
    kickPattern: [0, 2.5],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [3.5],
    leadPattern: [[0, 2, 1, 0], [2, 4, 2, 1], [4, 2, 1, 0], [2, 1, 0, 2]],
    leadPositions: [0.25, 1.25, 2.25, 3.25],
    chordWave: 'square',
    bassWave: 'triangle',
    leadWave: 'triangle',
    chordGain: 0.032,
    bassGain: 0.082,
    leadGain: 0.022,
    kickGain: 0.11,
    snareGain: 0.09,
    hatGain: 0.026,
    chordHoldBeats: 0.26,
    bassHoldBeats: 0.7,
    leadHoldBeats: 0.42,
    delayA: { seconds: 0.21, feedback: 0.22, mix: 0.13 },
    delayB: { seconds: 0.38, feedback: 0.12, mix: 0.08 },
    clipDrive: 1.07,
  },
  {
    fileName: 'ska-skank.wav',
    texture: 'groove',
    durationSeconds: 21,
    beatsPerMinute: 148,
    rootMidi: 55,
    scale: [0, 2, 4, 5, 7, 9, 10],
    progression: [{ root: 0, quality: 'major' }, { root: 7, quality: 'major' }, { root: 9, quality: 'minor' }, { root: 5, quality: 'major' }],
    chordPattern: [0.5, 1.5, 2.5, 3.5],
    bassPattern: [0, 1, 2, 3],
    bassIntervals: [0, 7, 0, 10],
    kickPattern: [0, 1.5, 2, 3.25],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [3.5],
    leadPattern: [[4, 2, 0, 2], [5, 4, 2, 0], [4, 2, 1, 0], [2, 4, 5, 2]],
    leadPositions: [0.1, 1.1, 2.1, 3.1],
    chordWave: 'square',
    bassWave: 'triangle',
    leadWave: 'triangle',
    chordGain: 0.03,
    bassGain: 0.08,
    leadGain: 0.022,
    kickGain: 0.11,
    snareGain: 0.095,
    hatGain: 0.03,
    chordHoldBeats: 0.2,
    bassHoldBeats: 0.5,
    leadHoldBeats: 0.28,
    delayA: { seconds: 0.13, feedback: 0.2, mix: 0.12 },
    delayB: { seconds: 0.24, feedback: 0.12, mix: 0.08 },
    clipDrive: 1.12,
  },
  {
    fileName: 'brit-pop-bounce.wav',
    texture: 'groove',
    durationSeconds: 22,
    beatsPerMinute: 118,
    rootMidi: 57,
    scale: [0, 2, 4, 5, 7, 9, 11],
    progression: [{ root: 0, quality: 'major' }, { root: 7, quality: 'major' }, { root: 9, quality: 'minor' }, { root: 5, quality: 'major' }],
    chordPattern: EIGHTS,
    bassPattern: [0, 1, 2, 3],
    bassIntervals: [0, 7, 0, 7],
    kickPattern: [0, 2.5],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [3.5],
    leadPattern: [[0, 2, 4, 5], [2, 4, 5, 4], [4, 5, 4, 2], [2, 1, 0, 4]],
    leadPositions: [0.2, 1.05, 2.05, 3.1],
    chordWave: 'triangle',
    bassWave: 'triangle',
    leadWave: 'triangle',
    chordGain: 0.032,
    bassGain: 0.073,
    leadGain: 0.026,
    kickGain: 0.11,
    snareGain: 0.09,
    hatGain: 0.032,
    chordHoldBeats: 0.42,
    bassHoldBeats: 0.55,
    leadHoldBeats: 0.45,
    delayA: { seconds: 0.16, feedback: 0.24, mix: 0.14 },
    delayB: { seconds: 0.29, feedback: 0.14, mix: 0.09 },
    clipDrive: 1.1,
  },
  {
    fileName: 'funk-rock-jam.wav',
    texture: 'groove',
    durationSeconds: 22,
    beatsPerMinute: 116,
    rootMidi: 50,
    scale: [0, 2, 3, 5, 7, 9, 10],
    progression: [{ root: 0, quality: 'minor7' }, { root: 5, quality: 'dom7' }, { root: 7, quality: 'minor7' }, { root: 0, quality: 'minor7' }],
    chordPattern: [0, 0.75, 1.5, 2.25, 3.25],
    bassPattern: [0, 0.5, 1.5, 2, 2.75, 3.5],
    bassIntervals: [0, 7, 10, 7, 0, 7],
    kickPattern: [0, 1.5, 2.5],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [1.5, 3.5],
    leadPattern: [[0, 3, 4, 2], [2, 4, 5, 4], [0, 2, 3, 2], [4, 3, 2, 0]],
    leadPositions: [0.12, 1, 2.1, 3],
    chordWave: 'square',
    bassWave: 'saw',
    leadWave: 'triangle',
    chordGain: 0.03,
    bassGain: 0.078,
    leadGain: 0.024,
    kickGain: 0.115,
    snareGain: 0.095,
    hatGain: 0.03,
    chordHoldBeats: 0.24,
    bassHoldBeats: 0.4,
    leadHoldBeats: 0.34,
    delayA: { seconds: 0.12, feedback: 0.2, mix: 0.1 },
    delayB: { seconds: 0.27, feedback: 0.13, mix: 0.08 },
    clipDrive: 1.14,
  },
  {
    fileName: 'pop-rock-drive.wav',
    texture: 'groove',
    durationSeconds: 22,
    beatsPerMinute: 126,
    rootMidi: 55,
    scale: [0, 2, 4, 5, 7, 9, 11],
    progression: [{ root: 0, quality: 'major' }, { root: 7, quality: 'major' }, { root: 9, quality: 'minor' }, { root: 5, quality: 'major' }],
    chordPattern: EIGHTS,
    bassPattern: [0, 1, 2, 3],
    bassIntervals: [0, 7, 0, 7],
    kickPattern: [0, 2, 2.5],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [3.5],
    leadPattern: [[0, 2, 4, 3], [2, 4, 5, 4], [4, 5, 4, 2], [2, 1, 0, 2]],
    leadPositions: [0.2, 1.1, 2.1, 3.2],
    chordWave: 'triangle',
    bassWave: 'triangle',
    leadWave: 'triangle',
    chordGain: 0.034,
    bassGain: 0.074,
    leadGain: 0.026,
    kickGain: 0.118,
    snareGain: 0.095,
    hatGain: 0.032,
    chordHoldBeats: 0.38,
    bassHoldBeats: 0.48,
    leadHoldBeats: 0.42,
    delayA: { seconds: 0.14, feedback: 0.22, mix: 0.12 },
    delayB: { seconds: 0.26, feedback: 0.13, mix: 0.08 },
    clipDrive: 1.13,
  },
  {
    fileName: 'surf-rock-roll.wav',
    texture: 'groove',
    durationSeconds: 21,
    beatsPerMinute: 134,
    rootMidi: 57,
    scale: [0, 2, 4, 5, 7, 9, 10],
    progression: [{ root: 0, quality: 'major' }, { root: 7, quality: 'major' }, { root: 5, quality: 'major' }, { root: 0, quality: 'major' }],
    chordPattern: EIGHTS,
    bassPattern: [0, 1, 2, 3],
    bassIntervals: [0, 7, 0, 7],
    kickPattern: [0, 2],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [1.5, 3.5],
    leadPattern: [[5, 4, 2, 0], [4, 2, 0, 2], [5, 4, 2, 4], [7, 5, 4, 2]],
    leadPositions: [0.05, 1.05, 2.05, 3.05],
    chordWave: 'triangle',
    bassWave: 'triangle',
    leadWave: 'square',
    chordGain: 0.03,
    bassGain: 0.072,
    leadGain: 0.025,
    kickGain: 0.115,
    snareGain: 0.09,
    hatGain: 0.03,
    chordHoldBeats: 0.3,
    bassHoldBeats: 0.45,
    leadHoldBeats: 0.34,
    leadVibratoDepth: 0.5,
    leadVibratoRate: 7.2,
    delayA: { seconds: 0.11, feedback: 0.28, mix: 0.17 },
    delayB: { seconds: 0.23, feedback: 0.16, mix: 0.1 },
    clipDrive: 1.14,
  },
  {
    fileName: 'alternative-rock-pulse.wav',
    texture: 'groove',
    durationSeconds: 22,
    beatsPerMinute: 122,
    rootMidi: 48,
    scale: [0, 2, 3, 5, 7, 8, 10],
    progression: [{ root: 0, quality: 'minor' }, { root: 7, quality: 'minor' }, { root: 8, quality: 'major' }, { root: 5, quality: 'minor' }],
    chordPattern: [0, 0.5, 1, 1.5, 2.25, 3, 3.5],
    bassPattern: [0, 1, 2, 3],
    bassIntervals: [0, 7, 0, 3],
    kickPattern: [0, 2, 2.75],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [3.5],
    leadPattern: [[0, 2, 3, 5], [2, 3, 5, 3], [5, 3, 2, 0], [3, 2, 0, 2]],
    leadPositions: [0.2, 1.15, 2.2, 3.15],
    chordWave: 'saw',
    bassWave: 'triangle',
    leadWave: 'triangle',
    chordGain: 0.03,
    bassGain: 0.078,
    leadGain: 0.023,
    kickGain: 0.118,
    snareGain: 0.1,
    hatGain: 0.03,
    chordHoldBeats: 0.34,
    bassHoldBeats: 0.46,
    leadHoldBeats: 0.4,
    delayA: { seconds: 0.14, feedback: 0.23, mix: 0.13 },
    delayB: { seconds: 0.29, feedback: 0.14, mix: 0.09 },
    clipDrive: 1.18,
    noiseBedGain: 0.0006,
    noiseBedHighpass: 0.97,
  },
  {
    fileName: 'garage-rock.wav',
    texture: 'rock',
    durationSeconds: 20,
    beatsPerMinute: 148,
    rootMidi: 45,
    scale: [0, 3, 5, 7, 10],
    progression: [{ root: 0, quality: 'power' }, { root: 7, quality: 'power' }, { root: 5, quality: 'power' }, { root: 0, quality: 'power' }],
    chordPattern: [0, 0.75, 1.5, 2.25, 3, 3.75],
    bassPattern: [0, 0.5, 1.5, 2, 3, 3.5],
    bassIntervals: [0, 0, 7, 0, 0, 7],
    kickPattern: [0, 2.5],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [3.5],
    leadPattern: [[0, 3, 4, 3], [3, 4, 3, 0], [4, 3, 0, 3], [0, 3, 4, 0]],
    leadPositions: [0.1, 1, 2, 3.1],
    chordWave: 'saw',
    bassWave: 'saw',
    leadWave: 'square',
    chordGain: 0.032,
    bassGain: 0.08,
    leadGain: 0.022,
    kickGain: 0.125,
    snareGain: 0.105,
    hatGain: 0.03,
    chordHoldBeats: 0.24,
    bassHoldBeats: 0.28,
    leadHoldBeats: 0.25,
    delayA: { seconds: 0.09, feedback: 0.16, mix: 0.08 },
    clipDrive: 1.32,
    noiseBedGain: 0.0009,
    noiseBedHighpass: 0.96,
  },
  {
    fileName: 'punk-rock-spark.wav',
    texture: 'rock',
    durationSeconds: 19,
    beatsPerMinute: 178,
    rootMidi: 47,
    scale: [0, 2, 4, 7, 9],
    progression: [{ root: 0, quality: 'power' }, { root: 7, quality: 'power' }, { root: 9, quality: 'power' }, { root: 5, quality: 'power' }],
    chordPattern: EIGHTS,
    bassPattern: EIGHTS,
    bassIntervals: [0, 0, 7, 0, 0, 0, 7, 0],
    kickPattern: [0, 0.75, 2, 2.75],
    snarePattern: [1, 3],
    hatPattern: SIXTEENTHS,
    openHatPattern: [3.75],
    leadPattern: [[0, 2, 4, 2], [4, 2, 0, 2], [0, 2, 4, 5], [4, 2, 0, 4]],
    leadPositions: [0.05, 1, 2, 3],
    chordWave: 'saw',
    bassWave: 'saw',
    leadWave: 'square',
    chordGain: 0.03,
    bassGain: 0.075,
    leadGain: 0.018,
    kickGain: 0.118,
    snareGain: 0.1,
    hatGain: 0.024,
    chordHoldBeats: 0.18,
    bassHoldBeats: 0.18,
    leadHoldBeats: 0.18,
    delayA: { seconds: 0.08, feedback: 0.12, mix: 0.06 },
    clipDrive: 1.38,
    noiseBedGain: 0.001,
    noiseBedHighpass: 0.95,
  },
  {
    fileName: 'hard-rock-charge.wav',
    texture: 'rock',
    durationSeconds: 20,
    beatsPerMinute: 138,
    rootMidi: 43,
    scale: [0, 2, 3, 5, 7, 8, 10],
    progression: [{ root: 0, quality: 'power' }, { root: 5, quality: 'power' }, { root: 7, quality: 'power' }, { root: 0, quality: 'power' }],
    chordPattern: [0, 0.5, 1.5, 2.25, 3, 3.5],
    bassPattern: EIGHTS,
    bassIntervals: [0, 0, 7, 0, 0, 7, 0, 0],
    kickPattern: [0, 0.5, 2, 2.5],
    snarePattern: [1, 3],
    hatPattern: EIGHTS,
    openHatPattern: [1.5, 3.5],
    leadPattern: [[0, 2, 3, 5], [3, 5, 3, 2], [5, 3, 2, 0], [3, 2, 0, 3]],
    leadPositions: [0.08, 1, 2, 3.08],
    chordWave: 'saw',
    bassWave: 'saw',
    leadWave: 'triangle',
    chordGain: 0.033,
    bassGain: 0.08,
    leadGain: 0.022,
    kickGain: 0.128,
    snareGain: 0.108,
    hatGain: 0.028,
    chordHoldBeats: 0.22,
    bassHoldBeats: 0.22,
    leadHoldBeats: 0.26,
    leadVibratoDepth: 0.24,
    leadVibratoRate: 6.4,
    delayA: { seconds: 0.09, feedback: 0.14, mix: 0.07 },
    clipDrive: 1.42,
    noiseBedGain: 0.0011,
    noiseBedHighpass: 0.95,
  },
  {
    fileName: 'heavy-metal-storm.wav',
    texture: 'rock',
    durationSeconds: 19,
    beatsPerMinute: 168,
    rootMidi: 40,
    scale: [0, 1, 3, 5, 7, 8, 10],
    progression: [{ root: 0, quality: 'power' }, { root: 1, quality: 'power' }, { root: 5, quality: 'power' }, { root: 0, quality: 'power' }],
    chordPattern: [0, 0.25, 0.5, 0.75, 1.5, 1.75, 2, 2.25, 3, 3.25, 3.5, 3.75],
    bassPattern: [0, 0.25, 0.5, 0.75, 1.5, 1.75, 2, 2.25, 3, 3.25, 3.5, 3.75],
    bassIntervals: [0, 0, 0, 7, 0, 0, 0, 7, 0, 0, 7, 0],
    kickPattern: [0, 0.25, 0.5, 0.75, 1.5, 1.75, 2, 2.25, 3, 3.25],
    snarePattern: [1, 3],
    hatPattern: SIXTEENTHS,
    openHatPattern: [3.75],
    leadPattern: [[0, 1, 3, 4], [3, 4, 3, 1], [5, 4, 3, 1], [3, 1, 0, 1]],
    leadPositions: [0.12, 1.05, 2.05, 3.12],
    chordWave: 'saw',
    bassWave: 'square',
    leadWave: 'saw',
    chordGain: 0.03,
    bassGain: 0.078,
    leadGain: 0.018,
    kickGain: 0.125,
    snareGain: 0.105,
    hatGain: 0.022,
    chordHoldBeats: 0.14,
    bassHoldBeats: 0.14,
    leadHoldBeats: 0.2,
    leadVibratoDepth: 0.18,
    leadVibratoRate: 6.8,
    delayA: { seconds: 0.08, feedback: 0.11, mix: 0.05 },
    clipDrive: 1.52,
    noiseBedGain: 0.0012,
    noiseBedHighpass: 0.95,
    peak: 0.88,
  },
]

async function main() {
  await fs.mkdir(MUSIC_DIR, { recursive: true })
  await fs.mkdir(SFX_DIR, { recursive: true })

  await Promise.all(
    styleBlueprints.map((blueprint, index) =>
      writeWav(path.join(MUSIC_DIR, blueprint.fileName), createStyleTrack(0xabc100 + index * 97, blueprint))
    )
  )

  await Promise.all([
    writeWav(path.join(SFX_DIR, 'move-01.wav'), createMoveSound(0x9001, { variant: 1 })),
    writeWav(path.join(SFX_DIR, 'move-02.wav'), createMoveSound(0x9002, { variant: 2 })),
    writeWav(path.join(SFX_DIR, 'move-03.wav'), createMoveSound(0x9003, { variant: 3 })),
    writeWav(path.join(SFX_DIR, 'correct-01.wav'), createCorrectSound(0x9101, { rootMidi: 67 })),
    writeWav(path.join(SFX_DIR, 'correct-02.wav'), createCorrectSound(0x9102, { rootMidi: 64 })),
    writeWav(path.join(SFX_DIR, 'win-01.wav'), createWinSound(0x9201)),
  ])

  console.log('Audio assets generated in public/audio')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
