export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function truncate(str, length = 100) {
  if (!str || str.length <= length) return str;
  return str.substring(0, length).trim() + '...';
}

export function generateInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function getColorForString(str) {
  const colors = [
    'bg-primary-500',
    'bg-accent-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-blue-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-red-500',
    'bg-indigo-500',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidISBN(isbn) {
  // Basic ISBN validation (10 or 13 digits, hyphens allowed)
  const clean = isbn.replace(/[-\s]/g, '');
  return /^\d{10}$/.test(clean) || /^\d{13}$/.test(clean);
}

export function getStatusConfig(status) {
  const configs = {
    available: { label: 'Available', color: 'success', icon: 'check-circle' },
    borrowed: { label: 'Borrowed', color: 'info', icon: 'book-open' },
    reserved: { label: 'Reserved', color: 'warning', icon: 'bookmark' },
    overdue: { label: 'Overdue', color: 'danger', icon: 'alert-circle' },
    lost: { label: 'Lost', color: 'purple', icon: 'help-circle' },
    damaged: { label: 'Damaged', color: 'accent', icon: 'tool' },
    pending: { label: 'Pending', color: 'warning', icon: 'clock' },
    approved: { label: 'Approved', color: 'info', icon: 'check-circle' },
    rejected: { label: 'Rejected', color: 'danger', icon: 'x-circle' },
    returned: { label: 'Returned', color: 'success', icon: 'check-circle' },
    ready_for_pickup: { label: 'Ready for Pickup', color: 'success', icon: 'calendar' },
    completed: { label: 'Completed', color: 'primary', icon: 'check-circle' },
    cancelled: { label: 'Cancelled', color: 'danger', icon: 'x-circle' },
    expired: { label: 'Expired', color: 'danger', icon: 'clock' },
  };
  return configs[status] || { label: status, color: 'default', icon: 'help-circle' };
}

export function getSourceConfig(source) {
  const configs = {
    gsa: { label: 'GSA Library', color: 'primary', icon: 'building-2' },
    open_library: { label: 'Open Library', color: 'teal', icon: 'globe' },
    google_books: { label: 'Google Books', color: 'blue', icon: 'globe' },
    online: { label: 'Online Source', color: 'teal', icon: 'globe' },
  };
  return configs[source] || { label: source, color: 'default', icon: 'globe' };
}