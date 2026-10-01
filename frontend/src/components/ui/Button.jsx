import { forwardRef } from 'react';

const Button = forwardRef(function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  type = 'button',
  onClick,
  ...props
}, ref) {
  const baseClasses = 'ui-button inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] active:bg-[var(--surface-2)] focus:ring-[var(--border)]',
    ghost: 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] active:bg-[var(--surface-2)] focus:ring-[var(--border)]',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-700 focus:ring-red-500',
    accent: 'bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-600 focus:ring-accent-400',
  };

  const sizeClasses = {
    sm: 'ui-button-sm px-3 py-1.5 text-sm gap-1.5',
    md: 'ui-button-md px-5 py-2.5 text-base gap-2',
    lg: 'ui-button-lg px-7 py-3.5 text-lg gap-2.5',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      ref={ref}
      type={type}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <>
          {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
