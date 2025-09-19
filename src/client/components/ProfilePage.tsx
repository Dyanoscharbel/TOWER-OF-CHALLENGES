import { useEffect, useState } from 'react';
import { User, Camera, ArrowLeft, Crown, Sparkles } from 'lucide-react';

interface ProfilePageProps {
  onBack?: () => void;
}

export default function ProfilePage({ onBack }: ProfilePageProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // removed file input (no upload)
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([]);
  const [loadingAvatars, setLoadingAvatars] = useState<boolean>(true);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [bgmMuted, setBgmMuted] = useState<boolean>(() => window.localStorage.getItem('bgmMuted') === 'true');
  const [bgmVolume, setBgmVolume] = useState<number>(() => {
    const v = parseFloat(window.localStorage.getItem('bgmVolume') || '0.5');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
  });
  const [sfxVolume, setSfxVolume] = useState<number>(() => {
    const v = parseFloat(window.localStorage.getItem('sfxVolume') || '0.6');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6;
  });

  // Load player id and discover avatar images from /Avatar
  useEffect(() => {
    const loadPlayer = async () => {
      try {
        const res = await fetch('/api/player/init');
        const json = await res.json();
        if (json?.status === 'success' && json.data?.reddit_id) {
          setPlayerId(json.data.reddit_id as string);
          if (json.data.avatar_url) {
            setSelectedAvatar(json.data.avatar_url as string);
          }
        }
      } catch (_) {}
    };
    loadPlayer();
  }, []);

  // Apply audio settings to the global background audio
  useEffect(() => {
    const bg = (window as any).__bgAudioRef?.current as HTMLAudioElement | null;
    if (bg) {
      bg.muted = bgmMuted;
      bg.volume = bgmVolume;
    }
    window.localStorage.setItem('bgmMuted', String(bgmMuted));
    window.localStorage.setItem('bgmVolume', String(bgmVolume));
  }, [bgmMuted, bgmVolume]);

  // Persist SFX volume in localStorage for other games to use
  useEffect(() => {
    window.localStorage.setItem('sfxVolume', String(sfxVolume));
  }, [sfxVolume]);

  useEffect(() => {
    let cancelled = false;
    // Probe explicit list Avatar1.jpg .. Avatar73.jpg
    const candidates: string[] = [];
    for (let i = 1; i <= 73; i++) candidates.push(`Avatar${i}.jpg`);

    const found: string[] = [];
    let pending = candidates.length;
    if (pending === 0) {
      setLoadingAvatars(false);
      return;
    }
    const done = () => {
      if (!cancelled) {
        setAvailableAvatars(found);
        setLoadingAvatars(false);
      }
    };
    candidates.forEach((name) => {
      const img = new Image();
      img.onload = () => { found.push(name); if (--pending === 0) done(); };
      img.onerror = () => { if (--pending === 0) done(); };
      img.src = `/Avatar/${name}`;
    });
    return () => { cancelled = true; };
  }, []);

  // upload removed

  const handleAvatarSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId);
    setPreviewUrl(null);
  };

  const handleSave = async () => {
    // Persist avatar_url to the chosen jpg filename
    if (!playerId || !selectedAvatar) return;
    const avatarUrlValue = selectedAvatar;
    try {
      setSaveStatus('saving');
      const res = await fetch(`/api/admin/players/${encodeURIComponent(playerId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: avatarUrlValue }),
      });
      if (res.ok) {
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch (_) {
      setSaveStatus('error');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Main background: arena image + dark overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(rgba(10,10,25,0.78), rgba(10,10,25,0.9)), url('/arena-background.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      {/* Magic light effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-gradient-radial from-purple-400 via-transparent to-transparent opacity-20 rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
        <div className="absolute bottom-1/4 left-1/4 w-16 h-16 bg-gradient-radial from-pink-400 via-transparent to-transparent opacity-15 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-1/4 right-1/4 w-16 h-16 bg-gradient-radial from-blue-400 via-transparent to-transparent opacity-15 rounded-full animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 py-4 sm:py-8 px-2 sm:px-4">
        {/* Header */}
        <div className="max-w-4xl mx-auto text-center mb-6 sm:mb-8">
          <div className="flex justify-center items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
            <User className="w-8 h-8 sm:w-12 sm:h-12 text-purple-300 drop-shadow-lg" />
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-blue-300 bg-clip-text text-transparent font-serif drop-shadow-lg">
              Hero Profile
            </h1>
            <Sparkles className="w-8 h-8 sm:w-12 sm:h-12 text-purple-300 drop-shadow-lg" />
          </div>
          <p className="text-sm sm:text-lg text-purple-100 font-serif italic drop-shadow-md px-4">
            Customize your avatar and forge your identity in the tower
          </p>
          <div className="w-24 sm:w-32 h-1 bg-gradient-to-r from-transparent via-pink-400 to-transparent mx-auto mt-3 sm:mt-4 rounded shadow-lg"></div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden backdrop-saturate-150 ring-1 ring-white/10">
            {/* Profile header */}
            <div className="bg-gradient-to-r from-purple-700/70 via-pink-600/70 to-blue-700/70 text-purple-50 p-4 sm:p-6 text-center border-b border-white/10 backdrop-blur-lg rounded-t-2xl sm:rounded-t-3xl">
              <Crown className="mx-auto mb-2 sm:mb-3 w-8 h-8 sm:w-10 sm:h-10 text-white/90 drop-shadow-lg" />
              <h2 className="text-lg sm:text-2xl font-bold font-serif">Avatar Settings</h2>
              <p className="mt-1 sm:mt-2 opacity-90 text-sm sm:text-base">Choose your representation in the tower</p>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              {/* Current avatar preview */}
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-block relative">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-4xl sm:text-6xl shadow-2xl border-2 sm:border-4 border-white/20 backdrop-blur-lg">
                    {previewUrl ? (
                      <img 
                        src={previewUrl} 
                        alt="Avatar preview" 
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : selectedAvatar ? (
                    <img src={`/Avatar/${selectedAvatar}`} alt="avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 sm:w-16 sm:h-16 text-white/80" />
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center border-2 border-white/20">
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-purple-200 mt-3 sm:mt-4 font-serif px-4">
                  {previewUrl ? 'Custom image' : selectedAvatar ? selectedAvatar : 'No avatar selected'}
                </h3>
              </div>

              {/* Custom image upload removed as requested */}

              {/* Avatar gallery from /Avatar */}
              <div className="mb-6 sm:mb-8">
                <h3 className="text-base sm:text-lg font-bold text-purple-200 mb-3 sm:mb-4 font-serif">Choose an avatar</h3>
                {loadingAvatars ? (
                  <div className="text-purple-200">Loading avatars...</div>
                ) : availableAvatars.length === 0 ? (
                  <div className="text-purple-300">No avatars found in /Avatar</div>
                ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
                    {availableAvatars.map((filename) => (
                    <button
                        key={filename}
                        onClick={() => handleAvatarSelect(filename)}
                        className={`p-1 sm:p-2 rounded-xl sm:rounded-2xl border-2 transition-all duration-300 hover:scale-105 sm:hover:scale-110 ${
                          selectedAvatar === filename
                          ? 'border-pink-400 bg-pink-500/20 shadow-lg'
                          : 'border-white/20 bg-white/5 hover:border-purple-400 hover:bg-white/10'
                      }`}
                    >
                        <img src={`/Avatar/${filename}`} alt={filename} className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover" />
                    </button>
                  ))}
                </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <button
                  onClick={handleSave}
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-500 hover:via-pink-500 hover:to-blue-500 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl sm:rounded-3xl font-bold text-base sm:text-lg transition-all duration-300 shadow-2xl border border-white/20 flex items-center justify-center gap-2 sm:gap-3 transform hover:scale-105"
                >
                  <Crown className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="hidden sm:inline">Save Avatar</span>
                  <span className="sm:hidden">Save</span>
                </button>
                {onBack && (
                  <button
                    onClick={onBack}
                    className="bg-white/10 hover:bg-white/15 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-2xl sm:rounded-3xl font-bold text-base sm:text-lg transition-all duration-300 shadow-lg border border-white/20 flex items-center justify-center gap-2 sm:gap-3"
                  >
                    <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                    Back
                  </button>
                )}
              </div>
              {saveStatus === 'saved' && (
                <div className="text-green-300 text-center mt-3">Avatar saved.</div>
              )}
              {saveStatus === 'error' && (
                <div className="text-red-300 text-center mt-3">Failed to save avatar.</div>
              )}

              {/* Audio settings */}
              <div className="mt-8 grid gap-4">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <h3 className="font-semibold text-purple-200 mb-2">Background Music</h3>
                  <label className="flex items-center gap-2 text-purple-100">
                    <input type="checkbox" checked={bgmMuted} onChange={(e) => setBgmMuted(e.target.checked)} />
                    Mute background music
                  </label>
                  <div className="mt-2">
                    <input type="range" min={0} max={1} step={0.01} value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full" />
                    <div className="text-xs opacity-80">BGM volume: {(bgmVolume * 100).toFixed(0)}%</div>
                  </div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <h3 className="font-semibold text-purple-200 mb-2">Sound Effects</h3>
                  <div className="mt-2">
                    <input type="range" min={0} max={1} step={0.01} value={sfxVolume} onChange={(e) => setSfxVolume(parseFloat(e.target.value))} className="w-full" />
                    <div className="text-xs opacity-80">SFX volume: {(sfxVolume * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative footer */}
          <div className="text-center mt-6 sm:mt-8 text-purple-200 drop-shadow-lg px-4">
            <p className="font-serif italic text-sm sm:text-lg">
              "Your avatar reflects your hero’s soul..."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
