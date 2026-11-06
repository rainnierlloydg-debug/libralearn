import useNow from '../../utils/useNow';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Calendar, RotateCcw, Bookmark, Plus, MapPin } from 'lucide-react';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../contexts/useAuth';
import { createTabSnapshot, hasUnseenTabUpdates } from '../../utils/myBooksUpdates';

function BookThumbnail({ book }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="my-books-cover">
      {book.cover_url && !failed ? (
        <img src={book.cover_url} alt={`Cover of ${book.title}`} onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <BookOpen className="w-7 h-7" aria-label={`No cover available for ${book.title}`} />
      )}
    </div>
  );
}

function MyBooksPage() {
  const now = useNow();
  const { user } = useAuth();
  const userId = user?.id;
  const activeTabRef = useRef('borrowed');
  const snapshotsRef = useRef({});
  const seenRef = useRef({});
  const requestRef = useRef(0);
  const [unreadTabs, setUnreadTabs] = useState({});

  const [activeTab, setActiveTab] = useState('borrowed');
  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const saveSeen = useCallback((tab, snapshot) => {
    seenRef.current = { ...seenRef.current, [tab]: snapshot };
    try {
      localStorage.setItem(`my-books-seen:${userId}`, JSON.stringify(seenRef.current));
    } catch {
      // Indicators still work for this visit when browser storage is unavailable.
    }
  }, [userId]);

  const fetchData = useCallback(async ({ background = false, signal } = {}) => {
    if (!userId) return;
    const requestId = ++requestRef.current;
    if (!background) setLoading(true);
    const sections = [
      ['borrowed', '/borrow?status=borrowed,overdue', setBorrowedBooks],
      ['reservations', '/reservations', setReservations],
      ['pending', '/borrow?status=pending,approved,return_requested', setPendingRequests],
      ['history', '/borrow?status=returned,rejected,lost,damaged', setHistory],
    ];
    const responses = await Promise.allSettled(sections.map(([, url]) => api.get(url, { signal })));
    if (signal?.aborted || requestId !== requestRef.current) return;
    const updates = {};
    responses.forEach((result, index) => {
      const [tab, , setRecords] = sections[index];
      if (result.status !== 'fulfilled' || !result.value.data.success) return;
      const pageData = result.value.data.data;
      if (!Array.isArray(pageData?.data)) return;
      setRecords(pageData.data);
      const snapshot = createTabSnapshot(pageData.data, pageData.total ?? pageData.data.length);
      snapshotsRef.current[tab] = snapshot;
      if (activeTabRef.current === tab && document.visibilityState === 'visible') {
        saveSeen(tab, snapshot);
      }
      updates[tab] = hasUnseenTabUpdates(snapshot, seenRef.current[tab]);
    });
    setUnreadTabs(current => ({ ...current, ...updates }));
    setLoading(false);
  }, [userId, saveSeen]);

  useEffect(() => {
    const controller = new AbortController();
    snapshotsRef.current = {};
    seenRef.current = {};
    try {
      const stored = JSON.parse(localStorage.getItem(`my-books-seen:${userId}`) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) seenRef.current = stored;
    } catch {
      // Treat invalid or unavailable storage as a first visit.
    }
    const timer = setTimeout(() => {
      setUnreadTabs({});
      fetchData({ signal: controller.signal });
    }, 0);
    const refresh = () => {
      if (document.visibilityState === 'visible') fetchData({ background: true, signal: controller.signal });
    };
    const interval = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      controller.abort();
    };
  }, [fetchData, userId]);

  const visitTab = (tab) => {
    activeTabRef.current = tab;
    setActiveTab(tab);
    const snapshot = snapshotsRef.current[tab];
    if (snapshot) {
      saveSeen(tab, snapshot);
      setUnreadTabs(current => ({ ...current, [tab]: false }));
    }
  };

  const handleReturnRequest = async (transactionId) => {
    setActionLoading(transactionId);
    try {
      await api.post(`/borrow/${transactionId}/request-return`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request return');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRenewRequest = async (transactionId) => {
    setActionLoading(transactionId);
    try {
      await api.post(`/borrow/${transactionId}/renew-request`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request renewal');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelReservation = async (reservationId) => {
    setActionLoading(reservationId);
    try {
      await api.post(`/reservations/${reservationId}/cancel`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel reservation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelBorrowRequest = async (transactionId) => {
    setActionLoading(transactionId);
    try {
      await api.post(`/borrow/${transactionId}/cancel`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel request');
    } finally {
      setActionLoading(null);
    }
  };

  const tabs = [
    { id: 'borrowed', label: 'Borrowed', icon: BookOpen },
    { id: 'reservations', label: 'Reservations', icon: Bookmark },
    { id: 'pending', label: 'Pending Requests', icon: Clock },
    { id: 'history', label: 'History', icon: RotateCcw },
  ];

  return (
    <div className="student-my-books space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">My Books</h1>
        <p className="text-[var(--text-muted)]">Track your borrowed books, reservations, and history</p>
        </div>
        <Link to="/search" className="btn btn-primary"><BookOpen className="w-4 h-4" aria-hidden="true" />Browse All Books</Link>
      </div>

      {/* Tabs */}
      <div className="my-books-tabs">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="My books sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`my-books-tab-${tab.id}`}
              aria-controls="my-books-panel"
              aria-selected={activeTab === tab.id}
              aria-label={unreadTabs[tab.id] ? `${tab.label}, new updates` : tab.label}
              onClick={() => visitTab(tab.id)}
              className={`my-books-tab flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {unreadTabs[tab.id] && (
                <span className="my-books-unread-light" aria-hidden="true" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <section id="my-books-panel" role="tabpanel" aria-labelledby={`my-books-tab-${activeTab}`} aria-busy={loading} className="space-y-4">
      <div>
        <h2 className="font-semibold text-[var(--text)]">{tabs.find(tab => tab.id === activeTab)?.label}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">{{ borrowed: 'Your current loans and upcoming return dates.', reservations: 'Track your reservations and pickup deadlines.', pending: 'Requests waiting for library approval or processing.', history: 'Review your previous loans and their status.' }[activeTab]}</p>
      </div>
      {activeTab === 'borrowed' && (
        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : borrowedBooks.length === 0 ? (
            <Card className="my-books-empty p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-3" />
              <h3 className="text-lg font-medium text-[var(--text)] mb-1">No borrowed books</h3>
              <p className="text-[var(--text-muted)] mb-4">You haven't borrowed any books yet.</p>
              <Link to="/search" className="btn btn-primary">
                <Plus className="w-4 h-4" />
                Browse Library
              </Link>
            </Card>
          ) : (
            <>
              {borrowedBooks.length > 0 && (
                <div>
                  <div className="space-y-3">
                    {borrowedBooks.map((transaction) => {
                      const book = transaction.book;
                      const daysLeft = transaction.due_date ? Math.ceil((new Date(transaction.due_date) - new Date(now)) / (1000 * 60 * 60 * 24)) : 0;
                      const isOverdue = daysLeft < 0;
                      const isDueSoon = daysLeft <= 3 && daysLeft >= 0;

                      return (
                        <Card key={transaction.id} className={`my-books-item p-4 ${isOverdue ? 'is-overdue' : ''}`}>
                          <div className="flex gap-4">
                            <BookThumbnail book={book} />
                            <div className="flex-1 min-w-0">
                              <div className="my-books-item-heading flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="font-medium text-[var(--text)] truncate">{book.title}</h4>
                                  <p className="text-sm text-[var(--text-muted)] truncate">{book.author}</p>
                                </div>
                                <Badge variant={isOverdue ? 'danger' : isDueSoon ? 'warning' : 'success'}>
                                  {isOverdue ? `${Math.abs(daysLeft)} days overdue` : `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-[var(--text-muted)]">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Due: {transaction.due_date ? formatDate(transaction.due_date) : 'N/A'}
                                </span>
                                {book.library_section && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {book.library_section} {book.shelf && `• Shelf ${book.shelf}`}
                                  </span>
                                )}
                              </div>
                              <div className="my-books-actions mt-3 flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleReturnRequest(transaction.id)}
                                  disabled={actionLoading === transaction.id}
                                  leftIcon={<RotateCcw className="w-4 h-4" />}
                                >
                                  {actionLoading === transaction.id ? 'Requesting...' : 'Request Return'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleRenewRequest(transaction.id)}
                                  disabled={actionLoading === transaction.id || !!transaction.renewal_requested_at}
                                >
                                  {transaction.renewal_requested_at ? 'Renewal requested' : 'Request Renewal'}
                                </Button>
                                <Link to={`/books/${book.id}`} className="btn btn-secondary btn-sm">
                                  View Details
                                </Link>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      )}

      {activeTab === 'reservations' && (
        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : reservations.length === 0 ? (
            <Card className="my-books-empty p-8 text-center">
              <Bookmark className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-3" />
              <h3 className="text-lg font-medium text-[var(--text)] mb-1">No reservations</h3>
              <p className="text-[var(--text-muted)] mb-4">You don't have any active reservations.</p>
              <Link to="/search" className="btn btn-primary">
                <Plus className="w-4 h-4" />
                Find Books to Reserve
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {reservations.map((res) => (
                <Card key={res.id} className="my-books-item p-4">
                  <div className="flex gap-4">
                    <BookThumbnail book={res.book} />
                    <div className="flex-1 min-w-0">
                      <div className="my-books-item-heading flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-medium text-[var(--text)] truncate">{res.book.title}</h4>
                          <p className="text-sm text-[var(--text-muted)] truncate">{res.book.author}</p>
                        </div>
                        <Badge variant={res.status === 'ready_for_pickup' ? 'success' : res.status === 'approved' ? 'warning' : res.status === 'pending' ? 'info' : 'danger'}>
                          {res.status.replaceAll('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        Reserved: {res.reservation_date ? formatDate(res.reservation_date) : 'N/A'}
                        {res.pickup_deadline && ` • Pickup by: ${formatDate(res.pickup_deadline)}`}
                      </p>
                      {res.status !== 'completed' && res.status !== 'cancelled' && res.status !== 'expired' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleCancelReservation(res.id)}
                          disabled={actionLoading === res.id}
                          className="mt-2"
                        >
                          Cancel Reservation
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : pendingRequests.length === 0 ? (
            <Card className="my-books-empty p-8 text-center">
              <Clock className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-3" />
              <h3 className="text-lg font-medium text-[var(--text)] mb-1">No pending requests</h3>
              <p className="text-[var(--text-muted)] mb-4">All your borrowing requests have been processed.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((transaction) => (
                <Card key={transaction.id} className="my-books-item p-4">
                  <div className="flex gap-4">
                    <BookThumbnail book={transaction.book} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[var(--text)] truncate">{transaction.book.title}</h4>
                      <p className="text-sm text-[var(--text-muted)] truncate">{transaction.book.author}</p>
                      <Badge variant={transaction.status === 'pending' ? 'warning' : transaction.status === 'approved' ? 'success' : 'info'} className="mt-2">
                        {{ pending: 'Pending Approval', approved: 'Approved — Ready to Borrow', return_requested: 'Return Requested' }[transaction.status] || transaction.status.replaceAll('_', ' ')}
                      </Badge>
                      <p className="text-xs text-[var(--text-faint)] mt-2">
                        Requested: {transaction.request_date ? formatDate(transaction.request_date) : 'N/A'}
                      </p>
                      <div className="my-books-actions mt-3 flex flex-wrap gap-2">
                        <Link to={`/books/${transaction.book.id}`} className="btn btn-secondary btn-sm">View Details</Link>
                        {transaction.status === 'pending' && (
                          <Button variant="secondary" size="sm" onClick={() => handleCancelBorrowRequest(transaction.id)} disabled={actionLoading === transaction.id}>
                            {actionLoading === transaction.id ? 'Cancelling...' : 'Cancel Request'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : history.length === 0 ? (
            <Card className="my-books-empty p-8 text-center">
              <RotateCcw className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-3" />
              <h3 className="text-lg font-medium text-[var(--text)] mb-1">No borrowing history</h3>
              <p className="text-[var(--text-muted)]">Your borrowing history will appear here.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((transaction) => (
                <Card key={transaction.id} className="my-books-item p-4">
                  <div className="flex gap-4">
                    <BookThumbnail book={transaction.book} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[var(--text)] truncate">{transaction.book.title}</h4>
                      <p className="text-sm text-[var(--text-muted)] truncate">{transaction.book.author}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[var(--text-muted)]">
                        <span>Borrowed: {transaction.borrow_date ? formatDate(transaction.borrow_date) : 'N/A'}</span>
                        <span>Returned: {transaction.return_date ? formatDate(transaction.return_date) : 'N/A'}</span>
                        <Badge variant={transaction.status === 'returned' ? 'success' : transaction.status === 'lost' ? 'purple' : 'danger'}>
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      </section>
    </div>
  );
}

export default MyBooksPage;
