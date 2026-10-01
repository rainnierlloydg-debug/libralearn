import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, AlertCircle, Calendar, RotateCcw, Bookmark, X, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate, getRelativeTime } from '../../utils/helpers';

function MyBooksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('borrowed');
  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'borrowed' || activeTab === 'all') {
        const [borrowedRes, pendingRes] = await Promise.all([
          api.get('/borrow?status=borrowed'),
          api.get('/borrow?status=pending,approved,return_requested'),
        ]);
        if (borrowedRes.data.success) setBorrowedBooks(borrowedRes.data.data.data);
        if (pendingRes.data.success) setPendingRequests(pendingRes.data.data.data);
      }
      if (activeTab === 'reservations' || activeTab === 'all') {
        const resRes = await api.get('/reservations');
        if (resRes.data.success) setReservations(resRes.data.data.data);
      }
      if (activeTab === 'history') {
        const histRes = await api.get('/borrow?status=returned,rejected,lost,damaged');
        if (histRes.data.success) setHistory(histRes.data.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
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
      <div>
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">My Books</h1>
        <p className="text-[var(--text-muted)]">Track your borrowed books, reservations, and history</p>
      </div>

      {/* Tabs */}
      <div className="my-books-tabs" role="tablist">
        <nav className="flex gap-1 overflow-x-auto" aria-label="My books sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`my-books-tab flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'borrowed' && (
        <div className="space-y-4">
          {loading ? (
            [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : borrowedBooks.length === 0 && pendingRequests.length === 0 ? (
            <Card className="my-books-empty p-8 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-3" />
              <h3 className="text-lg font-medium text-[var(--text)] mb-1">No borrowed books</h3>
              <p className="text-[var(--text-muted)] mb-4">You haven't borrowed any books yet.</p>
              <Link to="/search" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Browse Library
              </Link>
            </Card>
          ) : (
            <>
              {borrowedBooks.length > 0 && (
                <div>
                  <h3 className="font-semibold text-[var(--text)] mb-3">Currently Borrowed</h3>
                  <div className="space-y-3">
                    {borrowedBooks.map((transaction) => {
                      const book = transaction.book;
                      const daysLeft = transaction.due_date ? Math.ceil((new Date(transaction.due_date) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
                      const isOverdue = daysLeft < 0;
                      const isDueSoon = daysLeft <= 3 && daysLeft >= 0;

                      return (
                        <Card key={transaction.id} className={`my-books-item p-4 ${isOverdue ? 'is-overdue' : ''}`}>
                          <div className="flex gap-4">
                            <div className="relative w-16 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                              <img
                                src={book.cover_image ? `/storage/${book.cover_image}` : `https://via.placeholder.com/64x80?text=${encodeURIComponent(book.title.substring(0, 8))}`}
                                alt={book.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
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
                              <div className="mt-3 flex gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleReturnRequest(transaction.id)}
                                  disabled={actionLoading === transaction.id}
                                  leftIcon={<RotateCcw className="w-4 h-4" />}
                                >
                                  {actionLoading === transaction.id ? 'Requesting...' : 'Request Return'}
                                </Button>
                                <Link to={`/books/${book.id}`} className="btn-ghost text-sm">
                                  View Details
                                </Link>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="text-right text-xs text-[var(--text-muted)]">
                                <p>Borrowed: {transaction.borrow_date ? formatDate(transaction.borrow_date) : 'N/A'}</p>
                                <p>Due: {transaction.due_date ? formatDate(transaction.due_date) : 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {pendingRequests.length > 0 && (
                <div className="mt-6">
                  <h3 className="font-semibold text-[var(--text)] mb-3">Pending Requests</h3>
                  <div className="space-y-3">
                    {pendingRequests.map((transaction) => {
                      const book = transaction.book;
                      const statusLabels = {
                        pending: 'Pending Approval',
                        approved: 'Approved - Ready to Borrow',
                        return_requested: 'Return Requested',
                      };
                      return (
                        <Card key={transaction.id} className="my-books-item p-4">
                          <div className="flex gap-4">
                            <div className="relative w-16 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                              <img
                                src={book.cover_image ? `/storage/${book.cover_image}` : `https://via.placeholder.com/64x80?text=${encodeURIComponent(book.title.substring(0, 8))}`}
                                alt={book.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="min-w-0">
                                  <h4 className="font-medium text-[var(--text)] truncate">{book.title}</h4>
                                  <p className="text-sm text-[var(--text-muted)] truncate">{book.author}</p>
                                </div>
                                <Badge variant={transaction.status === 'pending' ? 'warning' : transaction.status === 'approved' ? 'success' : 'info'}>
                                  {statusLabels[transaction.status] || transaction.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-[var(--text-muted)] mt-1">
                                Requested: {transaction.request_date ? formatDate(transaction.request_date) : 'N/A'}
                                {transaction.approval_date && ` • Approved: ${formatDate(transaction.approval_date)}`}
                              </p>
                              {transaction.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelBorrowRequest(transaction.id)}
                                  disabled={actionLoading === transaction.id}
                                >
                                  Cancel Request
                                </Button>
                              )}
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
              <Link to="/search" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Find Books to Reserve
              </Link>
            </Card>
          ) : (
            <div className="space-y-3">
              {reservations.map((res) => (
                <Card key={res.id} className="my-books-item p-4">
                  <div className="flex gap-4">
                    <div className="relative w-16 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                      <img
                        src={res.book.cover_image ? `/storage/${res.book.cover_image}` : `https://via.placeholder.com/64x80?text=${encodeURIComponent(res.book.title.substring(0, 8))}`}
                        alt={res.book.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h4 className="font-medium text-[var(--text)] truncate">{res.book.title}</h4>
                          <p className="text-sm text-[var(--text-muted)] truncate">{res.book.author}</p>
                        </div>
                        <Badge variant={res.status === 'ready_for_pickup' ? 'success' : res.status === 'approved' ? 'warning' : res.status === 'pending' ? 'info' : 'danger'}>
                          {res.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-[var(--text-muted)] mt-1">
                        Reserved: {res.reservation_date ? formatDate(res.reservation_date) : 'N/A'}
                        {res.pickup_deadline && ` • Pickup by: ${formatDate(res.pickup_deadline)}`}
                      </p>
                      {res.status !== 'completed' && res.status !== 'cancelled' && res.status !== 'expired' && (
                        <Button
                          variant="ghost"
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
                    <div className="relative w-16 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                      <img
                        src={transaction.book.cover_image ? `/storage/${transaction.book.cover_image}` : `https://via.placeholder.com/64x80?text=${encodeURIComponent(transaction.book.title.substring(0, 8))}`}
                        alt={transaction.book.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[var(--text)] truncate">{transaction.book.title}</h4>
                      <p className="text-sm text-[var(--text-muted)] truncate">{transaction.book.author}</p>
                      <Badge variant={transaction.status === 'pending' ? 'warning' : transaction.status === 'approved' ? 'success' : 'info'} className="mt-2">
                        {transaction.status.replace('_', ' ')}
                      </Badge>
                      <p className="text-xs text-[var(--text-faint)] mt-2">
                        Requested: {transaction.request_date ? formatDate(transaction.request_date) : 'N/A'}
                      </p>
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
                    <div className="relative w-16 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                      <img
                        src={transaction.book.cover_image ? `/storage/${transaction.book.cover_image}` : `https://via.placeholder.com/64x80?text=${encodeURIComponent(transaction.book.title.substring(0, 8))}`}
                        alt={transaction.book.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
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
    </div>
  );
}

export default MyBooksPage;
