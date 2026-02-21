import React, { useState } from 'react';
import './PlayerBar.css';

const PrevIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
);
const NextIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
);
const PlayIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
    </svg>
);
const PauseIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);
const VolumeIcon = ({ muted }) => muted ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
    </svg>
) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
);

const PlayerBar = ({
    currentSong,
    isPlaying,
    onTogglePlay,
    onNext,
    onPrev,
    progress = 0,
    currentTime = '0:00',
    duration = '0:00',
    volume = 0.8,
    onVolumeChange,
    onShowQueue,
}) => {
    const [prevVolume, setPrevVolume] = useState(0.8);

    if (!currentSong) return null;

    // clamp progress defensively before using it in a style
    const safeProgress =
        Number.isFinite(progress) && progress >= 0
            ? Math.min(progress, 100)
            : 0;

    const isMuted = volume === 0;

    const handleMuteToggle = () => {
        if (isMuted) {
            onVolumeChange(prevVolume || 0.8);
        } else {
            setPrevVolume(volume);
            onVolumeChange(0);
        }
    };

    return (
        <div className="player-bar">
            {/* Blurred thumbnail background */}
            <div
                className="player-bg"
                style={{ backgroundImage: `url(${currentSong.cover})` }}
            />
            {/* Glass overlay on top of the blurred bg */}
            <div className="player-glass" />

            {/* Thin progress line at the very top */}
            <div className="player-progress-line">
                <div
                    className="player-progress-fill"
                    style={{ width: `${safeProgress}%` }}
                />
            </div>

            <div className="player-inner">
                {/* LEFT: thumbnail + song info — click to show queue */}
                <div className="player-left player-left-clickable" onClick={onShowQueue} title="Show queue">
                    <img
                        src={currentSong.cover}
                        alt="Now Playing"
                        className="player-thumb"
                    />
                    <div className="player-info">
                        <div className="player-title">{currentSong.title}</div>
                    </div>
                </div>

                {/* CENTER: time + controls + time */}
                <div className="player-center">
                    <span className="time-text">{currentTime}</span>
                    <button className="control-btn" onClick={onPrev}>
                        <PrevIcon />
                    </button>
                    <button className="control-btn play-btn" onClick={onTogglePlay}>
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button className="control-btn" onClick={onNext}>
                        <NextIcon />
                    </button>
                    <span className="time-text">{duration || currentSong.duration}</span>
                </div>

                {/* RIGHT: volume */}
                <div className="player-right">
                    <button className="control-btn vol-btn" onClick={handleMuteToggle}>
                        <VolumeIcon muted={isMuted} />
                    </button>
                    <input
                        className="volume-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        style={{
                            background: `linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.15) ${volume * 100}%)`
                        }}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    />
                </div>
            </div>
        </div>
    );
};

export default PlayerBar;
