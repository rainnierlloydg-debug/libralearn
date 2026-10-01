import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, Users, Clock, AlertCircle, TrendingUp, TrendingDown,
  Bookmark, RotateCcw, BarChart, Settings, ArrowRight, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';

function LibrarianDashboard() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/dashboard/librarian');
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { key: 'total_books', label: 'Total Books', icon: BookOpen, color: 'primary' },
    { key: 'available_books', label: 'Available', icon: CheckCircle, color: 'success' },
    { key: 'borrowed_books', label: 'Borrowed', icon: BookOpen, color: 'info' },
    { key: 'reserved_books', label: 'Reserved', icon: Bookmark, color: 'warning' },
    { key: 'overdue_books', label: 'Overdue', icon: AlertCircle, color: 'danger' },
    { key: 'lost_books', label: 'Lost', icon: X, color: 'purple' },
    { key: 'damaged_books', label: 'Damaged', icon: AlertCircle, color: 'accent' },
    { key: 'registered_students', label: 'Students', icon: Users, color: 'primary' },
  ];

  const actionCards = [
    {
      key: 'pending_borrow_requests',
      label: 'Pending Borrow Requests',
      icon: Clock,
      color: 'warning',
      link: '/librarian/borrowing',
      description: 'Need approval'
    },
    {
      key: 'pending_reservations',
      label: 'Pending Reservations',
      icon: Bookmark,
      color: 'info',
      link: '/librarian/reservations',
      description: 'Awaiting action'
    },
    {
      key: 'pending_return_confirmations',
      label: 'Pending Returns',
      icon: RotateCcw,
      color: 'primary',
      link: '/librarian/returns',
      description: 'Need confirmation'
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Dashboard</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats || {};
  const recentBooks = dashboardData?.recent_books || [];
  const overdueTransactions = dashboardData?.overdue_transactions || [];
  const pendingBorrows = dashboardData?.pending_borrows || [];
  const pendingReservations = dashboardData?.pending_reservations || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Dashboard</h1>
          <p className="text-[var(--text-muted)]">Library overview and quick actions</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.key} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">{stat.label}</p>
                <p className="text-3xl font-bold text-[var(--text)] mt-1">{stats[stat.key] || 0}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-${stat.color}-100 dark:bg-${stat.color}-900/30 flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 text-${stat.color}-600 dark:text-${stat.color}-400`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Action needed cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {actionCards.map((action) => {
          const count = stats[action.key] || 0;
          return (
            <Link key={action.key} to={action.link} className="card p-5 hover:shadow-lg transition-shadow group">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className={`w-12 h-12 rounded-xl bg-${action.color}-100 dark:bg-${action.color}-900/30 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                    <action.icon className={`w-6 h-6 text-${action.color}-600 dark:text-${action.color}-400`} />
                  </div>
                  <h3 className="font-semibold text-[var(--text)]">{action.label}</h3>
                  <p className="text-sm text-[var(--text-muted)] mt-1">{action.description}</p>
                  <p className="text-2xl font-bold text-[var(--text)] mt-2">{count}</p>
                </div>
                <ArrowRight className="w-6 h-6 text-[var(--text-muted)] group-hover:text-primary-600 transition-colors" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recently added books */}
        <Card>
          <div className="flex items-center justify-between p-4 border-b-[var(--border)]">
            <h3 className="font-semibold text-[var(--text)]">Recently Added Books</h3>
            <Link to="/librarian/books" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
          </div>
          <div className="p-4">
            {recentBooks.length > 0 ? (
              <div className="space-y-3">
                {recentBooks.slice(0, 5).map((book) => (
                  <div key={book.id} className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                    <div className="admin-mini-cover-wrap relative w-12 h-16 flex-shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                      <div className="admin-mini-cover" aria-hidden="true">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      {book.cover_image && (
                        <img
                          src={`/storage/${book.cover_image}`}
                          alt={book.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-[var(--text)] truncate">{book.title}</h4>
                      <p className="text-xs text-[var(--text-muted)] truncate">{book.author}</p>
                    </div>
                    <Badge variant="success" className="text-xs">Available</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <BookOpen className="w-10 h-10 mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-[var(--text-muted)]">No books added yet</p>
                <Link to="/librarian/books" className="btn-primary inline-flex items-center gap-2 mt-2">
                  <Plus className="w-4 h-4" />
                  Add First Book
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* Overdue books */}
        <Card>
          <div className="flex items-center justify-between p-4 border-b-[var(--border)]">
            <h3 className="font-semibold text-[var(--text)]">Overdue Books</h3>
            <Link to="/librarian/borrowing" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
          </div>
          <div className="p-4">
            {overdueTransactions.length > 0 ? (
              <div className="space-y-3">
                {overdueTransactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="admin-mini-cover-wrap relative w-10 h-14 flex-shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                          <div className="admin-mini-cover" aria-hidden="true"><BookOpen className="w-4 h-4" /></div>
                          {transaction.book.cover_image && (
                            <img
                              src={`/storage/${transaction.book.cover_image}`}
                              alt={transaction.book.title}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(event) => { event.currentTarget.style.display = 'none'; }}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-sm text-[var(--text)] truncate">{transaction.book.title}</h4>
                          <p className="text-xs text-[var(--text-muted)] truncate">{transaction.book.author}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="danger" className="text-xs">
                          {transaction.days_overdue} days overdue
                        </Badge>
                        <Link to="/librarian/borrowing" className="text-sm text-primary-600 hover:text-primary-700">Manage</Link>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-[var(--text-muted)]">
                      <span>{transaction.student.name} ({transaction.student.school_id})</span>
                      <span>Due: {transaction.due_date ? formatDate(transaction.due_date) : 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertCircle className="w-10 h-10 mx-auto text-green-500 mb-2" />
                <p className="text-[var(--text-muted)]">No overdue books!</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending borrows */}
        <Card>
          <div className="flex items-center justify-between p-4 border-b-[var(--border)]">
            <h3 className="font-semibold text-[var(--text)]">Pending Borrow Requests</h3>
            <Link to="/librarian/borrowing" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
          </div>
          <div className="p-4">
            {pendingBorrows.length > 0 ? (
              <div className="space-y-3">
                {pendingBorrows.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="admin-mini-cover-wrap relative w-10 h-14 flex-shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                        <div className="admin-mini-cover" aria-hidden="true"><BookOpen className="w-4 h-4" /></div>
                        {transaction.book.cover_image && (
                          <img
                            src={`/storage/${transaction.book.cover_image}`}
                            alt={transaction.book.title}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm text-[var(--text)] truncate">{transaction.book.title}</h4>
                        <p className="text-xs text-[var(--text-muted)] truncate">{transaction.student.name} • {transaction.student.school_id}</p>
                      </div>
                    </div>
                    <Badge variant="warning" className="text-xs">Pending</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Clock className="w-10 h-10 mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-[var(--text-muted)]">No pending borrow requests</p>
              </div>
            )}
          </div>
        </Card>

        {/* Pending reservations */}
        <Card>
          <div className="flex items-center justify-between p-4 border-b-[var(--border)]">
            <h3 className="font-semibold text-[var(--text)]">Pending Reservations</h3>
            <Link to="/librarian/reservations" className="text-sm text-primary-600 hover:text-primary-700">View all</Link>
          </div>
          <div className="p-4">
            {pendingReservations.length > 0 ? (
              <div className="space-y-3">
                {pendingReservations.slice(0, 5).map((reservation) => (
                  <div key={reservation.id} className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="admin-mini-cover-wrap relative w-10 h-14 flex-shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                        <div className="admin-mini-cover" aria-hidden="true"><BookOpen className="w-4 h-4" /></div>
                        {reservation.book.cover_image && (
                          <img
                            src={`/storage/${reservation.book.cover_image}`}
                            alt={reservation.book.title}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm text-[var(--text)] truncate">{reservation.book.title}</h4>
                        <p className="text-xs text-[var(--text-muted)] truncate">{reservation.student.name} • {reservation.student.school_id}</p>
                      </div>
                    </div>
                    <Badge variant="info" className="text-xs">Pending</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Bookmark className="w-10 h-10 mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-[var(--text-muted)]">No pending reservations</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CheckCircle() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function X() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function Plus() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default LibrarianDashboard;
