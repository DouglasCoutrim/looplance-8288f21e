import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Volume2, VolumeX, AlertCircle, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LiveStreamProps {
    url: string;
    brandColor?: string;
    quadraName?: string;
}

export function LiveStream({ url, brandColor = "#EF4444", quadraName = "Principal" }: LiveStreamProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [muted, setMuted] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let hls: Hls | null = null;
        setError(false);

        if (Hls.isSupported()) {
            hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => { });
            });
            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    setError(true);
                    hls?.destroy();
                }
            });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            video.addEventListener("loadedmetadata", () => {
                video.play().catch(() => { });
            });
            video.addEventListener("error", () => setError(true));
        }

        return () => {
            if (hls) hls.destroy();
        };
    }, [url]);

    return (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-black aspect-video group shadow-md transition-transform hover:shadow-lg">
            {error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/10 text-white/50 backdrop-blur-sm">
                    <AlertCircle className="h-10 w-10 text-destructive opacity-80" />
                    <span className="text-sm font-medium tracking-wide">Câmera offline</span>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    className="h-full w-full object-cover"
                    muted={muted}
                    playsInline
                />
            )}

            {/* Top badges */}
            <div className="absolute left-3 top-3 flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Ao Vivo
                </div>
                <div
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm backdrop-blur-md"
                    style={{ backgroundColor: brandColor }}
                >
                    {quadraName}
                </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-3 right-3 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100">
                <Button
                    size="icon"
                    variant="secondary"
                    className="h-9 w-9 rounded-full bg-black/60 text-white hover:bg-black/90 backdrop-blur-md border border-white/10"
                    onClick={() => setMuted(!muted)}
                >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
            </div>

            <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-white/10" />
        </div>
    );
}
