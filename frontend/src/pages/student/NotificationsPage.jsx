import { useState, useEffect } from 'react';
import { Bell, CheckCircle, X, Filter, Mail, Clock, AlertCircle, BookOpen, Calendar, RotateCcw, Bookmark, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { getRelativeTime } from '../../utils/helpers';

const NOTIFICATION_ICONS = {
  borrow_approved: BookOpen,
  borrow_rejected: X,
  reservation_approved: Bookmark,
  reservation_rejected: X,
  reservation_ready: Calendar,
  reservation_completed: CheckCircle,
  reservation_expired: Clock,
  return_confirmed: RotateCcw,
  return_request: RotateCcw,
  due_reminder: Clock,
  overdue: AlertCircle,
  borrow_request: BookOpen,
};

const NOTIFICATION_COLORS = {
  borrow_approved: 'success',
  borrow_rejected: 'danger',
  reservation_approved: 'warning',
  reservation_rejected: 'danger',
  reservation_ready: 'success',
  reservation_completed: 'primary',
  reservation_expired: 'danger',
  return_confirmed: 'success',
  return_request: 'info',
  due_reminder: 'warning',
  overdue: 'danger',
  borrow_request: 'info',
};

const NOTIFICATION_TITLES = {
  borrow_approved: 'Borrow Request Approved',
  borrow_rejected: 'Borrow Request Declined',
  reservation_approved: 'Reservation Approved',
  reservation_rejected: 'Reservation Declined',
  reservation_ready: 'Book Ready for Pickup',
  reservation_completed: 'Reservation Completed',
  reservation_expired: 'Reservation Expired',
  return_confirmed: 'Return Confirmed',
  return_request: 'Return Request Received',
  due_reminder: 'Due Date Reminder',
  overdue: 'Book Overdue',
  borrow_request: 'New Borrow Request',
};

function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: 50 });
      if (filter !== 'all') params.append('read_status', filter === 'unread' ? 'false' : 'true');
      const response = await api.get(`/notifications?${params.toString()}`);
      if (response.data.success) {
        setNotifications(response.data.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      if (response.data.success) {
        setUnreadCount(response.data.data.unread_count);
      }
    } catch (err) {
      // Ignore
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_status: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read_status: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (unreadCount > 0) setUnreadCount((prev) => prev - 1);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getIcon = (type) => NOTIFICATION_ICONS[type] || Bell;
  const getColor = (type) => NOTIFICATION_COLORS[type] || 'info';
  const getDefaultTitle = (type) => NOTIFICATION_TITLES[type] || 'Notification';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Notifications</h1>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Notifications</h1>
          <p className="text-[var(--text-muted)]">Stay updated on your library activity</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Badge variant="danger" className="flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" />
              {unreadCount} unread
            </Badge>
          )}
          <Button variant="secondary" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
            Mark All Read
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b-[var(--border)] pb-1">
        {['all', 'unread', 'read'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === f
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="w-16 h-16 mx-auto text-[var(--text-faint)] mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text)] mb-2">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="text-[var(--text-muted)]">
            {filter === 'unread' 
              ? "You're all caught up!" 
              : 'Notifications will appear here when you have library activity.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const Icon = getIcon(notif.type);
            const color = getColor(notif.type);
            const title = notif.title || getDefaultTitle(notif.type);
            
            return (
              <Card 
                key={notif.id} 
                className={`p-4 ${!notif.read_status ? 'border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/10' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-${color}-100 dark:bg-${color}-900/30`}>
                    <Icon className={`w-5 h-5 text-${color}-600 dark:text-${color}-400`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-medium text-[var(--text)]">{title}</h4>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">{notif.message}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-faint)] whitespace-nowrap">{getRelativeTime(notif.created_at)}</span>
                        {!notif.read_status && (
                          <button
                            onClick={() => handleMarkAsRead(notif.id)}
                            className="btn-ghost p-1.5 text-xs"
                          >
                            <Check className="w-4 h-4" />
                            Mark read
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notif.id)}
                          className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                          aria-label="Delete notification"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {notif.data && (
                      <div className="mt-3 pt-3 border-t-[var(--border)] text-xs text-[var(--text-muted)]">
                        <p>Type: {notif.type}</p>
                        {notif.data.book_id && <p>Book ID: {notif.data.book_id}</p>}
                        {notif.data.transaction_id && <p>Transaction ID: {notif.data.transaction_id}</p>}
                      </div>
                    )}
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;