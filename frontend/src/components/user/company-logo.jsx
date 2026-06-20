import React, { useState } from 'react';

export function CompanyLogo({ name, logoPath, color, size = 48, className = "" }) {
  const [imgError, setImgError] = useState(false);
  const initial = name ? name.charAt(0).toUpperCase() : "C";

  const getFullUrl = (path) => {
    if (!path) return "";
    if (path.startsWith("data:") || path.startsWith("http")) return path;
    return `http://127.0.0.1:8000${path}`;
  };

  const fullUrl = getFullUrl(logoPath);

  if (logoPath && !imgError && fullUrl) {
    return (
      <img
        src={fullUrl}
        alt={`${name} Logo`}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover border border-border/80 shrink-0 shadow-sm ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Google's dynamic branding colors
  const googleColors = [
    '#1a73e8', // Google Blue
    '#ea4335', // Google Red
    '#f9ab00', // Google Yellow
    '#34a853', // Google Green
    '#673ab7', // Google Purple
    '#00acc1', // Google Cyan
    '#f4511e', // Google Orange
  ];

  const getGoogleColor = (str) => {
    if (!str) return '#1a73e8';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % googleColors.length;
    return googleColors[idx];
  };

  // Replace default static colors (#059669 or #4F46E5) with Google brand colors based on the company's name.
  const bg = color && color !== "#059669" && color !== "#4F46E5" ? color : getGoogleColor(name);

  return (
    <div
      className={`grid place-items-center rounded-full font-display font-semibold text-white shrink-0 shadow-sm border border-black/5 ${className}`}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}

