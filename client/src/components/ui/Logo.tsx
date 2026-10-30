import React from 'react';
import { Link } from 'react-router-dom';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  to?: string;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', to = '/', className = '' }) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const logoMarkup = (
    <div className={`flex items-center gap-2.5 group cursor-pointer ${className}`}>
      {/* Neo-Brutalist Logo Mark */}
      <div
        className={`
          ${iconSizes[size]} shrink-0 relative bg-yellow border-2 border-black rounded-lg
          shadow-brutal-sm group-hover:translate-x-[-1px] group-hover:translate-y-[-1px]
          group-hover:shadow-brutal transition-all flex items-center justify-center
        `}
      >
        {/* Healthcare cross in bold black */}
        <div className="absolute w-[36%] h-[70%] bg-black rounded-[2px]" />
        <div className="absolute h-[36%] w-[70%] bg-black rounded-[2px]" />
        {/* Teal sync accent dot */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-teal border-2 border-black rounded-full" />
      </div>

      <div className="flex items-baseline gap-1.5 leading-none">
        <span className={`font-heading font-black tracking-tight text-black ${textSizes[size]}`}>
          RuralCare
        </span>
        <span className="font-heading font-bold text-xs uppercase tracking-wider text-black bg-yellow px-1.5 py-0.5 rounded border border-black shadow-brutal-xs">
          Connect
        </span>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to}>{logoMarkup}</Link>;
  }

  return logoMarkup;
};
