import { SoundConfig } from '../types';

class SoundService {
  private audioCtx: AudioContext | null = null;
  private continuousTimer: any = null;
  private customAudioElem: HTMLAudioElement | null = null;
  private isCurrentlyRinging: boolean = false;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Play synthetic tone using Web Audio API
  private playTone(freq: number, type: OscillatorType, durationMs: number, gainVal: number, startTimeOffset = 0) {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime + startTimeOffset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(gainVal, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (durationMs / 1000));

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + (durationMs / 1000) + 0.05);
    } catch (e) {
      console.error('Audio playback error', e);
    }
  }

  // Play sound according to configuration preset
  public playSound(cfg: SoundConfig) {
    const vol = cfg.volume ?? 0.8;

    if (cfg.vibration && navigator.vibrate) {
      try {
        navigator.vibrate([250, 100, 250, 100, 350]);
      } catch (e) {}
    }

    // If custom audio is set and chosen
    if (cfg.preset === 'custom' && cfg.customAudioUrl) {
      try {
        const audio = new Audio(cfg.customAudioUrl);
        audio.volume = vol;
        audio.play().catch(e => console.warn('Custom audio playback blocked:', e));
        return;
      } catch (e) {}
    }

    // Built-in synthesized presets
    switch (cfg.preset) {
      case 'express': {
        // Upbeat 3-tone fast ride alert
        this.playTone(659.25, 'sine', 160, vol * 0.7, 0);     // E5
        this.playTone(830.61, 'triangle', 180, vol * 0.8, 0.16); // G#5
        this.playTone(1046.50, 'sine', 280, vol * 0.9, 0.32); // C6
        break;
      }
      case 'radar': {
        // Uber-style Sonar Radar pulse
        this.playTone(980, 'sine', 150, vol * 0.8, 0);
        this.playTone(1320, 'sine', 200, vol * 0.9, 0.18);
        this.playTone(880, 'sine', 180, vol * 0.7, 0.40);
        break;
      }
      case 'siren': {
        // Urgent high-low ambulance/taxi dispatch siren
        this.playTone(850, 'sawtooth', 250, vol * 0.6, 0);
        this.playTone(1150, 'sawtooth', 250, vol * 0.65, 0.26);
        this.playTone(850, 'sawtooth', 250, vol * 0.6, 0.52);
        this.playTone(1150, 'sawtooth', 250, vol * 0.65, 0.78);
        break;
      }
      case 'horn': {
        // Realistic dual-tone vehicle horn
        this.playTone(435, 'sawtooth', 220, vol * 0.6, 0);
        this.playTone(520, 'sawtooth', 220, vol * 0.55, 0);
        this.playTone(435, 'sawtooth', 320, vol * 0.6, 0.28);
        this.playTone(520, 'sawtooth', 320, vol * 0.55, 0.28);
        break;
      }
      case 'bell':
      default: {
        // Clean ding bell
        this.playTone(1200, 'sine', 350, vol * 0.8, 0);
        this.playTone(1600, 'sine', 450, vol * 0.6, 0.12);
        break;
      }
    }
  }

  // Start continuous ringtone loop (until accepted or stopped)
  public startContinuousRingtone(cfg: SoundConfig) {
    if (this.isCurrentlyRinging) return;
    this.isCurrentlyRinging = true;

    // Immediately play first alert
    this.playSound(cfg);

    // If custom audio with looping
    if (cfg.preset === 'custom' && cfg.customAudioUrl) {
      try {
        if (!this.customAudioElem) {
          this.customAudioElem = new Audio(cfg.customAudioUrl);
        } else {
          this.customAudioElem.src = cfg.customAudioUrl;
        }
        this.customAudioElem.loop = true;
        this.customAudioElem.volume = cfg.volume ?? 0.8;
        this.customAudioElem.play().catch(e => {
          // If browser policy blocks html5 audio loop, fallback to Web Audio interval
          this.setupSyntheticLoop(cfg);
        });
        return;
      } catch (e) {
        this.setupSyntheticLoop(cfg);
      }
    } else {
      this.setupSyntheticLoop(cfg);
    }
  }

  private setupSyntheticLoop(cfg: SoundConfig) {
    // Loop interval: play every 1.5 seconds repeatedly
    if (this.continuousTimer) clearInterval(this.continuousTimer);
    this.continuousTimer = setInterval(() => {
      if (!this.isCurrentlyRinging) {
        clearInterval(this.continuousTimer);
        return;
      }
      this.playSound(cfg);
    }, 1500);
  }

  // Stop continuous ringtone immediately
  public stopContinuousRingtone() {
    this.isCurrentlyRinging = false;
    if (this.continuousTimer) {
      clearInterval(this.continuousTimer);
      this.continuousTimer = null;
    }
    if (this.customAudioElem) {
      try {
        this.customAudioElem.pause();
        this.customAudioElem.currentTime = 0;
      } catch (e) {}
    }
  }

  public isRinging(): boolean {
    return this.isCurrentlyRinging;
  }
}

export const soundService = new SoundService();
