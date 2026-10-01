import { User } from 'lucide-react';

function Avatar({ src, alt, name, size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
    '2xl': 'w-24 h-24 text-xl',
  };

  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className={`relative inline-flex items-center justify-center rounded-full overflow-hidden bg-[var(--surface-2)] ${sizeClasses[size]} ${className}`} role="img" aria-label={alt || name || 'Avatar'}>
      {src ? (
        <img src={src} alt={alt || name || 'Avatar'} className="w-full h-full object-cover" />
      ) : (
        <span className="font-medium text-[var(--text-muted)]">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}

export default Avatar;