"use client";

import { useEffect, useState } from "react";

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
  const resolvedSrc = src && !failed ? src : "/default-avatar.svg";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      onError={() => setFailed(true)}
      className={`${sizeClassName} rounded-full object-cover ${className}`.trim()}
    />
  );
}
