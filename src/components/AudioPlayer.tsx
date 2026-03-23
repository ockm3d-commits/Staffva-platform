"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  storagePath: string | null;
  label?: string;
}

export default function AudioPlayer({ storagePath, label }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (storagePath) {
      loadSignedUrl();
    }
  }, [storagePath]);

  async function loadSignedUrl() {
    if (!storagePath) return;

    // If it's already a full URL (legacy data), use it directly
    if (storagePath.startsWith("http")) {
      setSignedUrl(storagePath);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/storage/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "voice-recordings",
          path: storagePath,
        }),
      });

      const data = await res.json();
      if (data.signedUrl) {
        setSignedUrl(data.signedUrl);
      } else {
        setError("Could not load audio");
      }
    } catch {
      setError("Failed to load audio");
    }
    setLoading(false);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }

  function handleTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }

  function handleLoadedMetadata() {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }

  function handleEnded() {
    setIsPlaying(false);
    setCurrentTime(0);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!storagePath) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        {label && <p className="text-xs font-semibold text-text/40 uppercase tracking-wider mb-2">{label}</p>}
        <p className="text-xs text-text/40 italic">Not recorded</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {label && <p className="text-xs font-semibold text-text/40 uppercase tracking-wider mb-2">{label}</p>}
        <p className="text-xs text-text/40">Loading audio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {label && <p className="text-xs font-semibold text-text/40 uppercase tracking-wider mb-2">{label}</p>}
        <p className="text-xs text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {label && (
        <p className="text-xs font-semibold text-text/40 uppercase tracking-wider mb-3">{label}</p>
      )}
      {signedUrl && (
        <>
          <audio
            ref={audioRef}
            src={signedUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            preload="metadata"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <div className="flex-1">
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
              />
            </div>
            <span className="text-xs text-text/40 shrink-0 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
