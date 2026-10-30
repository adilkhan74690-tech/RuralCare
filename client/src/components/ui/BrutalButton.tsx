import React from 'react';

interface BrutalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'forest' | 'teal' | 'deepTeal' | 'green' | 'mint' | 'white' | 'danger' | 'surface' | 'dark' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const BrutalButton: React.FC<BrutalButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  // Neo-Brutalist High-Contrast Button Variants
  // Rule: Yellow buttons have black text. Teal/Green buttons have white text. White buttons have black text.
  const variantStyles = {
    // Primary Sunflower Yellow: bold black text, 2px black border, hard offset shadow
    primary: 'brutal-btn-primary bg-yellow text-black hover:bg-yellow-hover border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    // Rich Teal: crisp white text, 2px black border, hard offset shadow
    teal: 'brutal-btn-teal bg-teal text-white hover:bg-forest-hover border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    forest: 'brutal-btn-forest bg-forest text-white hover:bg-forest-hover border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    // Deep Teal: crisp white text, 2px black border, hard offset shadow
    deepTeal: 'brutal-btn-deepteal bg-deepTeal text-white hover:bg-secondary-hover border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    secondary: 'brutal-btn-forest bg-forest text-white hover:bg-forest-hover border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    green: 'brutal-btn-deepteal bg-secondary text-white hover:bg-forest-hover border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    // White secondary: black text, 2px black border, hard offset shadow
    white: 'brutal-btn-white bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    surface: 'brutal-btn-white bg-white text-black hover:bg-cream border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    // Mint Green accent: crisp white text, 2px black border, hard offset shadow
    mint: 'brutal-btn-teal bg-forest text-white hover:bg-forest-hover border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    // Alert red: black text, 2px black border, hard offset shadow
    danger: 'bg-danger text-black hover:bg-danger-hover border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    // Dark: white text on strong black
    dark: 'bg-black text-white hover:bg-neutral-800 border-2 border-black shadow-brutal-sm hover:shadow-brutal',
    // Ghost: transparent with hover border
    ghost: 'bg-transparent text-black border-2 border-transparent hover:border-black hover:bg-white/60 shadow-none',
  };

  const sizeStyles = {
    sm: 'text-xs py-1.5 px-3 gap-1.5 font-bold',
    md: 'text-sm py-2 px-4 gap-2 font-black',
    lg: 'text-base py-3 px-6 gap-2.5 font-black',
  };

  return (
    <button
      className={`
        brutal-btn
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children && <span className="tracking-tight">{children}</span>}
    </button>
  );
};
