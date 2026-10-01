import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, Calendar, MapPin, Heart, Bookmark, ExternalLink, ArrowLeft, Star, Share2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function BookDetailPage() {
  const { id } = useParams();
  const { user, isStudent } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [whyRecommended, setWhyRecommended] = useState('');

  useEffect(() => {
    fetchBook();
    checkSaved();
  }, [id]);

  const fetchBook = async () => {
    try {
      const response = await api.get(`/books/${id}`);
      if (response.data.success) {
        setBook(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch book:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkSaved = async () => {
    if (!user) return;
    try {
      const response = await api.get(`/books/${id}`);
      if (response.data.success) {
        setIsSaved(response.data.data.is_saved || false);
      }
    } catch (err) {
      // Ignore
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      if (isSaved) {
        await api.delete(`/saved-books/${id}`);
        setIsSaved(false);
      } else {
        await api.post('/saved-books', { book_id: id });
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Failed to save book:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBorrow = async () => {
    if (!user) return;
    setIsBorrowing(true);
    try {
      await api.post('/borrow', { book_id: id });
      alert('Borrowing request submitted successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request borrow');
    } finally {
      setIsBorrowing(false);
    }
  };

  const handleReserve = async () => {
    if (!user) return;
    setIsReserving(true);
    try {
      await api.post('/reservations', { book_id: id });
      alert('Reservation request submitted successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reserve');
    } finally {
      setIsReserving(false);
    }
  };

  const getCoverUrl = () => {
    if (book?.cover_image) {
      return `/storage/${book.cover_image}`;
    }
    return `https://via.placeholder.com/300x450/4F46E5/ffffff?text=${encodeURIComponent(book?.title?.substring(0, 20) || 'No Cover')}`;
  };

  const statusColors = {
    available: 'success',
    borrowed: 'info',
    reserved: 'warning',
    overdue: 'danger',
    lost: 'purple',
    damaged: 'accent',
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/search" className="btn-ghost p-2"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1">
            <Skeleton className="h-8 w-1/2 rounded" />
            <Skeleton className="h-4 w-1/3 rounded mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-1/2 rounded" />
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-8 rounded" />
              <Skeleton className="h-8 rounded" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-1/3 rounded" />
              <Skeleton className="h-10 w-1/3 rounded" />
              <Skeleton className="h-10 w-1/3 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <AlertCircle className="w-16 h-16 mx-auto text-[var(--text-faint)] mb-4" />
        <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Book not found</h2>
        <p className="text-[var(--text-muted)] mb-4">The book you're looking for doesn't exist or has been removed.</p>
        <Link to="/search" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/search" className="btn-ghost p-2 inline-flex">
        <ArrowLeft className="w-5 h-5" />
        Back to Search
      </Link>

      {book.source === 'online' && (
        <Badge variant="teal" className="inline-flex items-center gap-1.5">
          <ExternalLink className="w-3.5 h-3.5" />
          Online Source ({book.source_name || 'External'})
        </Badge>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-[var(--surface-2)] shadow-lg">
            <img
              src={getCoverUrl()}
              alt={`Cover of ${book.title}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4">
              <Badge variant={statusColors[book.status] || 'primary'} className="shadow-lg text-sm px-3 py-1.5">
                {book.status.charAt(0).toUpperCase() + book.status.slice(1)}
              </Badge>
            </div>
          </div>

          {book.source === 'gsa' && isStudent && (
            <Card className="p-4 space-y-3">
              <div>
                {book.status === 'available' && (
                  <div className="space-y-3">
                    <Button className="w-full" size="lg" onClick={handleBorrow} disabled={isBorrowing} leftIcon={<BookOpen className="w-5 h-5" />}>
                      {isBorrowing ? 'Requesting...' : 'Request to Borrow'}
                    </Button>
                    <Button variant="secondary" className="w-full" size="lg" onClick={handleReserve} disabled={isReserving} leftIcon={<Calendar className="w-5 h-5" />}>
                      {isReserving ? 'Reserving...' : 'Reserve Book'}
                    </Button>
                  </div>
                )}
                {book.status !== 'available' && (
                  <Button variant="secondary" className="w-full" size="lg" onClick={handleReserve} disabled={isReserving} leftIcon={<Calendar className="w-5 h-5" />}>
                    {isReserving ? 'Reserving...' : 'Reserve Book'}
                  </Button>
                )}
                <Button
                  variant={isSaved ? 'danger' : 'ghost'}
                  className="w-full"
                  size="lg"
                  onClick={handleSave}
                  disabled={isSaving}
                  leftIcon={<Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />}
                >
                  {isSaving ? 'Saving...' : (isSaved ? 'Saved to My Books' : 'Save Book')}
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Publication Date</p>
                <p className="font-medium text-[var(--text)]">{book.publication_date ? formatDate(book.publication_date) : 'Not available'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">Location</p>
                <p className="font-medium text-[var(--text)]">{book.library_section || 'Not assigned'}</p>
                <p className="text-sm text-[var(--text-muted)]">Shelf: {book.shelf || 'N/A'}</p>
              </div>
            </div>
            {book.isbn && (
              <div className="flex items-center gap-3 p-3 bg-[var(--surface-2)] rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">ISBN</p>
                  <p className="font-medium text-[var(--text)] font-mono text-sm">{book.isbn}</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div>
            <div className="flex items-start gap-3 mb-3">
              <h1 className="font-serif text-3xl md:text-4xl font-semibold text-[var(--text)] leading-tight flex-1">{book.title}</h1>
              {whyRecommended && (
                <Badge variant="purple" className="flex-shrink-0 mt-1">
                  <Star className="w-3.5 h-3.5 mr-1" />
                  Recommended
                </Badge>
              )}
            </div>
            <p className="text-lg text-[var(--text-muted)]">by {book.author}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {book.genre && <Badge variant="primary">{book.genre}</Badge>}
              {book.subject && <Badge variant="accent">{book.subject}</Badge>}
              {book.language && <Badge variant="info">{book.language}</Badge>}
              {book.edition && <Badge variant="purple">{book.edition} Edition</Badge>}
            </div>
          </div>

          {book.description && (
            <Card className="p-5">
              <h3 className="text-lg font-semibold text-[var(--text)] mb-3">Description</h3>
              <div className="prose prose-sm max-w-none text-[var(--text)] whitespace-pre-wrap">
                {book.description}
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Publisher</p>
                <p className="text-[var(--text)]">{book.publisher || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Publication Date</p>
                <p className="text-[var(--text)]">{book.publication_date ? formatDate(book.publication_date) : 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Edition</p>
                <p className="text-[var(--text)]">{book.edition || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Language</p>
                <p className="text-[var(--text)]">{book.language || 'English'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">ISBN</p>
                <p className="text-[var(--text)] font-mono text-sm">{book.isbn || 'Not available'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Genre</p>
                <p className="text-[var(--text)]">{book.genre || 'Not categorized'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Subject</p>
                <p className="text-[var(--text)]">{book.subject || 'Not categorized'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Library Section</p>
                <p className="text-[var(--text)]">{book.library_section || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Shelf</p>
                <p className="text-[var(--text)]">{book.shelf || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Status</p>
                <Badge variant={statusColors[book.status] || 'primary'}>
                  {book.status.charAt(0).toUpperCase() + book.status.slice(1)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Source</p>
                <Badge variant={book.source === 'gsa' ? 'primary' : 'teal'}>
                  {book.source === 'gsa' ? 'GSA Library' : 'Online Source'}
                </Badge>
              </div>
            </div>
          </Card>

          {book.library_section && book.source === 'gsa' && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--text)]">Find in Library</h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Located in <strong>{book.library_section}</strong>
                    {book.shelf && <span>, Shelf <strong>{book.shelf}</strong></span>}
                  </p>
                </div>
                <Link to="/library-map" className="btn-primary">
                  View Map
                </Link>
              </div>
            </Card>
          )}

          {book.source === 'online' && book.external_url && (
            <Card className="p-4 border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-teal-800 dark:text-teal-200">Available Online</h3>
                  <p className="text-sm text-teal-700 dark:text-teal-300">
                    This book is not in the GSA physical collection but is available from {book.source_name || 'an online source'}.
                  </p>
                </div>
                <a href={book.external_url} target="_blank" rel="noopener noreferrer" className="btn-accent">
                  <ExternalLink className="w-4 h-4" />
                  View Online
                </a>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookDetailPage;