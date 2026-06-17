import { useState } from 'react';

interface TeamBadgeProps {
  flag?: string;
  logo?: string | null;
  name: string;
}

function getFallbackCode(flag?: string, name?: string) {
  const cleanFlag = flag?.trim();

  if (cleanFlag && /^[A-Za-z]{2,4}$/.test(cleanFlag)) {
    return cleanFlag.toUpperCase();
  }

  if (name) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  return 'FC';
}

export function TeamBadge({ flag, logo, name }: TeamBadgeProps) {
  const [hasLogoError, setHasLogoError] = useState(false);

  if (logo && !hasLogoError) {
    return (
      <img
        src={logo}
        alt={name}
        className="h-11 w-11 object-contain drop-shadow-sm"
        loading="lazy"
        onError={() => setHasLogoError(true)}
      />
    );
  }

  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-black text-slate-800 shadow-sm">
      {getFallbackCode(flag, name)}
    </span>
  );
}