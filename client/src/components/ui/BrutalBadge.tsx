import React from 'react';
import { SyncStatus } from '../../types';
import { Check, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface BrutalBadgeProps {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'yellow' | 'forest' | 'teal' | 'deepTeal' | 'mint' | 'white' | 'danger' | 'surface' | 'dark' | 'outline';
  syncStatus?: SyncStatus;
  className?: string;
  size?: 'sm' | 'md';
}

export const BrutalBadge: React.FC<BrutalBadgeProps> = ({
  children,
  variant = 'surface',
  syncStatus,
  className = '',
  size = 'md',
}) => {
  const sizeClass = size === 'sm' ? 'text-[10px] py-0.5 px-2 font-bold' : 'text-xs py-1 px-2.5 font-extrabold';

  if (syncStatus) {
    switch (syncStatus) {
      case 'synced':
        return (
          <span className={`brutal-badge brutal-badge-synced bg-forest text-white border-2 border-black shadow-brutal-xs ${sizeClass} ${className}`}>
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Synced</span>
          </span>
        );
      case 'pending':
        return (
          <span className={`brutal-badge brutal-badge-pending bg-yellow text-black border-2 border-black shadow-brutal-xs ${sizeClass} ${className}`}>
            <Clock className="w-3.5 h-3.5 stroke-[3]" />
            <span>Waiting to sync</span>
          </span>
        );
      case 'failed':
        return (
          <span className={`brutal-badge bg-danger text-black border-2 border-black shadow-brutal-xs ${sizeClass} ${className}`}>
            <AlertCircle className="w-3.5 h-3.5 stroke-[3]" />
            <span>Needs attention</span>
          </span>
        );
      case 'conflict':
        return (
          <span className={`brutal-badge brutal-badge-deepteal bg-forest text-white border-2 border-black shadow-brutal-xs ${sizeClass} ${className}`}>
            <RefreshCw className="w-3.5 h-3.5 stroke-[3]" />
            <span>Review needed</span>
          </span>
        );
    }
  }

  const variantStyles = {
    primary: 'brutal-badge-primary bg-yellow text-black border-2 border-black shadow-brutal-xs',
    yellow: 'brutal-badge-yellow bg-yellow text-black border-2 border-black shadow-brutal-xs',
    teal: 'brutal-badge-teal bg-teal text-white border-2 border-black shadow-brutal-xs',
    deepTeal: 'brutal-badge-deepteal bg-deepTeal text-white border-2 border-black shadow-brutal-xs',
    secondary: 'brutal-badge-forest bg-forest text-white border-2 border-black shadow-brutal-xs',
    forest: 'brutal-badge-forest bg-forest text-white border-2 border-black shadow-brutal-xs',
    mint: 'brutal-badge-teal bg-forest text-white border-2 border-black shadow-brutal-xs',
    danger: 'bg-danger text-black border-2 border-black shadow-brutal-xs',
    surface: 'brutal-badge-surface bg-white text-black border-2 border-black shadow-brutal-xs',
    white: 'brutal-badge-white bg-white text-black border-2 border-black shadow-brutal-xs',
    dark: 'bg-black text-white border-2 border-black shadow-brutal-xs',
    outline: 'bg-transparent text-black border-2 border-black',
  };

  return (
    <span className={`brutal-badge ${variantStyles[variant]} ${sizeClass} ${className}`}>
      {children}
    </span>
  );
};
