import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface VideoActionsProps {
  url: string;
  title?: string;
  filename?: string;
  className?: string;
}

export function VideoActions({ url, title = "Replay LoopLance", filename, className }: VideoActionsProps) {
  if (!url) return null;

  async function handleDownload() {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || guessName(url);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: open the file in a new tab; the browser will save/download it.
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function handleShare() {
    const shareData = { title, text: title, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // user cancelled or blocked; fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para compartilhar");
    } catch {
      toast.error("Não foi possível compartilhar");
    }
  }

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <Button size="sm" variant="secondary" className="flex-1" onClick={handleDownload}>
        <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar
      </Button>
      <Button size="sm" variant="outline" className="flex-1" onClick={handleShare}>
        <Share2 className="mr-1.5 h-3.5 w-3.5" /> Compartilhar
      </Button>
    </div>
  );
}

function guessName(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() || "video.mp4";
    return last.includes(".") ? last : `${last}.mp4`;
  } catch {
    return "video.mp4";
  }
}
