interface TeamBadgeProps {
  flag?: string;
  logo?: string | null;
  name: string;
}

function countryCodeToFlag(value?: string) {
  if (!value) return '';

  const code = value.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(code)) {
    return value;
  }

  return code
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
}

export function TeamBadge({ flag, logo, name }: TeamBadgeProps) {
  if (logo) {
    return (
      <img
        src={logo}
        alt={name}
        className="h-10 w-10 object-contain drop-shadow-sm"
        loading="lazy"
      />
    );
  }

  return (
    <span className="text-4xl filter drop-shadow select-none">
      {countryCodeToFlag(flag) || '🏳️'}
    </span>
  );
}