import React from 'react';

export interface ClaimedHomeBadgeProps {
  initial: string;
  color: string;
  darkMode?: boolean;
  sizeClass?: string;
  className?: string;
  title?: string;
}

export const ClaimedHomeBadge: React.FC<ClaimedHomeBadgeProps> = ({
  initial,
  color,
  darkMode = false,
  sizeClass = 'w-12 h-12 md:w-14 md:h-14',
  className = '',
  title
}) => {
  const isMultiChar = initial.length > 1;
  // Caveat has an inherent forward cursive slant. Apply optical offset to center visually.
  const textX = isMultiChar ? 47 : 45.5;
  const textY = 51.5;

  return (
    <div className={`${sizeClass} shrink-0 select-none flex items-center justify-center ${className}`} title={title}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
        {/* Claimed home background fill & connecting lines */}
        <rect
          x="18"
          y="18"
          width="64"
          height="64"
          rx="10"
          fill={color}
          fillOpacity={darkMode ? 0.28 : 0.2}
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* 4 corner dots of claimed home */}
        <circle cx="18" cy="18" r="8" fill={darkMode ? '#e2e8f0' : '#1e293b'} />
        <circle cx="82" cy="18" r="8" fill={darkMode ? '#e2e8f0' : '#1e293b'} />
        <circle cx="18" cy="82" r="8" fill={darkMode ? '#e2e8f0' : '#1e293b'} />
        <circle cx="82" cy="82" r="8" fill={darkMode ? '#e2e8f0' : '#1e293b'} />
        {/* Stamped player initial in Caveat font with optical centering */}
        <text
          x={textX}
          y={textY}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontFamily="'Caveat', cursive, sans-serif"
          fontSize={isMultiChar ? '38' : '48'}
          fontWeight="bold"
          className="select-none pointer-events-none"
        >
          {initial}
        </text>
      </svg>
    </div>
  );
};
