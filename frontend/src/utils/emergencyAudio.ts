/**
 * Emergency Alarm & Voice Alert System
 *
 * Combines Web Audio API synthesized klaxon sirens with Web Speech Synthesis API
 * for urgent, browser-native vocal alerts during anomaly injections.
 */

class EmergencyAudioController {
  private audioCtx: AudioContext | null = null
  private isPlaying: boolean = false
  private voiceTimeout: number | null = null

  public playAlarm(stationName: string, anomalyName: string, severity: string = 'CRITICAL') {
    this.stop()
    this.isPlaying = true

    // 1. Synthesize multi-tone Klaxon Siren via Web Audio API
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass()
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume()
        }

        const now = this.audioCtx.currentTime

        // Play 3 rapid alarm sweeps (Klaxon bursts)
        for (let i = 0; i < 3; i++) {
          const startTime = now + i * 0.45
          const osc = this.audioCtx.createOscillator()
          const gain = this.audioCtx.createGain()

          osc.type = 'sawtooth'
          osc.frequency.setValueAtTime(600, startTime)
          osc.frequency.exponentialRampToValueAtTime(950, startTime + 0.22)
          osc.frequency.setValueAtTime(950, startTime + 0.22)
          osc.frequency.exponentialRampToValueAtTime(600, startTime + 0.38)

          gain.gain.setValueAtTime(0.001, startTime)
          gain.gain.linearRampToValueAtTime(0.18, startTime + 0.05)
          gain.gain.linearRampToValueAtTime(0.15, startTime + 0.25)
          gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.42)

          osc.connect(gain)
          gain.connect(this.audioCtx.destination)

          osc.start(startTime)
          osc.stop(startTime + 0.42)
        }
      }
    } catch (e) {
      console.warn('Web Audio alarm synthesizer error:', e)
    }

    // 2. Synthesize urgent Alert Voice Announcement via Web Speech API
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()

        const stationLabel = stationName.toLowerCase() === 'maitri' ? 'Maitri' : 'Bharati'
        const alertSpeech = `Emergency Warning! ${severity} anomaly detected at ${stationLabel} station: ${anomalyName}. Immediate response required.`

        const utterance = new SpeechSynthesisUtterance(alertSpeech)
        utterance.rate = 0.94
        utterance.pitch = 1.05
        utterance.volume = 1.0

        // Select an English voice if available
        const voices = window.speechSynthesis.getVoices()
        const engVoice = voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            (v.name.includes('David') ||
              v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Samantha') ||
              v.name.includes('Daniel')),
        )
        if (engVoice) {
          utterance.voice = engVoice
        }

        // Delay voice slightly so the initial klaxon burst sounds first
        this.voiceTimeout = window.setTimeout(() => {
          if (this.isPlaying) {
            window.speechSynthesis.speak(utterance)
          }
        }, 550)
      } catch (e) {
        console.warn('Web Speech alert failed:', e)
      }
    }
  }

  public stop() {
    this.isPlaying = false

    if (this.voiceTimeout) {
      clearTimeout(this.voiceTimeout)
      this.voiceTimeout = null
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch {}
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close()
      } catch {}
      this.audioCtx = null
    }
  }
}

export const emergencyAudio = new EmergencyAudioController()
