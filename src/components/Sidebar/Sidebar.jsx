import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Sidebar.css';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

const EqualizerIcon = ({ active }) => (
    <div className={`equalizer-icon${active ? ' playing' : ''}`}>
        <span className="eq-bar" />
        <span className="eq-bar" />
        <span className="eq-bar" />
    </div>
);

const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
);

// Star icon — filled when active
const StarIcon = ({ filled }) => filled ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zm-10 6.53l-3.72 2.23 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.37 4.38.38-3.32 2.88 1 4.28L12 15.77z" />
    </svg>
);

const Sidebar = ({
    onSelectChannel,
    activeChannelId,
    currentSong,
    isPlaying,
    playlists,
    activePlaylistId,
    onCreatePlaylist,
    onDeletePlaylist,
    onOpenPlaylist,
    onDropOnPlaylist,
    onHome,
    favouriteChannels,
    onFavouriteChannel,
}) => {
    const [activeTab, setActiveTab] = useState('channels');
    const [channelSearchQuery, setChannelSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [dragOverId, setDragOverId] = useState(null);
    const [creatingPlaylist, setCreatingPlaylist] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const debounceRef = useRef(null);
    const newNameInputRef = useRef(null);

    useEffect(() => {
        clearTimeout(debounceRef.current);

        if (!channelSearchQuery.trim()) {
            setSearchResults(null);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/channels/search?q=${encodeURIComponent(channelSearchQuery.trim())}`
                );
                setSearchResults(response.data);
            } catch (err) {
                console.error('Channel search failed:', err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(debounceRef.current);
    }, [channelSearchQuery]);

    useEffect(() => {
        if (creatingPlaylist && newNameInputRef.current) {
            newNameInputRef.current.focus();
        }
    }, [creatingPlaylist]);

    const handleSelectChannel = (channel) => {
        onSelectChannel(channel);
        setChannelSearchQuery('');
        setSearchResults(null);
    };

    const handleCreateConfirm = () => {
        const name = newPlaylistName.trim();
        if (name) onCreatePlaylist(name);
        setCreatingPlaylist(false);
        setNewPlaylistName('');
    };

    const handleCreateKeyDown = (e) => {
        if (e.key === 'Enter') handleCreateConfirm();
        if (e.key === 'Escape') { setCreatingPlaylist(false); setNewPlaylistName(''); }
    };

    const handleDragOver = (e, playlistId) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOverId(playlistId);
    };

    const handleDragLeave = () => setDragOverId(null);

    const handleDrop = (e, playlistId) => {
        e.preventDefault();
        setDragOverId(null);
        try {
            const song = JSON.parse(e.dataTransfer.getData('application/json'));
            onDropOnPlaylist(playlistId, song);
        } catch (err) {
            // ignore invalid drop payload
            console.warn('Unable to parse dropped data', err);
        }
    };

    const isFav = (channelId) => favouriteChannels.some((c) => c.id === channelId);
    const isSearchMode = channelSearchQuery.trim().length > 0;

    return (
        <div className="sidebar">
            <div className="sidebar-brand">
                <span className="brand-relody" onClick={onHome} title="Home">Relody</span>
                <span className="brand-music"> music</span>
            </div>

            {/* Tab bar */}
            <div className="sidebar-tabs">
                <button
                    className={`sidebar-tab${activeTab === 'channels' ? ' active' : ''}`}
                    onClick={() => setActiveTab('channels')}
                >Channels</button>
                <button
                    className={`sidebar-tab${activeTab === 'playlists' ? ' active' : ''}`}
                    onClick={() => setActiveTab('playlists')}
                >Playlists</button>
            </div>

            {/* ── Channels tab ── */}
            {activeTab === 'channels' && (
                <div className="sidebar-content">
                    {/* Search bar */}
                    <div className="sidebar-search">
                        <span className="sidebar-search-icon"><SearchIcon /></span>
                        <input
                            className="sidebar-search-input"
                            type="text"
                            placeholder="Search channels..."
                            value={channelSearchQuery}
                            onChange={(e) => setChannelSearchQuery(e.target.value)}
                        />
                    </div>

                    {isSearchMode ? (
                        /* Search results */
                        <div className={`channel-list${isSearching ? ' searching' : ''}`}>
                            {(searchResults || []).map((channel) => (
                                <div
                                    key={channel.id}
                                    className={`channel-item${activeChannelId === channel.id ? ' active' : ''}`}
                                    onClick={() => handleSelectChannel(channel)}
                                >
                                    <span className="channel-name">{channel.name}</span>
                                    <button
                                        className={`fav-btn${isFav(channel.id) ? ' active' : ''}`}
                                        title={isFav(channel.id) ? 'Remove from favourites' : 'Add to favourites'}
                                        onClick={(e) => { e.stopPropagation(); onFavouriteChannel(channel); }}
                                    >
                                        <StarIcon filled={isFav(channel.id)} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Favourite channels */
                        <div className="channel-list">
                            {favouriteChannels.length === 0 ? (
                                <div className="channels-empty">
                                    Search for channels and star them to save favourites
                                </div>
                            ) : (
                                favouriteChannels.map((channel) => (
                                    <div
                                        key={channel.id}
                                        className={`channel-item${activeChannelId === channel.id ? ' active' : ''}`}
                                        onClick={() => handleSelectChannel(channel)}
                                    >
                                        <span className="channel-name">{channel.name}</span>
                                        <button
                                            className="fav-btn active"
                                            title="Remove from favourites"
                                            onClick={(e) => { e.stopPropagation(); onFavouriteChannel(channel); }}
                                        >
                                            <StarIcon filled={true} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Playlists tab ── */}
            {activeTab === 'playlists' && (
                <div className="sidebar-content">
                    <div className="playlists-header">
                        <span className="playlists-label">Playlists</span>
                        <button
                            className="playlist-add-btn"
                            onClick={() => setCreatingPlaylist(true)}
                            title="New playlist"
                        >＋</button>
                    </div>

                    {creatingPlaylist && (
                        <div className="playlist-create-row">
                            <input
                                ref={newNameInputRef}
                                className="playlist-name-input"
                                type="text"
                                placeholder="Playlist name"
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                onKeyDown={handleCreateKeyDown}
                                onBlur={handleCreateConfirm}
                            />
                        </div>
                    )}

                    {playlists.length === 0 && !creatingPlaylist && (
                        <div className="playlists-empty">Drag songs here to create a playlist</div>
                    )}

                    {playlists.map((pl) => (
                        <div
                            key={pl.id}
                            className={`playlist-item${activePlaylistId === pl.id ? ' active' : ''}${dragOverId === pl.id ? ' drag-over' : ''}`}
                            onClick={() => onOpenPlaylist(pl.id)}
                            onDragOver={(e) => handleDragOver(e, pl.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, pl.id)}
                        >
                            <div className="playlist-item-info">
                                <span className="playlist-name">{pl.name}</span>
                                <span className="playlist-count">{pl.songs.length} songs</span>
                            </div>
                            <button
                                className="playlist-delete-btn"
                                onClick={(e) => { e.stopPropagation(); onDeletePlaylist(pl.id); }}
                                title="Delete playlist"
                            >×</button>
                        </div>
                    ))}
                </div>
            )}

            {currentSong && (
                <div className="sidebar-now-playing">
                    <EqualizerIcon active={isPlaying} />
                    <img
                        src={currentSong.cover}
                        alt={currentSong.title}
                        className="sidebar-thumb"
                    />
                    <div className="sidebar-song-info">
                        <span className="sidebar-song-title">{currentSong.title}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;
