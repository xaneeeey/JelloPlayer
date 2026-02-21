import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import AlbumGrid from '../AlbumGrid/AlbumGrid';
import './MainContent.css';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

const SearchIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
);

const MainContent = ({
    songs,
    onPlaySong,
    onAddToQueue,
    channelName,
    channelId,
    mode = 'channel',   // 'home' | 'channel' | 'playlist'
    onAddAllToQueue,
    homeTitle = 'Trending Music',
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const debounceRef = useRef(null);

    // Reset search when channel/mode changes
    useEffect(() => {
        setSearchQuery('');
        setSearchResults(null);
        setIsSearching(false);
    }, [songs, mode]);

    // Debounced server-side search (channel mode only)
    useEffect(() => {
        if (mode !== 'channel') return;
        clearTimeout(debounceRef.current);

        if (!searchQuery.trim()) {
            setSearchResults(null);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const response = await axios.get(
                    `${API_BASE_URL}/search/${channelId}?q=${encodeURIComponent(searchQuery.trim())}`
                );
                setSearchResults(response.data);
            } catch (err) {
                console.error('Search failed:', err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(debounceRef.current);
    }, [searchQuery, channelId, mode]);

    if (mode === 'home') {
        return (
            <div className="main-content">
                {songs.length === 0 ? (
                    <div className="home-view">
                        <span className="home-logo">Relody</span>
                        <p className="home-subtitle">Loading...</p>
                    </div>
                ) : (
                    <>
                        <header className="main-header">
                            <h1>{homeTitle}</h1>
                        </header>
                        <div className="content-scroll">
                            <AlbumGrid
                                songs={songs}
                                onPlaySong={onPlaySong}
                                onAddToQueue={onAddToQueue}
                            />
                        </div>
                    </>
                )}
            </div>
        );
    }

    const displayedSongs = searchResults !== null ? searchResults : songs;

    return (
        <div className="main-content">
            <header className="main-header">
                <h1>{channelName || 'Select a Channel'}</h1>
                <div className="main-header-actions">
                    {mode === 'playlist' && songs.length > 0 && (
                        <button className="add-all-btn" onClick={onAddAllToQueue}>
                            + Add all to queue
                        </button>
                    )}
                    {mode === 'channel' && (
                        <div className="search-container">
                            <span className="search-icon"><SearchIcon /></span>
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Search all songs..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </header>
            <div className={`content-scroll${isSearching ? ' searching' : ''}`}>
                <AlbumGrid
                    songs={displayedSongs}
                    onPlaySong={onPlaySong}
                    onAddToQueue={onAddToQueue}
                />
            </div>
        </div>
    );
};

export default MainContent;
