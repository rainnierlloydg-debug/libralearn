function Skeleton({ className = '', ...props }) {
  return (
    <div className={`skeleton ${className}`} {...props} />
  );
}

function SkeletonText({ lines = 3, className = '', ...props }) {
  return (
    <div className={`space-y-2 ${className}`} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`skeleton-text ${i === lines - 1 ? 'w-3/4' : ''}`} />
      ))}
    </div>
  );
}

function SkeletonCard({ className = '', ...props }) {
  return (
    <div className={`skeleton-card ${className}`} {...props}>
      <div className="aspect-[2/3] w-full skeleton rounded-lg" />
      <div className="skeleton-title" />
      <div className="skeleton-text w-1/2" />
      <div className="flex gap-2">
        <div className="skeleton h-6 w-20 rounded-full" />
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonTableRow({ columns = 5, className = '', ...props }) {
  return (
    <tr className={className} {...props}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton-text" />
        </td>
      ))}
    </tr>
  );
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTableRow };