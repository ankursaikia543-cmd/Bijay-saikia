import React, { useState } from 'react';
import { Volume2, VolumeX, Music, Upload, Play, Square, Check, X, BellRing } from 'lucide-react';
import { SoundConfig } from '../types';
import { soundService } from '../services/soundService';
import { saveSoundConfig } from '../services/storage';

interface Props {
  soundConfig: SoundConfig;
  onUpdate: (cfg: SoundConfig) => void;
  onClose: () => void;
}

export const SoundSettingsModal: React.FC<Props> = ({ soundConfig, onUpdate, onClose }) => {
  const [cfg, setCfg] = useState<SoundConfig>({ ...soundConfig });
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const presets: { id: SoundConfig['preset']; name: string; desc: string; icon: string }[] = [
    { id: 'express' as any, name: 'Easy Trip Chime', desc: 'Upbeat 3-tone fast ride chime', icon: '⚡' },
    { id: 'radar', name: 'Sonar Radar Ping', desc: 'Pulsing sonar dispatch ring', icon: '📡' },
    { id: 'siren', name: 'Emergency Siren', desc: 'Urgent high-pitch repeated tone', icon: '🚨' },
    { id: 'horn', name: 'Taxi Double Horn', desc: 'Realistic dual-tone street beep', icon: '📯' },
    { id: 'bell', name: 'Soft Ding Bell', desc: 'Smooth pleasant chime', icon: '🔔' },
  ];

  const handleSelectPreset = (preset: SoundConfig['preset']) => {
    const updated = { ...cfg, preset };
    setCfg(updated);
    saveSoundConfig(updated);
    onUpdate(updated);
    soundService.playSound(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const updated: SoundConfig = {
        ...cfg,
        preset: 'custom',
        customAudioUrl: dataUrl,
        customAudioName: file.name
      };
      setCfg(updated);
      saveSoundConfig(updated);
      onUpdate(updated);
      soundService.playSound(updated);
    };
    reader.readAsDataURL(file);
  };

  const toggleTestSound = () => {
    if (isPlayingTest) {
      soundService.stopContinuousRingtone();
      setIsPlayingTest(false);
    } else {
      setIsPlayingTest(true);
      if (cfg.continuousLoop) {
        soundService.startContinuousRingtone(cfg);
        // Auto stop after 5 seconds of test
        setTimeout(() => {
          soundService.stopContinuousRingtone();
          setIsPlayingTest(false);
        }, 5000);
      } else {
        soundService.playSound(cfg);
        setTimeout(() => setIsPlayingTest(false), 800);
      }
    }
  };

  const handleVolumeChange = (vol: number) => {
    const updated = { ...cfg, volume: vol };
    setCfg(updated);
    saveSoundConfig(updated);
    onUpdate(updated);
  };

  const handleToggleContinuous = () => {
    const updated = { ...cfg, continuousLoop: !cfg.continuousLoop };
    setCfg(updated);
    saveSoundConfig(updated);
    onUpdate(updated);
  };

  const handleToggleVibration = () => {
    const updated = { ...cfg, vibration: !cfg.vibration };
    setCfg(updated);
    saveSoundConfig(updated);
    onUpdate(updated);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border-2 border-slate-900 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-yellow-400 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center text-xl">
              <BellRing className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Notification & Ringtone</h2>
              <p className="text-xs text-yellow-400/80">Customize Ride Alerts & Driver Sound</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (isPlayingTest) soundService.stopContinuousRingtone();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          {/* Continuous Ringing Notice */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 flex items-start gap-3">
            <div className="text-xl mt-0.5">🔔</div>
            <div className="text-xs leading-relaxed text-amber-950">
              <strong className="block text-amber-900 text-sm font-bold">Continuous Driver Ringtone:</strong>
              When enabled, incoming rides will ring non-stop until the driver clicks <strong>Accept</strong> or turns Off-Duty!
            </div>
          </div>

          {/* Preset options */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 block">
              Built-in Ringtone Presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {presets.map((p) => {
                const isSelected = cfg.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    className={`p-3 rounded-2xl text-left border-2 transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-yellow-500 bg-yellow-50 shadow-sm ring-2 ring-yellow-400/40'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{p.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] text-slate-500">{p.desc}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Upload Section */}
          <div className="p-3.5 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-950">Upload Custom Ringtone (MP3/WAV)</span>
              </div>
              {cfg.preset === 'custom' && (
                <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer bg-white border border-indigo-200 hover:border-indigo-400 px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-indigo-700 transition shadow-xs">
                <Upload className="w-3.5 h-3.5" />
                <span>{cfg.customAudioName || 'Choose Audio File (.mp3, .wav)'}</span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {cfg.customAudioUrl && (
                <button
                  onClick={() => handleSelectPreset('custom')}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    cfg.preset === 'custom'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200'
                  }`}
                >
                  Use This
                </button>
              )}
            </div>
            {cfg.customAudioName && (
              <p className="text-[10px] text-slate-500 mt-1.5 truncate">
                Saved: {cfg.customAudioName}
              </p>
            )}
          </div>

          {/* Volume Slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                {cfg.volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                Ringtone Volume
              </label>
              <span className="text-xs font-bold text-slate-800">{Math.round(cfg.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={cfg.volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-yellow-500 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* Controls Switches */}
          <div className="space-y-2.5 pt-1">
            <div
              onClick={handleToggleContinuous}
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">Continuous Ringtone on Pending Rides</div>
                <div className="text-[10px] text-slate-500">Rings repeatedly until driver clicks Accept</div>
              </div>
              <div
                className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                  cfg.continuousLoop ? 'bg-yellow-500 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
              </div>
            </div>

            <div
              onClick={handleToggleVibration}
              className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100/70 transition"
            >
              <div>
                <div className="text-xs font-bold text-slate-900">Vibration Alert</div>
                <div className="text-[10px] text-slate-500">Vibrate phone along with ringtone on mobile</div>
              </div>
              <div
                className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center ${
                  cfg.vibration ? 'bg-yellow-500 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Test Sound Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
          <button
            onClick={toggleTestSound}
            className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition shadow-xs ${
              isPlayingTest
                ? 'bg-rose-600 text-white hover:bg-rose-700'
                : 'bg-slate-900 text-yellow-400 hover:bg-slate-800'
            }`}
          >
            {isPlayingTest ? (
              <>
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Test Sound</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-yellow-400" />
                <span>Test Current Sound</span>
              </>
            )}
          </button>
          <button
            onClick={() => {
              if (isPlayingTest) soundService.stopContinuousRingtone();
              onClose();
            }}
            className="py-3 px-5 rounded-xl font-bold text-sm bg-yellow-400 text-slate-950 hover:bg-yellow-500 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
