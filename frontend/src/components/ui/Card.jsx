import { forwardRef } from 'react';

const Card = forwardRef(function Card({
  children,
  className = '',
  hover = false,
  padding = 'p-5',
  ...props
}, ref) {
  return (
    <div
      ref={ref}
      className={`card ${hover ? 'card-hover' : ''} ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;