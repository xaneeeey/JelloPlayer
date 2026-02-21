import React from 'react';
import './QueuePanel.css';

const ShuffleIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
    </svg>
);

const CloseIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
);

const QueuePanel = ({
    queue,
    queueIndex,
    onClose,
    onPlayFromQueue,
    onRemoveFromQueue,
    onShuffle,
    onClear,
}) => {
    return (
        <div className="queue-panel">
            <div className="queue-header">
                <span className="queue-title">Queue</span>
                <div className="queue-actions">
                    {queue.length > 1 && (
                        <button className="queue-action-btn" onClick={onShuffle} title="Shuffle">
                            <ShuffleIcon />
                        </button>
                    )}
                    {queue.length > 0 && (
                        <button className="queue-action-btn" onClick={onClear} title="Clear queue">
                            Clear
                        </button>
                    )}
                    <button className="queue-action-btn queue-close-btn" onClick={onClose} title="Close">
                        <CloseIcon />
                    </button>
                </div>
            </div>

            <div className="queue-list">
                {queue.length === 0 ? (
                    <div className="queue-empty">Queue is empty — add songs with the + button on any track</div>
                ) : (
                    queue.map((song, idx) => {
                        const isActive = idx === queueIndex;
                        return (
                            <div
                                key={`${song.id}-${idx}`}
                                className={`queue-item${isActive ? ' active' : ''}`}
                                onClick={() => onPlayFromQueue(idx)}
                            >
                                <img src={song.cover} alt={song.title} className="queue-item-thumb" />
                                <span className="queue-item-title">{song.title}</span>
                                <button
                                    className="queue-item-remove"
                                    onClick={(e) => { e.stopPropagation(); onRemoveFromQueue(idx); }}
                                    title="Remove"
                                >
                                    ×
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default QueuePanel;
