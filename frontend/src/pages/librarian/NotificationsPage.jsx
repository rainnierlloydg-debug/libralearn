import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, CheckCircle, X, Clock, AlertCircle, BookOpen, Calendar, RotateCcw, Bookmark, Check, Users, CheckCheck, Trash2, Inbox, ChevronDown, LoaderCircle } from 'lucide-react';
import api from '../../utils/api';
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
  user_approved: Users,
  user_rejected: X,
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
  user_approved: 'success',
  user_rejected: 'danger',
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
  user_approved: 'Account Approved',
  user_rejected: 'Account Rejected',
};

import { useToast } from '../../contexts/useToast';
import './notifications.css';

function LibrarianNotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const requestId = useRef(0);
  const toast = useToast();

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    const currentRequest = ++requestId.current;
    try {
      const params = new URLSearchParams({ per_page: 30, page: pageNum });
      if (filter !== 'all') params.append('read_status', filter === 'unread' ? 'false' : 'true');
      const [response, countResponse] = await Promise.all([
        api.get(`/notifications?${params.toString()}`), api.get('/notifications/unread-count'),
      ]);
      if (currentRequest !== requestId.current) return;
      if (!response.data.success || !countResponse.data.success) throw new Error('Unable to load notifications');
      const data = response.data.data;
      setNotifications((prev) => append ? [...prev, ...data.data] : data.data);
      setPage(data.current_page);
      setHasMore(data.current_page < data.last_page);
      setUnreadCount(countResponse.data.data.unread_count);
      setError('');
    } catch {
      if (currentRequest === requestId.current) setError('We couldn’t load your notifications. Please try again.');
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [filter]);

  useEffect(() => {
    // This effect synchronizes the inbox with the API when the filter changes.
    // eslint-disable-next-line react/set-state-in-effect
    fetchNotifications();
    return () => { requestId.current += 1; };
  }, [fetchNotifications]);

  const handleAction = async (kind, notif) => {
    if (action) return;
    setAction(kind === 'all' ? 'all' : notif.id);
    try {
      let response;
      if (kind === 'all') response = await api.post('/notifications/read-all');
      else if (kind === 'read') response = await api.post(`/notifications/${notif.id}/read`);
      else response = await api.delete(`/notifications/${notif.id}`);
      if (!response.data.success) throw new Error('Unable to update notification');
      toast.success(kind === 'delete' ? 'Notification deleted.' : kind === 'all' ? 'All notifications marked as read.' : 'Notification marked as read.');
      setLoading(true);
      await fetchNotifications();
    } catch {
      toast.error('We couldn’t update your notifications. Please try again.');
    } finally {
      setAction(null);
    }
  };

  const changeFilter = (value) => {
    if (value === filter) return;
    setLoading(true);
    setLoadingMore(false);
    setError('');
    setNotifications([]);
    setFilter(value);
  };

  const retry = () => {
    setLoading(true);
    setError('');
    fetchNotifications();
  };

  return (
    <div className="notification-center">
      <header className="notification-header">
        <div className="notification-heading">
          <div className="notification-heading-icon"><Bell size={24} aria-hidden="true" /></div>
          <div><h1>Notifications</h1><p>Keep up with library requests and recent activity.</p></div>
        </div>
        <button type="button" className="notification-button notification-button-primary"
          onClick={() => handleAction('all')} disabled={loading || loadingMore || !!action || unreadCount === 0}>
          {action === 'all' ? <LoaderCircle className="notification-spin" size={18} /> : <CheckCheck size={18} />}
          {action === 'all' ? 'Marking as read…' : 'Mark all as read'}
        </button>
      </header>
      <div className="notification-summary" role="status">
        <span className="notification-summary-dot" />
        <div><strong>{loading ? 'Checking your inbox…' : error ? 'Your inbox is temporarily unavailable' : unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}</strong>
          <p>{error ? 'Try again to get your latest updates.' : unreadCount > 0 ? 'Review your latest updates below.' : 'New library updates will appear here.'}</p>
        </div>
        <Bell size={22} aria-hidden="true" />
      </div>
      <section className="notification-inbox" aria-label="Notification inbox">
        <div className="notification-toolbar">
          <div className="notification-filters" role="group" aria-label="Filter notifications">
            {['all', 'unread', 'read'].map((value) => (
              <button type="button" key={value} aria-pressed={filter === value}
                className={`notification-filter ${filter === value ? 'is-active' : ''}`}
                disabled={!!action} onClick={() => changeFilter(value)}>
                {value === 'all' ? 'All activity' : value === 'unread' ? 'Unread' : 'Read'}
                {value === 'unread' && <span className="notification-count">{unreadCount}</span>}
              </button>
            ))}
          </div>
          <span className="notification-sort"><Clock size={14} aria-hidden="true" /> Newest first</span>
        </div>
        {error && <div className="notification-error" role="alert">
          <AlertCircle size={20} /><p>{error}</p>
          <button type="button" className="notification-button" onClick={retry}>Try again</button>
        </div>}
        <div aria-busy={loading || loadingMore}>
          {loading ? <div className="notification-loading" role="status" aria-label="Loading notifications">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div> : notifications.length === 0 && !error ? (
            <div className="notification-empty">
              <div className="notification-empty-icon">{filter === 'unread' ? <CheckCheck size={30} /> : <Inbox size={30} />}</div>
              <h2>{filter === 'unread' ? 'You’re all caught up!' : filter === 'read' ? 'No read notifications yet' : 'Your inbox is ready'}</h2>
              <p>{filter === 'unread' ? 'There are no unread updates to review.' : filter === 'read' ? 'Notifications you mark as read will appear here.' : 'Borrowing requests and library activity will appear here.'}</p>
              {filter !== 'all' && <button type="button" className="notification-button" onClick={() => changeFilter('all')}>View all activity</button>}
            </div>
          ) : !loading && (
            <ul className="notification-list">
              {notifications.map((notif) => {
                const Icon = NOTIFICATION_ICONS[notif.type] || Bell;
                const color = NOTIFICATION_COLORS[notif.type] || 'info';
                const title = notif.title || NOTIFICATION_TITLES[notif.type] || 'Notification';
                const details = [
                  ['Book', notif.data?.book_id], ['Transaction', notif.data?.transaction_id],
                  ['Student', notif.data?.student_id], ['User', notif.data?.user_id],
                ].filter(([, value]) => value != null);
                return (
                  <li key={notif.id}>
                    <article className={`notification-item ${!notif.read_status ? 'is-unread' : ''}`}>
                      <div className={`notification-type-icon tone-${color}`}><Icon size={22} aria-hidden="true" /></div>
                      <div className="notification-content">
                        <div className="notification-item-meta">
                          <span className={`notification-status ${notif.read_status ? 'is-read' : ''}`}>
                            {notif.read_status ? <Check size={12} /> : <span className="notification-unread-dot" />}
                            {notif.read_status ? 'Read' : 'Unread'}
                          </span>
                          <time dateTime={notif.created_at} title={new Date(notif.created_at).toLocaleString()}>{getRelativeTime(notif.created_at)}</time>
                        </div>
                        <h2>{title}</h2>
                        <p className="notification-message">{notif.message}</p>
                        <div className="notification-item-footer">
                          {details.length > 0 && <details className="notification-details">
                            <summary>View details <ChevronDown size={14} /></summary>
                            <dl>{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>#{value}</dd></div>)}</dl>
                          </details>}
                          <div className="notification-actions">
                            {!notif.read_status && <button type="button" className="notification-button"
                              onClick={() => handleAction('read', notif)} disabled={!!action || loadingMore}>
                              <Check size={16} /> Mark as read
                            </button>}
                            <button type="button" className="notification-button notification-button-delete"
                              aria-label={`Delete notification: ${title}`} onClick={() => handleAction('delete', notif)} disabled={!!action || loadingMore}>
                              <Trash2 size={16} /> Delete
                            </button>
                            {action === notif.id && <LoaderCircle size={18} className="notification-spin" aria-label="Updating notification" />}
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {!loading && hasMore && <div className="notification-pagination">
          <button type="button" className="notification-button" disabled={loadingMore || !!action}
            onClick={() => { setLoadingMore(true); fetchNotifications(page + 1, true); }}>
            {loadingMore ? <LoaderCircle size={16} className="notification-spin" /> : <ChevronDown size={16} />}
            {loadingMore ? 'Loading…' : 'Load more notifications'}
          </button>
        </div>}
      </section>
    </div>
  );
}

export default LibrarianNotificationsPage;
