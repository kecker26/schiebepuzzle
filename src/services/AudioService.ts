import MusicPlaybackController from './MusicPlaybackController.ts'
import type { MusicStyleId } from './musicStyles.ts'

interface ActiveSynthSound {
  output: GainNode
  sources: AudioScheduledSourceNode[]
  cleanupTimer: number | null
}

interface LocalSfxTrack {
  id: string
  audioUrl: string
}

interface SamplePlaybackOptions {
  gain: number
  playbackRateMin?: number
  playbackRateMax?: number
  fadeInSeconds?: number
  fadeOutSeconds?: number
  lowpassHz?: number
  highpassHz?: number
  cleanupPaddingMs?: number
}

const SFX_GAIN_LEVEL = 1.28
const MASTER_GAIN_LEVEL = 1

const LOCAL_MOVE_SFX_TRACKS: LocalSfxTrack[] = [
  { id: 'move-01', audioUrl: '/audio/sfx/move-01.wav' },
  { id: 'move-02', audioUrl: '/audio/sfx/move-02.wav' },
  { id: 'move-03', audioUrl: '/audio/sfx/move-03.wav' },
]

const LOCAL_CORRECT_SFX_TRACKS: LocalSfxTrack[] = [
  { id: 'correct-01', audioUrl: '/audio/sfx/correct-01.wav' },
  { id: 'correct-02', audioUrl: '/audio/sfx/correct-02.wav' },
]

const LOCAL_WIN_SFX_TRACKS: LocalSfxTrack[] = [{ id: 'win-01', audioUrl: '/audio/sfx/win-01.wav' }]

export type { MusicAttributionSnapshot, MusicPlaybackStatusSnapshot } from './music/types.ts'

class AudioService {
  private readonly musicController = new MusicPlaybackController()
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private sfxBufferCache = new Map<string, AudioBuffer>()
  private sfxBufferPromises = new Map<string, Promise<AudioBuffer | null>>()
  private activeBlockedSound: ActiveSynthSound | null = null
  private activeCorrectSound: ActiveSynthSound | null = null
  private activeWinSound: ActiveSynthSound | null = null
  private blockedPlaybackToken = 0
  private correctPlaybackToken = 0
  private winPlaybackToken = 0

  getMusicMuted(): boolean {
    return this.musicController.getMusicMuted()
  }

  getSelectedMusicStyle(): MusicStyleId {
    return this.musicController.getSelectedMusicStyle()
  }

  getMusicVolume(): number {
    return this.musicController.getMusicVolume()
  }

  getMusicAttributionSnapshot() {
    return this.musicController.getMusicAttributionSnapshot()
  }

  getMusicPlaybackStatusSnapshot() {
    return this.musicController.getMusicPlaybackStatusSnapshot()
  }

  subscribeToMusicMuted(listener: () => void): () => void {
    return this.musicController.subscribeToMusicMuted(listener)
  }

  subscribeToSelectedMusicStyle(listener: () => void): () => void {
    return this.musicController.subscribeToSelectedMusicStyle(listener)
  }

  subscribeToMusicVolume(listener: () => void): () => void {
    return this.musicController.subscribeToMusicVolume(listener)
  }

  subscribeToMusicAttribution(listener: () => void): () => void {
    return this.musicController.subscribeToMusicAttribution(listener)
  }

  subscribeToMusicPlaybackStatus(listener: () => void): () => void {
    return this.musicController.subscribeToMusicPlaybackStatus(listener)
  }

  setMusicMuted(muted: boolean): void {
    this.musicController.setMusicMuted(muted)
  }

  setMusicVolume(volume: number): void {
    this.musicController.setMusicVolume(volume)
  }

  setSelectedMusicStyle(styleId: MusicStyleId): void {
    this.musicController.setSelectedMusicStyle(styleId)
  }

  activate(): void {
    const context = this.ensureAudioContext()
    this.musicController.activate()

    if (context && this.masterGain && this.sfxGain) {
      this.preloadSfxBuffers()
    }

    if (context && context.state === 'suspended') {
      void context.resume().catch(() => {
        // Ignore activation failures and try again on the next user interaction.
      })
    }
  }

  async ensureAmbientMusic(): Promise<void> {
    await this.musicController.ensureAmbientMusic()
  }

  noteGameStarted(): void {
    this.musicController.noteGameStarted()
  }

  playMove(): void {
    const context = this.ensureReadyContext()
    if (!context || !this.sfxGain) return

    const now = context.currentTime + 0.002
    const output = context.createGain()
    output.gain.setValueAtTime(0.0001, now)
    output.gain.linearRampToValueAtTime(0.4, now + 0.012)
    output.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    output.connect(this.sfxGain)

    const sources: AudioScheduledSourceNode[] = []

    const thump = context.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(176 + Math.random() * 18, now)
    thump.frequency.exponentialRampToValueAtTime(86 + Math.random() * 10, now + 0.08)
    const thumpGain = context.createGain()
    thumpGain.gain.setValueAtTime(0.2, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085)
    thump.connect(thumpGain)
    thumpGain.connect(output)
    thump.start(now)
    thump.stop(now + 0.09)
    sources.push(thump)

    sources.push(
      this.createFilteredNoiseBurst(
        context,
        output,
        now,
        0.085,
        0.18,
        180 + Math.random() * 80,
        2600 + Math.random() * 500
      )
    )
    sources.push(
      this.createFilteredNoiseBurst(
        context,
        output,
        now + 0.03,
        0.048,
        0.08,
        540 + Math.random() * 140,
        1800 + Math.random() * 360
      )
    )
    sources.push(this.createFilteredNoiseBurst(context, output, now + 0.055, 0.018, 0.04, 1200, 4200))

    this.scheduleCleanup(output, sources, 320)
  }

  playCorrectPlacement(durationMs: number): void {
    const context = this.ensureReadyContext()
    if (!context || !this.sfxGain) return

    this.stopCorrectPlacement()
    const playbackToken = ++this.correctPlaybackToken
    void this.playLocalSfxTrack(LOCAL_CORRECT_SFX_TRACKS, {
      gain: 0.54,
      playbackRateMin: 0.97,
      playbackRateMax: 1.02,
      fadeOutSeconds: 0.24,
      lowpassHz: 5400,
      highpassHz: 120,
      cleanupPaddingMs: 180,
    }).then((sound) => {
      if (playbackToken !== this.correctPlaybackToken) {
        if (sound) {
          this.stopActiveSynthSound(sound, 60)
        }
        return
      }

      this.activeCorrectSound = sound ?? this.createCorrectPlacementFallbackSound(context, durationMs)
    })
  }

  stopCorrectPlacement(): void {
    this.correctPlaybackToken += 1
    this.activeCorrectSound = this.stopActiveSynthSound(this.activeCorrectSound, 140)
  }

  playBlockedTile(): void {
    const context = this.ensureReadyContext()
    if (!context || !this.sfxGain) return

    this.stopBlockedTile()
    const playbackToken = ++this.blockedPlaybackToken
    void this.playLocalSfxTrack(LOCAL_MOVE_SFX_TRACKS, {
      gain: 0.42,
      playbackRateMin: 0.68,
      playbackRateMax: 0.8,
      fadeInSeconds: 0.004,
      fadeOutSeconds: 0.1,
      lowpassHz: 1450,
      highpassHz: 45,
      cleanupPaddingMs: 100,
    }).then((sound) => {
      if (playbackToken !== this.blockedPlaybackToken) {
        if (sound) {
          this.stopActiveSynthSound(sound, 50)
        }
        return
      }

      this.activeBlockedSound = sound
    })
  }

  stopBlockedTile(): void {
    this.blockedPlaybackToken += 1
    this.activeBlockedSound = this.stopActiveSynthSound(this.activeBlockedSound, 80)
  }

  playWinCelebration(durationMs: number): void {
    const context = this.ensureReadyContext()
    if (!context || !this.sfxGain) return

    this.stopWinCelebration()
    const playbackToken = ++this.winPlaybackToken
    void this.playLocalSfxTrack(LOCAL_WIN_SFX_TRACKS, {
      gain: 0.72,
      playbackRateMin: 0.98,
      playbackRateMax: 1.03,
      fadeOutSeconds: 0.34,
      lowpassHz: 6200,
      highpassHz: 90,
      cleanupPaddingMs: 240,
    }).then((sound) => {
      if (playbackToken !== this.winPlaybackToken) {
        if (sound) {
          this.stopActiveSynthSound(sound, 70)
        }
        return
      }

      this.activeWinSound = sound ?? this.createWinCelebrationFallbackSound(context, durationMs)
    })
  }

  stopWinCelebration(): void {
    this.winPlaybackToken += 1
    this.activeWinSound = this.stopActiveSynthSound(this.activeWinSound, 180)
  }

  stopTransientEffects(): void {
    this.stopBlockedTile()
    this.stopCorrectPlacement()
    this.stopWinCelebration()
  }

  private preloadSfxBuffers(): void {
    [...LOCAL_MOVE_SFX_TRACKS, ...LOCAL_CORRECT_SFX_TRACKS, ...LOCAL_WIN_SFX_TRACKS].forEach((track) => {
      void this.loadSfxBuffer(track.audioUrl)
    })
  }

  private async loadSfxBuffer(audioUrl: string): Promise<AudioBuffer | null> {
    const cachedBuffer = this.sfxBufferCache.get(audioUrl)
    if (cachedBuffer) {
      return cachedBuffer
    }

    const pendingBuffer = this.sfxBufferPromises.get(audioUrl)
    if (pendingBuffer) {
      return pendingBuffer
    }

    const context = this.ensureAudioContext()
    if (!context) {
      return null
    }

    const loadPromise = (async () => {
      try {
        const response = await fetch(audioUrl)
        if (!response.ok) {
          return null
        }

        const audioData = await response.arrayBuffer()
        const decodedBuffer = await context.decodeAudioData(audioData.slice(0))
        this.sfxBufferCache.set(audioUrl, decodedBuffer)
        return decodedBuffer
      } catch {
        return null
      } finally {
        this.sfxBufferPromises.delete(audioUrl)
      }
    })()

    this.sfxBufferPromises.set(audioUrl, loadPromise)
    return loadPromise
  }

  private async playLocalSfxTrack(
    tracks: LocalSfxTrack[],
    options: SamplePlaybackOptions
  ): Promise<ActiveSynthSound | null> {
    const context = this.audioContext
    const sfxGain = this.sfxGain
    if (!context || !sfxGain || tracks.length === 0) {
      return null
    }

    const selectedTrack = tracks[Math.floor(Math.random() * tracks.length)] ?? null
    if (!selectedTrack) {
      return null
    }

    const buffer = await this.loadSfxBuffer(selectedTrack.audioUrl)
    if (!buffer || !this.audioContext || !this.sfxGain) {
      return null
    }

    const playbackContext = this.audioContext
    const playbackRateMin = options.playbackRateMin ?? 1
    const playbackRateMax = options.playbackRateMax ?? playbackRateMin
    const playbackRate = playbackRateMin + Math.random() * (playbackRateMax - playbackRateMin)
    const fadeInSeconds = options.fadeInSeconds ?? 0.01
    const fadeOutSeconds = options.fadeOutSeconds ?? 0.24
    const effectiveDuration = buffer.duration / Math.max(0.01, playbackRate)
    const startTime = playbackContext.currentTime + 0.01
    const stopTime = startTime + effectiveDuration
    const holdUntil = Math.max(startTime + fadeInSeconds, stopTime - fadeOutSeconds)

    const output = playbackContext.createGain()
    output.gain.setValueAtTime(0.0001, startTime)
    output.gain.linearRampToValueAtTime(options.gain, startTime + fadeInSeconds)
    output.gain.setValueAtTime(options.gain, holdUntil)
    output.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.02)
    output.connect(this.sfxGain)

    let sampleTarget: AudioNode = output
    if (typeof options.lowpassHz === 'number') {
      const lowpass = playbackContext.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.setValueAtTime(options.lowpassHz, startTime)
      lowpass.Q.value = 0.4
      lowpass.connect(sampleTarget)
      sampleTarget = lowpass
    }

    if (typeof options.highpassHz === 'number') {
      const highpass = playbackContext.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.setValueAtTime(options.highpassHz, startTime)
      highpass.Q.value = 0.5
      highpass.connect(sampleTarget)
      sampleTarget = highpass
    }

    const source = playbackContext.createBufferSource()
    source.buffer = buffer
    source.playbackRate.setValueAtTime(playbackRate, startTime)
    source.connect(sampleTarget)
    source.start(startTime)
    source.stop(stopTime + 0.04)

    return this.createActiveSynthSound(
      output,
      [source],
      effectiveDuration * 1000 + (options.cleanupPaddingMs ?? 180)
    )
  }

  private createCorrectPlacementFallbackSound(context: AudioContext, durationMs: number): ActiveSynthSound {
    const now = context.currentTime
    const durationSeconds = Math.max(0.6, durationMs / 1000)
    const output = context.createGain()
    output.gain.setValueAtTime(0.0001, now)
    output.gain.linearRampToValueAtTime(0.46, now + 0.06)
    output.gain.linearRampToValueAtTime(0.18, now + durationSeconds * 0.45)
    output.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds + 0.28)
    output.connect(this.sfxGain as GainNode)

    const sources: AudioScheduledSourceNode[] = []
    ;[0, 0.11, 0.24].forEach((offset, index) => {
      sources.push(
        this.createBellTone(context, output, now + offset, 0.82 + index * 0.12, 660 + index * 120, 0.34 - index * 0.05)
      )
    })

    sources.push(this.createNoiseSource(context, output, now + 0.04, durationSeconds * 0.8, 0.06, 3400))
    return this.createActiveSynthSound(output, sources, durationMs + 500)
  }

  private createWinCelebrationFallbackSound(context: AudioContext, durationMs: number): ActiveSynthSound {
    const now = context.currentTime
    const durationSeconds = Math.max(2.6, durationMs / 1000)
    const output = context.createGain()
    output.gain.setValueAtTime(0.0001, now)
    output.gain.linearRampToValueAtTime(0.58, now + 0.08)
    output.gain.linearRampToValueAtTime(0.26, now + durationSeconds * 0.55)
    output.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds + 0.35)
    output.connect(this.sfxGain as GainNode)

    const sources: AudioScheduledSourceNode[] = []
    const motif = [523.25, 659.25, 783.99, 1046.5]
    motif.forEach((frequency, index) => {
      sources.push(this.createBellTone(context, output, now + index * 0.32, 1.15, frequency, 0.32))
      sources.push(this.createBellTone(context, output, now + index * 0.32 + 0.09, 0.95, frequency * 1.5, 0.12))
    })

    for (let sparkle = 0; sparkle < 10; sparkle += 1) {
      const start = now + 0.22 + sparkle * 0.24
      const frequency = 1046.5 + (sparkle % 4) * 110
      sources.push(this.createBellTone(context, output, start, 0.42, frequency, 0.12))
    }

    sources.push(this.createNoiseSource(context, output, now, durationSeconds * 0.95, 0.08, 2600))
    return this.createActiveSynthSound(output, sources, durationMs + 700)
  }

  private ensureReadyContext(): AudioContext | null {
    const context = this.ensureAudioContext()
    if (!context) return null

    if (context.state === 'suspended') {
      void context.resume().catch(() => {
        // Ignore resume failures and try again on the next interaction.
      })
    }

    return context
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) {
      return null
    }

    const context = new AudioContextCtor()
    const masterGain = context.createGain()
    const sfxGain = context.createGain()

    masterGain.gain.value = MASTER_GAIN_LEVEL
    sfxGain.gain.value = SFX_GAIN_LEVEL

    sfxGain.connect(masterGain)
    masterGain.connect(context.destination)

    this.audioContext = context
    this.masterGain = masterGain
    this.sfxGain = sfxGain
    this.noiseBuffer = this.createNoiseBuffer(context)

    return context
  }

  private createBellTone(
    context: AudioContext,
    target: AudioNode,
    startTime: number,
    durationSeconds: number,
    frequency: number,
    gainAmount: number
  ): AudioScheduledSourceNode {
    const output = context.createGain()
    output.gain.setValueAtTime(0.0001, startTime)
    output.gain.linearRampToValueAtTime(gainAmount, startTime + 0.02)
    output.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds)
    output.connect(target)

    const primary = context.createOscillator()
    primary.type = 'sine'
    primary.frequency.setValueAtTime(frequency, startTime)
    primary.connect(output)
    primary.start(startTime)
    primary.stop(startTime + durationSeconds + 0.04)

    const harmonic = context.createOscillator()
    harmonic.type = 'triangle'
    harmonic.frequency.setValueAtTime(frequency * 2, startTime)
    const harmonicGain = context.createGain()
    harmonicGain.gain.setValueAtTime(gainAmount * 0.3, startTime)
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds * 0.55)
    harmonic.connect(harmonicGain)
    harmonicGain.connect(target)
    harmonic.start(startTime)
    harmonic.stop(startTime + durationSeconds * 0.6)

    return primary
  }

  private createFilteredNoiseBurst(
    context: AudioContext,
    target: AudioNode,
    startTime: number,
    durationSeconds: number,
    gainAmount: number,
    highpassHz: number,
    lowpassHz: number
  ): AudioScheduledSourceNode {
    const buffer = this.noiseBuffer ?? this.createNoiseBuffer(context)
    this.noiseBuffer = buffer

    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = durationSeconds > buffer.duration

    const highpass = context.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.setValueAtTime(highpassHz, startTime)
    highpass.Q.value = 0.45

    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.setValueAtTime(lowpassHz, startTime)
    lowpass.Q.value = 0.55

    const output = context.createGain()
    output.gain.setValueAtTime(0.0001, startTime)
    output.gain.linearRampToValueAtTime(gainAmount, startTime + Math.min(0.018, durationSeconds * 0.35))
    output.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds)

    source.connect(highpass)
    highpass.connect(lowpass)
    lowpass.connect(output)
    output.connect(target)
    source.start(startTime)
    source.stop(startTime + durationSeconds)

    return source
  }

  private createNoiseSource(
    context: AudioContext,
    target: AudioNode,
    startTime: number,
    durationSeconds: number,
    gainAmount: number,
    highpassHz: number
  ): AudioScheduledSourceNode {
    const buffer = this.noiseBuffer ?? this.createNoiseBuffer(context)
    this.noiseBuffer = buffer

    const source = context.createBufferSource()
    source.buffer = buffer
    source.loop = durationSeconds > buffer.duration

    const filter = context.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(highpassHz, startTime)

    const output = context.createGain()
    output.gain.setValueAtTime(0.0001, startTime)
    output.gain.linearRampToValueAtTime(gainAmount, startTime + Math.min(0.03, durationSeconds * 0.25))
    output.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds)

    source.connect(filter)
    filter.connect(output)
    output.connect(target)
    source.start(startTime)
    source.stop(startTime + durationSeconds)

    return source
  }

  private createActiveSynthSound(
    output: GainNode,
    sources: AudioScheduledSourceNode[],
    cleanupAfterMs: number
  ): ActiveSynthSound {
    return {
      output,
      sources,
      cleanupTimer: window.setTimeout(() => {
        this.disconnectActiveSynth(output)
      }, cleanupAfterMs),
    }
  }

  private stopActiveSynthSound(sound: ActiveSynthSound | null, fadeOutMs: number): null {
    if (!sound || !this.audioContext) return null

    if (sound.cleanupTimer !== null) {
      window.clearTimeout(sound.cleanupTimer)
    }

    const now = this.audioContext.currentTime
    sound.output.gain.cancelScheduledValues(now)
    sound.output.gain.setValueAtTime(Math.max(sound.output.gain.value, 0.0001), now)
    sound.output.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutMs / 1000)

    sound.sources.forEach((source) => {
      try {
        source.stop(now + fadeOutMs / 1000 + 0.05)
      } catch {
        // Source may have already stopped.
      }
    })

    window.setTimeout(() => {
      this.disconnectActiveSynth(sound.output)
    }, fadeOutMs + 120)

    return null
  }

  private disconnectActiveSynth(output: GainNode): void {
    try {
      output.disconnect()
    } catch {
      // Node may already be disconnected.
    }
  }

  private scheduleCleanup(output: GainNode, sources: AudioScheduledSourceNode[], afterMs: number): void {
    window.setTimeout(() => {
      sources.forEach((source) => {
        try {
          source.disconnect()
        } catch {
          // Source may already be disconnected.
        }
      })
      this.disconnectActiveSynth(output)
    }, afterMs)
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const durationSeconds = 2
    const buffer = context.createBuffer(1, context.sampleRate * durationSeconds, context.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1
    }
    return buffer
  }
}

const audioService = new AudioService()

export default audioService
