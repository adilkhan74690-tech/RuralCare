import React from 'react';

interface BrutalSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: { value: string; label: string }[];
}

export const BrutalSelect: React.FC<BrutalSelectProps> = ({
  label,
  error,
  helperText,
  options,
  children,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs sm:text-sm font-bold uppercase tracking-wider mb-1.5 text-ink"
        >
          {label}
          {props.required && <span className="text-danger ml-1">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`
          brutal-input
          appearance-none
          bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20fill%3D%22%23111111%22%20d%3D%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%2F%3E%3C%2Fsvg%3E')]
          bg-no-repeat bg-[right_0.75rem_center] bg-[length:1.25rem_1.25rem]
          pr-10
          ${error ? '!border-danger bg-red-50' : ''}
          ${className}
        `}
        {...props}
      >
        {options ? (
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        ) : (
          children
        )}
      </select>
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
