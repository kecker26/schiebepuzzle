import { requestNextMusicTrack } from './MusicService.ts'
import { DEFAULT_MUSIC_STYLE_ID, isMusicStyleId, type MusicStyleId } from './musicStyles.ts'
import { getLocalFallbackTracksForStyle, LOCAL_FALLBACK_TRACKS } from './music/localFallbackTracks.ts'
import {
  createEmptyMusicAttribution,
  createMusicPlaybackStatus,
  type MusicAttributionSnapshot,
  type MusicPlaybackState,
  type MusicPlaybackStatusSnapshot,
  type MusicProviderId,
  type MusicTrackDescriptor,
} from './music/types.ts'

const STORAGE_KEY_MUSIC_MUTED = 'schiebepuzzle.musicMuted'
const STORAGE_KEY_MUSIC_STYLE = 'schiebepuzzle.musicStyle'
const STORAGE_KEY_MUSIC_VOLUME = 'schiebepuzzle.musicVolume'
const DEFAULT_MUSIC_VOLUME = 0.58
const MUSIC_VOLUME_CHANGE_EPSILON = 0.001
const MUSIC_VOLUME_SYNC_EPSILON = 0.015
const MUSIC_FADE_IN_MS = 700
const PLAYBACK_CONFIRMATION_ATTEMPTS = 10
const PLAYBACK_CONFIRMATION_DELAY_MS = 220
const PLAYBACK_CONFIRMATION_REQUIRED_SAMPLES = 2
const STABLE_PLAYBACK_ATTEMPTS = 4
const STABLE_PLAYBACK_DELAY_MS = 260
const MIN_PLAYBACK_PROGRESS_DELTA = 0.05
const WATCHDOG_INTERVAL_MS = 1200
const WATCHDOG_STALL_THRESHOLD_MS = 3500
const REMOTE_RECOVERY_DELAYS_MS = [8000, 20000, 45000]
const GENERAL_RETRY_DELAYS_MS = [1600, 4200, 9000]
const RECENT_TRACK_MEMORY = 8

function clampMusicVolume(volume: number): number {
  if (!Number.isFinite(volume)) {
    return DEFAULT_MUSIC_VOLUME
  }

  return Math.max(0, Math.min(1, volume))
}

function readStoredMusicMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY_MUSIC_MUTED) === 'true'
  } catch {
    return false
  }
}

function writeStoredMusicMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_MUSIC_MUTED, String(muted))
  } catch {
    // Ignore storage failures and keep the in-memory preference.
  }
}

function readStoredMusicStyle(): MusicStyleId {
  try {
    const storedStyle = window.localStorage.getItem(STORAGE_KEY_MUSIC_STYLE)
    if (storedStyle && isMusicStyleId(storedStyle)) {
      return storedStyle
    }
  } catch {
    // Ignore storage failures and use the default style.
  }

  return DEFAULT_MUSIC_STYLE_ID
}

function writeStoredMusicStyle(styleId: MusicStyleId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_MUSIC_STYLE, styleId)
  } catch {
    // Ignore storage failures and keep the in-memory preference.
  }
}

function readStoredMusicVolume(): number {
  try {
    const storedVolume = window.localStorage.getItem(STORAGE_KEY_MUSIC_VOLUME)
    if (storedVolume !== null) {
      return clampMusicVolume(Number(storedVolume))
    }
  } catch {
    // Ignore storage failures and use the default volume.
  }

  return DEFAULT_MUSIC_VOLUME
}

function writeStoredMusicVolume(volume: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_MUSIC_VOLUME, String(clampMusicVolume(volume)))
  } catch {
    // Ignore storage failures and keep the in-memory preference.
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs)
  })
}

export default class MusicPlaybackController {
  private musicElement: HTMLAudioElement | null = null
  private currentTrack: MusicTrackDescriptor | null = null
  private isActivated = false
  private musicMuted = readStoredMusicMuted()
  private musicVolume = readStoredMusicVolume()
  private selectedMusicStyle = readStoredMusicStyle()
  private requestSequence = 0
  private playbackSequence = 0
  private isRecovering = false
  private retryCount = 0
  private remoteRecoveryAttempt = 0
  private musicFadeFrame: number | null = null
  private musicFadeResolver: (() => void) | null = null
  private retryTimer: number | null = null
  private remoteRecoveryTimer: number | null = null
  private watchdogTimer: number | null = null
  private foregroundRequestCount = 0
  private recentTrackIdsByStyle = new Map<MusicStyleId, string[]>()
  private musicMutedListeners = new Set<() => void>()
  private musicVolumeListeners = new Set<() => void>()
  private musicStyleListeners = new Set<() => void>()
  private musicAttributionListeners = new Set<() => void>()
  private musicPlaybackStatusListeners = new Set<() => void>()
  private musicAttribution: MusicAttributionSnapshot = createEmptyMusicAttribution()
  private musicPlaybackStatus: MusicPlaybackStatusSnapshot = createMusicPlaybackStatus(
    this.musicMuted ? 'muted' : 'idle',
    {
      message: this.musicMuted ? 'Musik ist ausgeschaltet.' : 'Musik bereit.',
    }
  )

  getMusicMuted(): boolean {
    return this.musicMuted
  }

  getSelectedMusicStyle(): MusicStyleId {
    return this.selectedMusicStyle
  }

  getMusicVolume(): number {
    return this.musicVolume
  }

  getMusicAttributionSnapshot(): MusicAttributionSnapshot {
    return { ...this.musicAttribution }
  }

  getMusicPlaybackStatusSnapshot(): MusicPlaybackStatusSnapshot {
    return { ...this.musicPlaybackStatus }
  }

  subscribeToMusicMuted(listener: () => void): () => void {
    this.musicMutedListeners.add(listener)
    return () => {
      this.musicMutedListeners.delete(listener)
    }
  }

  subscribeToSelectedMusicStyle(listener: () => void): () => void {
    this.musicStyleListeners.add(listener)
    return () => {
      this.musicStyleListeners.delete(listener)
    }
  }

  subscribeToMusicVolume(listener: () => void): () => void {
    this.musicVolumeListeners.add(listener)
    return () => {
      this.musicVolumeListeners.delete(listener)
    }
  }

  subscribeToMusicAttribution(listener: () => void): () => void {
    this.musicAttributionListeners.add(listener)
    return () => {
      this.musicAttributionListeners.delete(listener)
    }
  }

  subscribeToMusicPlaybackStatus(listener: () => void): () => void {
    this.musicPlaybackStatusListeners.add(listener)
    return () => {
      this.musicPlaybackStatusListeners.delete(listener)
    }
  }

  setMusicMuted(muted: boolean): void {
    if (this.musicMuted === muted) {
      return
    }

    this.musicMuted = muted
    writeStoredMusicMuted(muted)
    this.notifyMusicMutedListeners()

    if (muted) {
      this.cancelRetry()
      this.cancelRemoteRecovery()
      this.isRecovering = false
      this.stopCurrentMusic({ clearAttribution: true })
      this.updateStatus('muted', {
        message: 'Musik ist ausgeschaltet.',
      })
      return
    }

    if (this.isActivated) {
      void this.requestAndPlayTrack({
        forceSwitch: true,
        allowFallback: true,
      })
    } else {
      this.updateStatus('idle', {
        message: 'Musik bereit.',
      })
    }
  }

  setMusicVolume(volume: number): void {
    const nextVolume = clampMusicVolume(volume)
    if (Math.abs(this.musicVolume - nextVolume) < MUSIC_VOLUME_CHANGE_EPSILON) {
      return
    }

    this.musicVolume = nextVolume
    writeStoredMusicVolume(nextVolume)

    if (this.musicElement && !this.musicMuted) {
      this.cancelPendingFade()
      this.musicElement.volume = nextVolume
    }

    this.notifyMusicVolumeListeners()
  }

  setSelectedMusicStyle(styleId: MusicStyleId): void {
    if (this.selectedMusicStyle === styleId) {
      return
    }

    this.selectedMusicStyle = styleId
    writeStoredMusicStyle(styleId)
    this.notifyMusicStyleListeners()
    this.cancelRetry()
    this.cancelRemoteRecovery()
    this.retryCount = 0
    this.remoteRecoveryAttempt = 0

    if (!this.isActivated || this.musicMuted) {
      this.stopCurrentMusic({ clearAttribution: true })
      this.updateStatus(this.musicMuted ? 'muted' : 'idle', {
        message: this.musicMuted ? 'Musik ist ausgeschaltet.' : 'Musik bereit.',
      })
      return
    }

    void this.requestAndPlayTrack({
      forceSwitch: true,
      allowFallback: true,
    })
  }

  activate(): void {
    this.isActivated = true
    if (!this.musicMuted) {
      void this.ensureAmbientMusic()
    }
  }

  async ensureAmbientMusic(): Promise<void> {
    if (!this.isActivated || this.musicMuted) {
      return
    }

    if (this.hasHealthyCurrentTrack() || this.foregroundRequestCount > 0) {
      return
    }

    await this.requestAndPlayTrack({
      forceSwitch: false,
      allowFallback: true,
    })
  }

  noteGameStarted(): void {
    if (!this.isActivated || this.musicMuted) {
      return
    }

    void this.ensureAmbientMusic()
  }

  private hasHealthyCurrentTrack(): boolean {
    return (
      this.currentTrack !== null &&
      this.musicElement !== null &&
      this.isAudioElementHealthy(this.musicElement, {
        requireConfiguredVolume: true,
      }) &&
      this.musicPlaybackStatus.state !== 'loading' &&
      this.musicPlaybackStatus.state !== 'recovering'
    )
  }

  private async requestAndPlayTrack({
    forceSwitch,
    allowFallback,
    failedProvider,
    failedTrackId,
    failureReason,
    background = false,
  }: {
    forceSwitch: boolean
    allowFallback: boolean
    failedProvider?: MusicProviderId | null
    failedTrackId?: string | null
    failureReason?: string | null
    background?: boolean
  }): Promise<boolean> {
    if (!this.isActivated || this.musicMuted) {
      return false
    }

    const requestToken = ++this.requestSequence
    if (!background) {
      this.foregroundRequestCount += 1
    }
    if (!background) {
      this.isRecovering = true
      this.updateStatus(this.currentTrack ? 'recovering' : 'loading', {
        provider: this.currentTrack?.provider ?? null,
        providerLabel: this.currentTrack?.providerLabel ?? null,
        isFallback: this.currentTrack?.isFallback ?? false,
        message: this.currentTrack ? 'Stelle Musik wieder her.' : 'Suche passenden Track.',
        detail: this.currentTrack ? 'Wechsle zu einer stabileren Quelle.' : 'Verbinde die verfügbaren Musikquellen.',
      })
    }

    const excludeTrackIds = this.getRecentTrackIds(this.selectedMusicStyle)
    if (forceSwitch && this.currentTrack) {
      excludeTrackIds.push(this.currentTrack.id)
    }
    if (failedTrackId) {
      excludeTrackIds.push(failedTrackId)
    }

    try {
      const response = await requestNextMusicTrack({
        styleId: this.selectedMusicStyle,
        excludeTrackIds: Array.from(new Set(excludeTrackIds)),
        allowFallback,
        failedProvider,
        failedTrackId,
        failureReason,
      })

      if (requestToken !== this.requestSequence || this.musicMuted) {
        return false
      }

      if (!response.track) {
        if (!allowFallback) {
          return false
        }

        return this.playEmergencyFallback(requestToken)
      }

      const startedPlayback = await this.playTrack(response.track, requestToken)
      if (!startedPlayback && allowFallback && !background) {
        return this.playEmergencyFallback(requestToken)
      }

      return startedPlayback
    } catch {
      if (requestToken !== this.requestSequence || this.musicMuted) {
        return false
      }

      if (background) {
        return false
      }

      return this.playEmergencyFallback(requestToken)
    } finally {
      if (!background) {
        this.foregroundRequestCount = Math.max(0, this.foregroundRequestCount - 1)
      }
      if (!background && requestToken === this.requestSequence && !this.musicMuted && !this.currentTrack) {
        this.scheduleRetry()
      }
    }
  }

  private async playEmergencyFallback(requestToken: number): Promise<boolean> {
    if (requestToken !== this.requestSequence || this.musicMuted) {
      return false
    }

    const excludeTrackIds = this.getRecentTrackIds(this.selectedMusicStyle)
    if (this.currentTrack) {
      excludeTrackIds.push(this.currentTrack.id)
    }

    const preferredTracks = getLocalFallbackTracksForStyle(this.selectedMusicStyle)
    const emergencyTrack =
      preferredTracks.find((track) => !excludeTrackIds.includes(track.id)) ??
      preferredTracks[Math.floor(Math.random() * preferredTracks.length)] ??
      LOCAL_FALLBACK_TRACKS.find((track) => !excludeTrackIds.includes(track.id)) ??
      LOCAL_FALLBACK_TRACKS[Math.floor(Math.random() * LOCAL_FALLBACK_TRACKS.length)] ??
      null

    if (!emergencyTrack) {
      this.isRecovering = false
      this.updateStatus('recovering', {
        message: 'Musik wird erneut versucht.',
        detail: 'Aktuell ist kein Fallback-Track verfügbar.',
      })
      this.scheduleRetry()
      return false
    }

    return this.playTrack(emergencyTrack, requestToken)
  }

  private async playTrack(track: MusicTrackDescriptor, requestToken: number): Promise<boolean> {
    const previousAudio = this.musicElement
    const candidateAudio = this.createMusicElement()
    const hadPreviousPlayback =
      previousAudio !== null &&
      !previousAudio.paused &&
      !previousAudio.ended &&
      previousAudio.error === null

    try {
      candidateAudio.preload = 'auto'
      candidateAudio.crossOrigin = 'anonymous'
      candidateAudio.defaultMuted = false
      candidateAudio.muted = false
      candidateAudio.src = track.audioUrl
      candidateAudio.currentTime = 0
      candidateAudio.volume = hadPreviousPlayback ? 0 : this.getTargetMusicVolume()
      candidateAudio.load()

      await candidateAudio.play()
      const playbackConfirmed = await this.waitForPlaybackConfirmation(candidateAudio, requestToken)
      if (!playbackConfirmed) {
        this.disposeAudioElement(candidateAudio)
        return false
      }

      if (requestToken !== this.requestSequence || this.musicMuted) {
        this.disposeAudioElement(candidateAudio)
        return false
      }

      this.musicElement = candidateAudio
      this.currentTrack = track
      this.playbackSequence += 1
      const playbackSequence = this.playbackSequence
      this.retryCount = 0
      this.cancelRetry()
      this.remoteRecoveryAttempt = 0
      this.isRecovering = false
      this.restorePlaybackFlags(candidateAudio)
      this.startWatchdog(playbackSequence)

      if (track.isFallback) {
        this.scheduleRemoteRecovery()
      } else {
        this.cancelRemoteRecovery()
      }

      if (previousAudio && previousAudio !== candidateAudio) {
        this.disposeAudioElement(previousAudio)
      }

      if (candidateAudio.volume < this.getTargetMusicVolume() - MUSIC_VOLUME_CHANGE_EPSILON) {
        await this.fadeAudioElementVolume(candidateAudio, this.getTargetMusicVolume(), MUSIC_FADE_IN_MS)
      }

      const stablePlayback = await this.waitForStablePlayback(candidateAudio, requestToken, playbackSequence)
      if (!stablePlayback) {
        if (candidateAudio === this.musicElement && requestToken === this.requestSequence && !this.musicMuted) {
          void this.handlePlaybackFailure('post-confirmation-stall')
        } else {
          this.disposeAudioElement(candidateAudio)
        }
        return false
      }

      this.clearMusicAttribution()
      this.applyMusicAttribution(track)
      this.rememberTrackId(this.selectedMusicStyle, track.id)
      this.updateStatus(track.isFallback ? 'fallback' : 'playing', {
        provider: track.provider,
        providerLabel: track.providerLabel,
        isFallback: track.isFallback,
        message: track.isFallback ? 'Lokaler Fallback aktiv.' : 'Musik spielt.',
        detail: track.isFallback
          ? 'Remote-Quellen werden im Hintergrund weiter versucht.'
          : `Quelle: ${track.providerLabel}`,
      })
      return true
    } catch {
      this.disposeAudioElement(candidateAudio)
      return false
    }
  }

  private async waitForPlaybackConfirmation(audio: HTMLAudioElement, requestToken: number): Promise<boolean> {
    let lastObservedTime = audio.currentTime
    let progressSamples = 0

    for (let attempt = 0; attempt < PLAYBACK_CONFIRMATION_ATTEMPTS; attempt += 1) {
      await wait(PLAYBACK_CONFIRMATION_DELAY_MS)

      if (requestToken !== this.requestSequence || this.musicMuted) {
        return false
      }

      this.restorePlaybackFlags(audio)

      if (!this.isAudioElementHealthy(audio, { requireConfiguredVolume: false })) {
        return false
      }

      if (audio.currentTime > lastObservedTime + MIN_PLAYBACK_PROGRESS_DELTA) {
        lastObservedTime = audio.currentTime
        progressSamples += 1
      }

      if (progressSamples >= PLAYBACK_CONFIRMATION_REQUIRED_SAMPLES) {
        return true
      }
    }

    return false
  }

  private async waitForStablePlayback(
    audio: HTMLAudioElement,
    requestToken: number,
    playbackSequence: number
  ): Promise<boolean> {
    let lastObservedTime = audio.currentTime
    let progressSamples = 0

    for (let attempt = 0; attempt < STABLE_PLAYBACK_ATTEMPTS; attempt += 1) {
      await wait(STABLE_PLAYBACK_DELAY_MS)

      if (
        requestToken !== this.requestSequence ||
        playbackSequence !== this.playbackSequence ||
        this.musicMuted ||
        audio !== this.musicElement
      ) {
        return false
      }

      this.restoreConfiguredPlaybackState(audio)

      if (!this.isAudioElementHealthy(audio, { requireConfiguredVolume: true })) {
        return false
      }

      if (audio.currentTime > lastObservedTime + MIN_PLAYBACK_PROGRESS_DELTA) {
        lastObservedTime = audio.currentTime
        progressSamples += 1
      }

      if (progressSamples >= PLAYBACK_CONFIRMATION_REQUIRED_SAMPLES) {
        return true
      }
    }

    return false
  }

  private createMusicElement(): HTMLAudioElement {
    const audio = new Audio()
    this.attachAudioListeners(audio)
    return audio
  }

  private attachAudioListeners(audio: HTMLAudioElement): void {
    audio.addEventListener('ended', this.handleTrackEnded)
    audio.addEventListener('error', this.handleTrackError)
    audio.addEventListener('stalled', this.handleTrackStalled)
    audio.addEventListener('pause', this.handleTrackPause)
  }

  private detachAudioListeners(audio: HTMLAudioElement): void {
    audio.removeEventListener('ended', this.handleTrackEnded)
    audio.removeEventListener('error', this.handleTrackError)
    audio.removeEventListener('stalled', this.handleTrackStalled)
    audio.removeEventListener('pause', this.handleTrackPause)
  }

  private disposeAudioElement(audio: HTMLAudioElement): void {
    this.detachAudioListeners(audio)
    try {
      audio.pause()
    } catch {
      // Ignore pause failures on disposed elements.
    }

    audio.src = ''
    audio.load()
  }

  private stopCurrentMusic({ clearAttribution }: { clearAttribution: boolean }): void {
    this.requestSequence += 1
    this.playbackSequence += 1
    this.stopWatchdog()
    this.cancelPendingFade()

    if (this.musicElement) {
      this.disposeAudioElement(this.musicElement)
      this.musicElement = null
    }

    this.currentTrack = null
    if (clearAttribution) {
      this.clearMusicAttribution()
    }
  }

  private startWatchdog(playbackSequence: number): void {
    this.stopWatchdog()

    let lastPlaybackTime = this.musicElement?.currentTime ?? 0
    let lastProgressAt = performance.now()

    this.watchdogTimer = window.setInterval(() => {
      if (playbackSequence !== this.playbackSequence || this.musicMuted || !this.isActivated) {
        return
      }

      const audio = this.musicElement
      const track = this.currentTrack
      if (!audio || !track) {
        return
      }

      this.restoreConfiguredPlaybackState(audio)

      if (!this.isAudioElementHealthy(audio, { requireConfiguredVolume: true })) {
        void this.handlePlaybackFailure('playback-unhealthy')
        return
      }

      if (audio.paused || audio.ended || audio.error) {
        void this.handlePlaybackFailure('playback-ended')
        return
      }

      if (audio.currentTime > lastPlaybackTime + MIN_PLAYBACK_PROGRESS_DELTA) {
        lastPlaybackTime = audio.currentTime
        lastProgressAt = performance.now()
        if (this.musicPlaybackStatus.state === 'recovering' && !track.isFallback) {
          this.updateStatus('playing', {
            provider: track.provider,
            providerLabel: track.providerLabel,
            isFallback: false,
            message: 'Musik spielt.',
            detail: `Quelle: ${track.providerLabel}`,
          })
        }
        return
      }

      if (performance.now() - lastProgressAt > WATCHDOG_STALL_THRESHOLD_MS) {
        void this.handlePlaybackFailure('stalled')
      }
    }, WATCHDOG_INTERVAL_MS)
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer !== null) {
      window.clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
  }

  private async handlePlaybackFailure(reason: string): Promise<void> {
    if (this.musicMuted || !this.isActivated || this.isRecovering) {
      return
    }

    const failedTrack = this.currentTrack
    this.isRecovering = true
    this.cancelRetry()
    this.stopCurrentMusic({ clearAttribution: true })
    this.updateStatus('recovering', {
      provider: failedTrack?.provider ?? null,
      providerLabel: failedTrack?.providerLabel ?? null,
      isFallback: failedTrack?.isFallback ?? false,
      message: 'Stelle Musik wieder her.',
      detail: 'Die aktuelle Quelle ist ausgefallen und wird ersetzt.',
    })

    const startedPlayback = await this.requestAndPlayTrack({
      forceSwitch: true,
      allowFallback: true,
      failedProvider: failedTrack?.provider ?? null,
      failedTrackId: failedTrack?.id ?? null,
      failureReason: reason,
    })

    if (!startedPlayback) {
      this.scheduleRetry()
    }
  }

  private handleTrackEnded = (event: Event): void => {
    if (event.currentTarget !== this.musicElement) {
      return
    }

    void this.handlePlaybackFailure('ended')
  }

  private handleTrackError = (event: Event): void => {
    if (event.currentTarget !== this.musicElement) {
      return
    }

    void this.handlePlaybackFailure('error')
  }

  private handleTrackStalled = (event: Event): void => {
    if (event.currentTarget !== this.musicElement) {
      return
    }

    if (this.currentTrack) {
      this.updateStatus('recovering', {
        provider: this.currentTrack.provider,
        providerLabel: this.currentTrack.providerLabel,
        isFallback: this.currentTrack.isFallback,
        message: 'Verbindung schwankt.',
        detail: 'Prüfe die Wiedergabe und stelle die Musik bei Bedarf wieder her.',
      })
    }
  }

  private handleTrackPause = (event: Event): void => {
    if (event.currentTarget !== this.musicElement) {
      return
    }

    const audio = this.musicElement
    if (!audio || this.musicMuted || !this.isActivated || audio.ended) {
      return
    }

    void this.handlePlaybackFailure('pause')
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null || this.musicMuted || !this.isActivated) {
      return
    }

    const delayMs = GENERAL_RETRY_DELAYS_MS[Math.min(this.retryCount, GENERAL_RETRY_DELAYS_MS.length - 1)]
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null
      this.retryCount = Math.min(this.retryCount + 1, GENERAL_RETRY_DELAYS_MS.length - 1)
      void this.requestAndPlayTrack({
        forceSwitch: true,
        allowFallback: true,
      })
    }, delayMs)
  }

  private cancelRetry(): void {
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private scheduleRemoteRecovery(): void {
    this.cancelRemoteRecovery()
    if (!this.currentTrack?.isFallback || this.musicMuted || !this.isActivated) {
      return
    }

    const delayMs = REMOTE_RECOVERY_DELAYS_MS[Math.min(this.remoteRecoveryAttempt, REMOTE_RECOVERY_DELAYS_MS.length - 1)]
    this.remoteRecoveryTimer = window.setTimeout(() => {
      this.remoteRecoveryTimer = null
      this.remoteRecoveryAttempt = Math.min(this.remoteRecoveryAttempt + 1, REMOTE_RECOVERY_DELAYS_MS.length - 1)

      if (!this.currentTrack?.isFallback || this.musicMuted || !this.isActivated) {
        return
      }

      void this.requestAndPlayTrack({
        forceSwitch: true,
        allowFallback: false,
        background: true,
      }).then((startedPlayback) => {
        if (!startedPlayback) {
          this.scheduleRemoteRecovery()
        }
      })
    }, delayMs)
  }

  private cancelRemoteRecovery(): void {
    if (this.remoteRecoveryTimer !== null) {
      window.clearTimeout(this.remoteRecoveryTimer)
      this.remoteRecoveryTimer = null
    }
  }

  private rememberTrackId(styleId: MusicStyleId, trackId: string): void {
    const recentTrackIds = this.getRecentTrackIds(styleId)
    this.recentTrackIdsByStyle.set(
      styleId,
      [trackId, ...recentTrackIds.filter((entry) => entry !== trackId)].slice(0, RECENT_TRACK_MEMORY)
    )
  }

  private getRecentTrackIds(styleId: MusicStyleId): string[] {
    return this.recentTrackIdsByStyle.get(styleId) ?? []
  }

  private applyMusicAttribution(track: MusicTrackDescriptor): void {
    this.musicAttribution = {
      provider: track.provider,
      providerLabel: track.providerLabel,
      title: track.title,
      artist: track.artist,
      trackUrl: track.trackUrl,
      providerUrl: track.providerUrl,
      licenseLabel: track.licenseLabel,
      isFallback: track.isFallback,
    }
    this.notifyMusicAttributionListeners()
  }

  private clearMusicAttribution(): void {
    this.musicAttribution = createEmptyMusicAttribution()
    this.notifyMusicAttributionListeners()
  }

  private updateStatus(
    state: MusicPlaybackState,
    overrides: Partial<Omit<MusicPlaybackStatusSnapshot, 'state'>> = {}
  ): void {
    const defaultMessage =
      state === 'muted'
        ? 'Musik ist ausgeschaltet.'
        : state === 'loading'
          ? 'Suche passenden Track.'
          : state === 'recovering'
            ? 'Stelle Musik wieder her.'
            : state === 'fallback'
              ? 'Lokaler Fallback aktiv.'
              : state === 'playing'
                ? 'Musik spielt.'
                : 'Musik bereit.'

    this.musicPlaybackStatus = createMusicPlaybackStatus(state, {
      ...overrides,
      message: overrides.message ?? defaultMessage,
    })
    this.notifyMusicPlaybackStatusListeners()
  }

  private isAudioElementHealthy(
    audio: HTMLAudioElement,
    options: {
      requireConfiguredVolume: boolean
    }
  ): boolean {
    if (audio.error || audio.paused || audio.ended) {
      return false
    }

    if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return false
    }

    if (audio.muted || audio.defaultMuted) {
      return false
    }

    if (
      options.requireConfiguredVolume &&
      Math.abs(audio.volume - this.getTargetMusicVolume()) > MUSIC_VOLUME_SYNC_EPSILON
    ) {
      return false
    }

    return true
  }

  private restorePlaybackFlags(audio: HTMLAudioElement): void {
    if (audio.defaultMuted) {
      audio.defaultMuted = false
    }

    if (audio.muted) {
      audio.muted = false
    }
  }

  private restoreConfiguredPlaybackState(audio: HTMLAudioElement): void {
    this.restorePlaybackFlags(audio)

    const targetVolume = this.getTargetMusicVolume()
    if (Math.abs(audio.volume - targetVolume) > MUSIC_VOLUME_SYNC_EPSILON) {
      audio.volume = targetVolume
    }
  }

  private getTargetMusicVolume(): number {
    return this.musicVolume
  }

  private notifyMusicMutedListeners(): void {
    this.musicMutedListeners.forEach((listener) => {
      listener()
    })
  }

  private notifyMusicVolumeListeners(): void {
    this.musicVolumeListeners.forEach((listener) => {
      listener()
    })
  }

  private notifyMusicStyleListeners(): void {
    this.musicStyleListeners.forEach((listener) => {
      listener()
    })
  }

  private notifyMusicAttributionListeners(): void {
    this.musicAttributionListeners.forEach((listener) => {
      listener()
    })
  }

  private notifyMusicPlaybackStatusListeners(): void {
    this.musicPlaybackStatusListeners.forEach((listener) => {
      listener()
    })
  }

  private async fadeAudioElementVolume(
    audio: HTMLAudioElement,
    targetVolume: number,
    durationMs: number
  ): Promise<void> {
    if (durationMs <= 0) {
      audio.volume = targetVolume
      return
    }

    this.cancelPendingFade()

    const startVolume = audio.volume
    if (Math.abs(startVolume - targetVolume) < MUSIC_VOLUME_CHANGE_EPSILON) {
      audio.volume = targetVolume
      return
    }

    await new Promise<void>((resolve) => {
      this.musicFadeResolver = resolve
      const startedAt = performance.now()
      const animate = (timestamp: number) => {
        const progress = Math.min(1, (timestamp - startedAt) / durationMs)
        audio.volume = startVolume + (targetVolume - startVolume) * progress

        if (progress < 1) {
          this.musicFadeFrame = window.requestAnimationFrame(animate)
          return
        }

        this.musicFadeFrame = null
        this.musicFadeResolver = null
        resolve()
      }

      this.musicFadeFrame = window.requestAnimationFrame(animate)
    })
  }

  private cancelPendingFade(): void {
    if (this.musicFadeFrame !== null) {
      window.cancelAnimationFrame(this.musicFadeFrame)
      this.musicFadeFrame = null
    }

    if (this.musicFadeResolver) {
      const resolveFade = this.musicFadeResolver
      this.musicFadeResolver = null
      resolveFade()
    }
  }
}
