import React from 'react';

interface BrutalCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  accentColor?: 'primary' | 'secondary' | 'yellow' | 'teal' | 'deepTeal' | 'forest' | 'blue' | 'mint' | 'danger' | 'none';
  className?: string;
  interactive?: boolean;
}

export const BrutalCard: React.FC<BrutalCardProps> = ({
  children,
  title,
  subtitle,
  badge,
  action,
  accentColor = 'none',
  className = '',
  interactive = false,
}) => {
  const accentBorder = {
    primary: 'border-l-8 border-l-yellow',
    yellow: 'border-l-8 border-l-yellow',
    secondary: 'border-l-8 border-l-forest',
    forest: 'border-l-8 border-l-forest',
    teal: 'border-l-8 border-l-teal',
    deepTeal: 'border-l-8 border-l-deepTeal',
    blue: 'border-l-8 border-l-teal',
    mint: 'border-l-8 border-l-mint',
    danger: 'border-l-8 border-l-danger',
    none: '',
  };

  return (
    <div
      className={`
        bg-white border-2 border-black rounded-xl
        ${interactive ? 'shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-brutal-lg transition-all' : 'shadow-brutal'}
        ${accentBorder[accentColor]}
        overflow-hidden
        ${className}
      `}
    >
      {(title || badge || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b-2 border-black bg-cream">
          <div>
            <div className="flex items-center gap-2">
              {title && (
                <h3 className="text-base sm:text-lg font-black text-black tracking-tight font-heading">
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-neutral-600 font-bold mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="ml-3 shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
