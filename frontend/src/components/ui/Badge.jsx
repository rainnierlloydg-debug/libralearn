const Badge = ({ children, variant = 'primary', className = '', icon, iconOnly = false }) => {
  const variantClasses = {
    primary: 'badge-primary',
    accent: 'badge-accent',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    purple: 'badge-purple',
    teal: 'badge-teal',
  };

  return (
    <span className={`${variantClasses[variant]} ${className}`} aria-label={iconOnly ? children : undefined}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {!iconOnly && children}
    </span>
  );
};

export default Badge;