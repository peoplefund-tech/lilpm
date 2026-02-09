import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Music } from 'lucide-react';

/**
 * Audio Block Extension
 * Embeds audio files with playback controls
 */

// React component for audio player
const AudioComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
    const { src, title } = node.attrs;
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
            setIsLoaded(true);
        };
        const handleEnded = () => setIsPlaying(false);

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [src]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        if (!audio) return;
        const time = parseFloat(e.target.value);
        audio.currentTime = time;
        setCurrentTime(time);
    };

    const formatTime = (time: number) => {
        if (isNaN(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (!src) {
        return (
            <NodeViewWrapper>
                <div
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 border-dashed ${selected ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
                        }`}
                >
                    <Music className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Paste audio URL here..."
                            className="w-full bg-transparent border-none outline-none text-sm"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const input = e.target as HTMLInputElement;
                                    updateAttributes({ src: input.value });
                                }
                            }}
                        />
                    </div>
                </div>
            </NodeViewWrapper>
        );
    }

    return (
        <NodeViewWrapper>
            <div
                className={`rounded-lg border p-3 ${selected ? 'ring-2 ring-primary' : ''
                    } bg-card`}
            >
                <audio ref={audioRef} src={src} preload="metadata" />

                {/* Title */}
                {title && (
                    <div className="text-sm font-medium mb-2 truncate">{title}</div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-3">
                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                    >
                        {isPlaying ? (
                            <Pause className="h-4 w-4" />
                        ) : (
                            <Play className="h-4 w-4 ml-0.5" />
                        )}
                    </button>

                    {/* Progress */}
                    <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-10">
                            {formatTime(currentTime)}
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleSeek}
                            className="flex-1 h-1 rounded-full appearance-none bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                        />
                        <span className="text-xs text-muted-foreground w-10 text-right">
                            {formatTime(duration)}
                        </span>
                    </div>

                    {/* Volume */}
                    <button
                        onClick={toggleMute}
                        className="h-8 w-8 rounded flex items-center justify-center hover:bg-accent transition-colors"
                    >
                        {isMuted ? (
                            <VolumeX className="h-4 w-4 text-muted-foreground" />
                        ) : (
                            <Volume2 className="h-4 w-4 text-muted-foreground" />
                        )}
                    </button>

                    {/* Download */}
                    <a
                        href={src}
                        download
                        className="h-8 w-8 rounded flex items-center justify-center hover:bg-accent transition-colors"
                    >
                        <Download className="h-4 w-4 text-muted-foreground" />
                    </a>
                </div>
            </div>
        </NodeViewWrapper>
    );
};

export const AudioNode = Node.create({
    name: 'audio',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            src: {
                default: null,
            },
            title: {
                default: null,
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-type="audio"]',
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'audio' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(AudioComponent);
    },
});

export default AudioNode;
