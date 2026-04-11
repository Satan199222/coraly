"use client";

interface LiveRegionProps {
  message: string;
}

export function LiveRegion({ message }: LiveRegionProps) {
  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      role="status"
      className="sr-only"
    >
      {message}
    </div>
  );
}
