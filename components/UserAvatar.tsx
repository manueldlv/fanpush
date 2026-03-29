"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";

type UserAvatarProps = {
  src?: string | null;
  alt: string;
  sizeClassName?: string;
  iconClassName?: string;
  className?: string;
};

export default function UserAvatar({
  src,
  alt,
  sizeClassName = "h-10 w-10",
  iconClassName = "h-5 w-5",
  className = "",
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className={`${sizeClassName} rounded-full object-cover ${className}`.trim()}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClassName} items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-zinc-500 ${className}`.trim()}
    >
      <User className={iconClassName} />
    </div>
  );
}
