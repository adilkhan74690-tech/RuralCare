import React from 'react';

interface BrutalInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const BrutalInput: React.FC<BrutalInputProps> = ({
  label,
  error,
  helperText,
  icon,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs sm:text-sm font-bold uppercase tracking-wider mb-1.5 text-ink"
        >
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-600">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            brutal-input
            ${icon ? 'pl-10' : ''}
            ${error ? '!border-danger bg-red-50' : ''}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-bold text-danger flex items-center gap-1">
          <span>⚠️</span> {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-xs text-stone-600 font-medium">{helperText}</p>
      )}
    </div>
  );
};
