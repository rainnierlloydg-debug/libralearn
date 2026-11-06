import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle, X, Clock, AlertCircle, BookOpen, Calendar, RotateCcw, Bookmark, Check } from 'lucide-react';
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

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchNotifications = useCallback(async () => {
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
  }, [filter]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      if (response.data.success) {
        setUnreadCount(response.data.data.unread_count);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      fetchNotifications();
      fetchUnreadCount();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchNotifications, fetchUnreadCount]);

  const handleMarkAsRead = async (id) => {
    setActionLoading(id);
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        filter === 'unread' ? prev.filter(n => n.id !== id) : prev.map((n) => (n.id === id ? { ...n, read_status: true } : n))
      );
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading('all');
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => filter === 'unread' ? [] : prev.map((n) => ({ ...n, read_status: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    setActionLoading(id);
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchUnreadCount();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    } finally {
      setActionLoading(null);
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
    <div className="student-notifications-page space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Notifications</h1>
          <p className="text-[var(--text-muted)]">Stay updated on your library activity</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {unreadCount > 0 && (
            <Badge variant="danger" className="flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" />
              {unreadCount} unread
            </Badge>
          )}
          <Button variant="secondary" onClick={handleMarkAllAsRead} disabled={unreadCount === 0 || actionLoading !== null} leftIcon={<CheckCircle className="w-4 h-4" aria-hidden="true" />}>
            {actionLoading === 'all' ? 'Marking as Read...' : 'Mark All Read'}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="notification-filters" role="group" aria-label="Filter notifications">
        {['all', 'unread', 'read'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="notification-filter-button"
            aria-pressed={filter === f}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'unread' && unreadCount > 0 && (
              <span className="notification-unread-count">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <Card className="notification-empty-state p-6 sm:p-12 text-center">
          <div className="saved-books-empty-icon"><Bell className="w-8 h-8" aria-hidden="true" /></div>
          <h3 className="text-xl font-semibold text-[var(--text)] mb-2">
            {filter === 'unread' ? 'No unread notifications' : filter === 'read' ? 'No read notifications' : 'No notifications yet'}
          </h3>
          <p className="text-[var(--text-muted)]">
            {filter === 'unread'
              ? "You're all caught up!"
              : filter === 'read' ? 'Notifications you mark as read will appear here.' : 'Notifications will appear here when you have library activity.'}
          </p>
          {filter !== 'all' && <Button variant="secondary" className="mt-5" onClick={() => setFilter('all')}>View All Notifications</Button>}
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
                className="notification-item p-4"
                data-unread={!notif.read_status}
              >
                <div className="flex items-start gap-3">
                  <div className="notification-type-icon" data-tone={color}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-[var(--text)]">{title}</h4>
                          {!notif.read_status && <Badge variant="info">Unread</Badge>}
                        </div>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">{notif.message}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <span className="text-xs text-[var(--text-faint)] whitespace-nowrap">{getRelativeTime(notif.created_at)}</span>
                        {!notif.read_status && (
                          <Button variant="secondary" size="sm" disabled={actionLoading !== null}
                            onClick={() => handleMarkAsRead(notif.id)}
                          >
                            <Check className="w-4 h-4" />
                            Mark read
                          </Button>
                        )}
                        <Button variant="secondary" size="sm" disabled={actionLoading !== null}
                          onClick={() => handleDelete(notif.id)}
                          aria-label="Delete notification"
                        >
                          <X className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    {(notif.data?.book_id || notif.data?.transaction_id) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {notif.data.book_id && <Link to={`/books/${notif.data.book_id}`} className="btn btn-secondary btn-sm">View Book</Link>}
                        {notif.data.transaction_id && <Link to="/my-books" className="btn btn-secondary btn-sm">View My Books</Link>}
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
