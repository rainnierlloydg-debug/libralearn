import useNow from '../../utils/useNow';
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Bookmark, Clock, AlertCircle, MapPin, Plus, CheckCircle, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import api from '../../utils/api';
import BookCard from '../../components/book/BookCard';
import RecommendationCard from '../../components/book/RecommendationCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { getRelativeTime } from '../../utils/helpers';

function StudentDashboard() {
  const now = useNow();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [catalogBooks, setCatalogBooks] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/books', {
      params: { per_page: 6, sort_by: 'title', sort_order: 'asc' },
      signal: controller.signal,
    }).then(({ data }) => {
      if (!data.success) throw new Error('Unable to load catalog');
      setCatalogBooks(data.data.data);
    }).catch(() => {
      if (!controller.signal.aborted) setCatalogError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setCatalogLoading(false);
    });
    return () => controller.abort();
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get('/dashboard/student');
      if (response.data.success) {
        setDashboardData(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      fetchDashboard();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchDashboard]);

  const getGreeting = () => {
    const hour = new Date(now).getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Loading...</h1>
            <p className="text-[var(--text-muted)]">Loading your dashboard</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  const {
    borrowed_books = [],
    upcoming_due = [],
    overdue_books = [],
    reservations = [],
    saved_books = [],
    notifications = [],
    recommendations = [],
    stats = {}
  } = dashboardData || {};

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">
            {getGreeting()}, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-[var(--text-muted)] mt-1">What are you reading next?</p>
        </div>
        <Link to="/search" className="btn btn-primary w-full md:w-auto shrink-0">
          <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Browse All Books</span>
        </Link>
      </div>

      {/* Quick stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text)]">{stats.currently_borrowed || borrowed_books.length}</p>
              <p className="text-sm text-[var(--text-muted)]">Currently Borrowed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text)]">{stats.overdue_count || overdue_books.length}</p>
              <p className="text-sm text-[var(--text-muted)]">Overdue Books</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text)]">{stats.pending_reservations || 0}</p>
              <p className="text-sm text-[var(--text-muted)]">Pending Reservations</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text)]">{stats.ready_for_pickup || 0}</p>
              <p className="text-sm text-[var(--text-muted)]">Ready for Pickup</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Due soon alert */}
          {(upcoming_due.length > 0 || overdue_books.length > 0) && (
            <Card className="p-4 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    {overdue_books.length > 0 ? 'Overdue Books!' : 'Books Due Soon'}
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    {overdue_books.length > 0
                      ? `You have ${overdue_books.length} overdue book${overdue_books.length > 1 ? 's' : ''}. Please return them as soon as possible.`
                      : `You have ${upcoming_due.length} book${upcoming_due.length > 1 ? 's' : ''} due within 3 days.`
                    }
                  </p>
                  <Link to="/my-books" className="btn btn-secondary btn-sm mt-2">
                    View all borrowed books
                  </Link>
                </div>
              </div>
            </Card>
          )}

          <section aria-labelledby="catalog-heading">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 id="catalog-heading" className="text-xl font-heading font-semibold text-[var(--text)]">Explore the Library</h2>
                <p className="text-sm text-[var(--text-muted)]">Browse the full collection and choose what you want to read.</p>
              </div>
              <Link to="/search" className="btn btn-secondary btn-sm shrink-0">View All Books</Link>
            </div>
            {catalogLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : catalogError ? (
              <Card className="p-6 text-center">
                <p className="text-[var(--text-muted)] mb-3">Unable to load the library preview.</p>
                <Link to="/search" className="btn btn-primary">Browse All Books</Link>
              </Card>
            ) : catalogBooks.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-[var(--text-muted)]">No books in the library yet.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {catalogBooks.map((book) => <BookCard key={book.id} book={book} showActions={true} />)}
              </div>
            )}
          </section>

          {/* Recommendations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-heading font-semibold text-[var(--text)]">Recommended For You</h2>
              <Link to="/recommendations" className="btn btn-secondary btn-sm shrink-0" aria-label="See all recommendations">See all</Link>
            </div>
            {recommendations.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recommendations.slice(0, 4).map((book) => (
                  <RecommendationCard key={book.id} book={book} relevanceReason={book.why_recommended} />
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <BookOpen className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-3" />
                <h3 className="text-lg font-medium text-[var(--text)] mb-1">No recommendations yet</h3>
                <p className="text-[var(--text-muted)] mb-4">Select your reading interests in your profile to get personalized recommendations.</p>
                <Link to="/profile" className="btn-primary inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Update Interests
                </Link>
              </Card>
            )}
          </div>

          {/* Currently borrowed */}
          {borrowed_books.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-heading font-semibold text-[var(--text)]">Currently Borrowed</h2>
                <Link to="/my-books" className="btn btn-secondary btn-sm shrink-0" aria-label="View all borrowed books">View all</Link>
              </div>
              <div className="space-y-3">
                {borrowed_books.slice(0, 3).map((transaction) => {
                  const book = transaction.book;
                  const daysLeft = transaction.due_date ? Math.ceil((new Date(transaction.due_date) - new Date(now)) / (1000 * 60 * 60 * 24)) : 0;
                  const isOverdue = daysLeft < 0;
                  const isDueSoon = daysLeft <= 3 && daysLeft >= 0;

                  return (
                    <Card key={transaction.id} className="p-3 flex gap-4">
                      <div className="relative w-16 h-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                        <img
                          src={book.cover_image ? book.cover_url : `https://via.placeholder.com/80x100?text=${encodeURIComponent(book.title.substring(0, 10))}`}
                          alt={book.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[var(--text)] truncate">{book.title}</h4>
                        <p className="text-sm text-[var(--text-muted)] truncate">{book.author}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <Badge variant={isOverdue ? 'danger' : isDueSoon ? 'warning' : 'success'} className="text-xs">
                            {isOverdue ? `${Math.abs(daysLeft)} days overdue` : isDueSoon ? `Due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : `Due in ${daysLeft} days`}
                          </Badge>
                          {book.library_section && (
                            <Badge variant="info">
                              <MapPin className="w-3 h-3 mr-1" />
                              {book.library_section}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { /* Request return */ }}>
                        Return
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved books */}
          {saved_books.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-heading font-semibold text-[var(--text)]">Saved Books</h2>
                <Link to="/saved-books" className="btn btn-secondary btn-sm shrink-0" aria-label="View all saved books">View all</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {saved_books.slice(0, 6).map((saved) => (
                  <BookCard key={saved.book.id} book={saved.book} variant="grid" showActions={true} />
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Right column - Sidebar widgets */}
        <div className="space-y-6">
          {/* Reservations */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--text)]">My Reservations</h3>
              <Link to="/my-books" className="btn btn-secondary btn-sm shrink-0" aria-label="View all reservations">View all</Link>
            </div>
            {reservations.length > 0 ? (
              <div className="space-y-3">
                {reservations.slice(0, 5).map((res) => (
                  <div key={res.id} className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                    <div className="relative w-12 h-16 flex-shrink-0 overflow-hidden rounded bg-[var(--surface)]">
                      <img
                        src={res.book.cover_image ? res.book.cover_url : `https://via.placeholder.com/48x64?text=${encodeURIComponent(res.book.title.substring(0, 8))}`}
                        alt={res.book.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-[var(--text)] truncate">{res.book.title}</h4>
                      <p className="text-xs text-[var(--text-muted)] truncate">{res.book.author}</p>
                      <Badge variant={res.status === 'ready_for_pickup' ? 'success' : res.status === 'approved' ? 'warning' : 'info'} className="text-xs mt-1">
                        {res.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Bookmark className="w-10 h-10 mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-sm text-[var(--text-muted)]">No active reservations</p>
                <Link to="/search" className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-block">Find books to reserve</Link>
              </div>
            )}
          </Card>

          {/* Notifications */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--text)]">Notifications</h3>
              <Link to="/notifications" className="btn btn-secondary btn-sm shrink-0" aria-label="View all notifications">View all</Link>
            </div>
            {notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notif) => (
                  <div key={notif.id} className={`p-3 rounded-lg ${!notif.read_status ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-[var(--surface-2)]'}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-4 h-4 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-[var(--text)]">{notif.title}</h4>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{notif.message}</p>
                        <p className="text-xs text-[var(--text-faint)] mt-1">{getRelativeTime(notif.created_at)}</p>
                      </div>
                      {!notif.read_status && <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1" />}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Bell className="w-10 h-10 mx-auto text-[var(--text-faint)] mb-2" />
                <p className="text-sm text-[var(--text-muted)]">No notifications yet</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default StudentDashboard;
