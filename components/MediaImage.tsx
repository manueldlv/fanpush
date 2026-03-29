"use client";

import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";

type MediaImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  iconClassName?: string;
};

export default function MediaImage({
  src,
  alt,
  className = "",
  fallbackClassName = "",
  iconClassName = "h-6 w-6",
}: MediaImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center bg-zinc-100 text-zinc-400 ${fallbackClassName || className}`.trim()}
    >
      <ImageOff className={iconClassName} />
    </div>
  );
}
