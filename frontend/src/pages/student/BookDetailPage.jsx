import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, Calendar, MapPin, Heart, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useToast } from '../../contexts/useToast';
import api from '../../utils/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

const statusColors = { available: 'success', borrowed: 'info', reserved: 'warning', overdue: 'danger', lost: 'purple', damaged: 'accent' };

function DetailList({ entries }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
      {entries.map(([label, value]) => (
        <div key={label} className="py-3 border-b border-[var(--border)] min-w-0">
          <dt className="text-xs font-medium text-[var(--text-muted)] mb-1">{label}</dt>
          <dd className={`text-sm break-words ${value ? 'text-[var(--text)]' : 'text-[var(--text-faint)]'}`}>{value || 'Not specified'}</dd>
        </div>
      ))}
    </dl>
  );
}

function BookDetailPage() {
  const { id } = useParams();
  const { user, isStudent } = useAuth();
  const { success, error } = useToast();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const fetchBook = useCallback(async (signal) => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await api.get(`/books/${id}`, { signal });
      if (!data.success) throw new Error('Unable to load book');
      setBook(data.data);
      setIsSaved(Boolean(data.data.is_saved));
      setCoverFailed(false);
    } catch (err) {
      if (signal?.aborted) return;
      setBook(null);
      setLoadError(err.response?.status === 404
        ? 'This book does not exist or has been removed from the catalog.'
        : 'Unable to load the book details. Please try again.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchBook(controller.signal), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [fetchBook]);

  const handleSave = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      if (isSaved) await api.delete(`/saved-books/${id}`);
      else await api.post('/saved-books', { book_id: id });
      setIsSaved(!isSaved);
      success(isSaved ? 'Removed from saved books' : 'Book saved!');
    } catch (err) {
      error(err.response?.data?.message || 'Failed to save book');
    } finally { setIsSaving(false); }
  };

  const handleBorrow = async () => {
    if (!user || isBorrowing) return;
    setIsBorrowing(true);
    try {
      await api.post('/borrow', { book_id: id });
      success('Borrowing request submitted. Track it in My Books.');
    } catch (err) {
      error(err.response?.data?.message || 'Failed to request borrow');
    } finally { setIsBorrowing(false); }
  };

  const handleReserve = async () => {
    if (!user || isReserving) return;
    setIsReserving(true);
    try {
      await api.post('/reservations', { book_id: id });
      success('Reservation request submitted. Track it in My Books.');
    } catch (err) {
      error(err.response?.data?.message || 'Failed to reserve');
    } finally { setIsReserving(false); }
  };

  const backLink = <Link to="/search" className="btn btn-secondary btn-sm">Back to All Books</Link>;

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-6" aria-busy="true" aria-label="Loading book details">
      {backLink}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
        <Skeleton className="h-96 rounded-xl" />
        <div className="space-y-4"><Skeleton className="h-12 w-3/4 rounded" /><Skeleton className="h-6 w-1/2 rounded" /><Skeleton className="h-64 rounded-xl" /></div>
      </div>
    </div>
  );

  if (!book) return (
    <div className="max-w-3xl mx-auto space-y-6">
      {backLink}
      <Card className="p-10 text-center" role="alert">
        <AlertCircle className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-4" />
        <h1 className="text-xl font-semibold mb-3">Book details unavailable</h1>
        <p className="text-[var(--text-muted)] mb-5">{loadError}</p>
        <Button variant="secondary" onClick={() => fetchBook()}>Try Again</Button>
      </Card>
    </div>
  );

  const isLibrary = book.source === 'gsa';
  const status = book.status || 'unknown';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const location = book.library_location;
  const section = book.library_section || location?.section_name;
  const shelf = book.shelf || location?.shelf_number;
  const publicationDetails = [
    ['Author', book.author], ['ISBN', book.isbn], ['Publisher', book.publisher],
    ['Publication date', book.publication_date ? formatDate(book.publication_date) : null],
    ['Edition', book.edition], ['Language', book.language],
    ['Genre', book.genre], ['Subject', book.subject],
  ];

  return (
    <div className="book-detail-page max-w-6xl mx-auto space-y-6">
      {backLink}
      <header className="book-detail-heading">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">{isLibrary ? 'GSA Library Collection' : book.source_name || 'Online Collection'}</p>
        <h1 className="break-words">{book.title}</h1>
        <p className="text-base text-[var(--text-muted)]">by {book.author || 'Unknown author'}</p>
        <div className="flex flex-wrap gap-2">
          {book.genre && <Badge variant="primary">{book.genre}</Badge>}
          {book.subject && <Badge variant="accent">{book.subject}</Badge>}
          {book.language && <Badge variant="info">{book.language}</Badge>}
        </div>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
        <aside className="space-y-4 min-w-0">
          <Card padding="p-4" className="overflow-hidden">
            <div className="aspect-[3/4] max-h-[380px] mx-auto overflow-hidden rounded-lg bg-[var(--surface-2)]">
              {book.cover_url && !coverFailed ? (
                <img src={book.cover_url} alt={`Cover of ${book.title}`} className="w-full h-full object-contain p-3" onError={() => setCoverFailed(true)} />
              ) : (
                <div className="book-cover-fallback"><BookOpen aria-hidden="true" /><span>{book.title}</span><small>{book.author}</small></div>
              )}
            </div>
          </Card>
          <Card padding="p-5" className="book-availability-panel space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-[var(--text)]">{isLibrary ? 'Availability' : 'Online access'}</h2>
              <Badge variant={statusColors[status] || 'primary'}>{statusLabel}</Badge>
            </div>
            {isLibrary && (
              <div className="book-copy-counts grid grid-cols-2 gap-3 rounded-lg bg-[var(--surface-2)] p-3">
                <div><p className="text-2xl font-semibold text-[var(--text)]">{book.available_copies_count ?? '—'}</p><p className="text-xs text-[var(--text-muted)]">Available copies</p></div>
                <div><p className="text-2xl font-semibold text-[var(--text)]">{book.copies_count ?? '—'}</p><p className="text-xs text-[var(--text-muted)]">Total copies</p></div>
              </div>
            )}
            {isStudent && (
              <div className="space-y-2">
                {isLibrary && status === 'available' && <Button fullWidth onClick={handleBorrow} disabled={isBorrowing} leftIcon={<BookOpen className="w-4 h-4" />}>{isBorrowing ? 'Requesting...' : 'Request to Borrow'}</Button>}
                {isLibrary && ['borrowed', 'reserved', 'overdue'].includes(status) && <Button fullWidth variant="secondary" onClick={handleReserve} disabled={isReserving} leftIcon={<Calendar className="w-4 h-4" />}>{isReserving ? 'Reserving...' : 'Reserve Book'}</Button>}
                <Button fullWidth variant="secondary" onClick={handleSave} disabled={isSaving} leftIcon={<Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />}>{isSaving ? 'Saving...' : isSaved ? 'Saved to Saved Books' : 'Save Book'}</Button>
              </div>
            )}
            {!isLibrary && book.external_url && <a href={book.external_url} target="_blank" rel="noopener noreferrer" className="btn btn-accent w-full"><ExternalLink className="w-4 h-4" aria-hidden="true" />View Online</a>}
            {isLibrary && <p className="text-xs leading-relaxed text-[var(--text-muted)]">Borrowing and reservation requests are subject to library approval. Check My Books for updates.</p>}
          </Card>
        </aside>
        <div className="min-w-0 space-y-5">
          <Card padding="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-3">About This Book</h2>
            <p className="text-sm leading-7 text-[var(--text-muted)] whitespace-pre-wrap break-words">{book.description || 'No description has been provided for this book yet.'}</p>
          </Card>
          <Card padding="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-1">Book Information</h2>
            <DetailList entries={publicationDetails} />
            {book.categories?.length > 0 && <div className="pt-4"><p className="text-xs font-medium text-[var(--text-muted)] mb-2">Categories</p><div className="flex flex-wrap gap-2">{book.categories.map(category => <Badge key={category.id} variant="primary">{category.name}</Badge>)}</div></div>}
          </Card>
          {isLibrary && (
            <Card padding="p-5 sm:p-6" className="book-location-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h2 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2"><MapPin className="w-5 h-5 text-[var(--text-muted)]" aria-hidden="true" />Find in the Library</h2>
                <Link to={section ? `/library-map?${new URLSearchParams({ section, ...(shelf ? { shelf: String(shelf) } : {}) })}` : '/library-map'} className="btn btn-secondary btn-sm"><MapPin className="w-4 h-4" aria-hidden="true" />View Library Map</Link>
              </div>
              <DetailList entries={[
                ['Library section', section || 'Not assigned'], ['Shelf', shelf || 'Not assigned'],
                ['Location notes', location?.description || 'Ask the librarian for assistance.'], ['Source', 'GSA Library'],
              ]} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookDetailPage;
