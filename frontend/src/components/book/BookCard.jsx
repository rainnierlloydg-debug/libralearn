import { useState, useEffect } from 'react';
import { Heart, Bookmark, BookOpen, Calendar, MapPin, ExternalLink } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

function BookCard({
  book,
  variant = 'grid',
  showActions = true,
  onBorrow,
  onReserve,
  onSave,
  onViewDetails
}) {
  const { user, isStudent } = useAuth();
  const { success, error } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const checkSaved = async () => {
    if (!user) return;
    try {
      const response = await api.get(`/books/${book.id}`);
      if (response.data.success) {
        setIsSaved(response.data.data.is_saved || false);
      }
    } catch (err) {
      // Ignore
    }
  };

  useEffect(() => {
    checkSaved();
  }, [book.id, user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      if (isSaved) {
        await api.delete(`/saved-books/${book.id}`);
        setIsSaved(false);
        success('Removed from saved books');
      } else {
        await api.post('/saved-books', { book_id: book.id });
        setIsSaved(true);
        success('Book saved!');
      }
      onSave?.(!isSaved);
    } catch (err) {
      error('Failed to save book');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBorrow = async () => {
    if (!user) return;
    setIsBorrowing(true);
    try {
      await api.post('/borrow', { book_id: book.id });
      success('Borrowing request submitted');
      onBorrow?.();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to request borrow');
    } finally {
      setIsBorrowing(false);
    }
  };

  const handleReserve = async () => {
    if (!user) return;
    setIsReserving(true);
    try {
      await api.post('/reservations', { book_id: book.id });
      success('Reservation request submitted');
      onReserve?.();
    } catch (err) {
      error(err.response?.data?.message || 'Failed to reserve');
    } finally {
      setIsReserving(false);
    }
  };

  const getCoverUrl = () => {
    if (book.cover_image) {
      return `/storage/${book.cover_image}`;
    }
    return null;
  };

  const statusColors = {
    available: 'success',
    borrowed: 'info',
    reserved: 'warning',
    overdue: 'danger',
    lost: 'purple',
    damaged: 'accent',
  };

  if (variant === 'grid') {
    return (
      <article className={`card card-hover group relative overflow-hidden ${isStudent ? 'student-book-card' : ''}`}>
        <div className={`relative overflow-hidden bg-[var(--surface-2)] ${isStudent ? 'h-44 sm:h-48' : 'aspect-[2/3]'}`}>
          {getCoverUrl() && !coverFailed ? (
            <img
              src={getCoverUrl()}
              alt={`Cover of ${book.title}`}
              className={`h-full w-full transition-transform duration-300 group-hover:scale-105 ${isStudent ? 'object-contain p-2' : 'object-cover'}`}
              loading="lazy"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <div className="book-cover-fallback" aria-label={`No cover available for ${book.title}`}>
              <BookOpen aria-hidden="true" />
              <span>{book.title}</span>
              <small>{book.author}</small>
            </div>
          )}
          <div className="absolute top-3 right-3">
            <Badge variant={statusColors[book.status] || 'primary'} className="shadow-md">
              {book.status.charAt(0).toUpperCase() + book.status.slice(1)}
            </Badge>
          </div>
          {book.source === 'online' && (
            <div className="absolute top-3 left-3">
              <Badge variant="teal" className="shadow-md">
                <ExternalLink className="w-3 h-3 mr-1" />
                Online
              </Badge>
            </div>
          )}
        </div>
        <div className={isStudent ? 'space-y-2 p-3' : 'space-y-3 p-4'}>
          <h3 className="font-semibold text-[var(--text)] line-clamp-2 group-hover:text-primary-600 transition-colors">
            {book.title}
          </h3>
          <p className="text-sm text-[var(--text-muted)] line-clamp-1">{book.author}</p>

          <div className="flex flex-wrap gap-1.5">
            {book.genre && <Badge variant="primary" size="sm">{book.genre}</Badge>}
            {book.subject && <Badge variant="accent" size="sm">{book.subject}</Badge>}
          </div>

          {book.library_section && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{book.library_section}</span>
              {book.shelf && <span>• Shelf {book.shelf}</span>}
            </div>
          )}

          {showActions && isStudent && (
            <div className="flex gap-2 pt-2 border-t-[var(--border)]">
              {book.status === 'available' && book.source === 'gsa' && (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    className="flex-1"
                    onClick={handleBorrow}
                    disabled={isBorrowing}
                    leftIcon={<BookOpen className="w-4 h-4" />}
                  >
                    {isBorrowing ? 'Requesting...' : 'Borrow'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleReserve}
                    disabled={isReserving}
                    leftIcon={<Calendar className="w-4 h-4" />}
                  >
                    Reserve
                  </Button>
                </>
              )}
              {book.status !== 'available' && book.source === 'gsa' && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleReserve}
                  disabled={isReserving}
                  leftIcon={<Calendar className="w-4 h-4" />}
                >
                  Reserve
                </Button>
              )}
              <Button
                size="sm"
                variant={isSaved ? 'danger' : 'ghost'}
                onClick={handleSave}
                disabled={isSaving}
                leftIcon={<Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />}
                aria-label={isSaved ? 'Remove from saved' : 'Save book'}
              >
                {isSaving ? '...' : (isSaved ? 'Saved' : 'Save')}
              </Button>
            </div>
          )}

          {showActions && !isStudent && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={onViewDetails}
            >
              View Details
            </Button>
          )}
        </div>
      </article>
    );
  }

  // List variant
  return (
    <div className="card card-hover p-4">
      <div className="flex gap-4">
        <div className="relative w-20 h-28 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
          {getCoverUrl() && !coverFailed ? (
            <img
              src={getCoverUrl()}
              alt={`Cover of ${book.title}`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setCoverFailed(true)}
            />
          ) : (
            <div className="book-cover-fallback" aria-label={`No cover available for ${book.title}`}>
              <BookOpen aria-hidden="true" />
              <span>{book.title}</span>
              <small>{book.author}</small>
            </div>
          )}
          <Badge variant={statusColors[book.status] || 'primary'} className="absolute top-2 right-2">
            {book.status.charAt(0).toUpperCase() + book.status.slice(1)}
          </Badge>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--text)] truncate">{book.title}</h3>
              <p className="text-sm text-[var(--text-muted)] truncate">{book.author}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {book.genre && <Badge variant="primary" size="sm">{book.genre}</Badge>}
                {book.subject && <Badge variant="accent" size="sm">{book.subject}</Badge>}
              </div>
            </div>
            {book.source === 'online' && (
              <Badge variant="teal" className="flex-shrink-0">
                <ExternalLink className="w-3 h-3 mr-1" />
                Online
              </Badge>
            )}
          </div>

          {book.description && (
            <p className="mt-2 text-sm text-[var(--text-muted)] line-clamp-2">{book.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
            {book.library_section && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {book.library_section}{book.shelf && ` • Shelf ${book.shelf}`}
              </span>
            )}
            {book.isbn && <span>ISBN: {book.isbn}</span>}
            {book.publication_date && <span>Published: {formatDate(book.publication_date)}</span>}
          </div>

          {showActions && isStudent && (
            <div className="mt-4 flex gap-2">
              {book.status === 'available' && book.source === 'gsa' && (
                <>
                  <Button size="sm" variant="primary" onClick={handleBorrow} disabled={isBorrowing} leftIcon={<BookOpen className="w-4 h-4" />}>
                    {isBorrowing ? 'Requesting...' : 'Borrow'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleReserve} disabled={isReserving} leftIcon={<Calendar className="w-4 h-4" />}>
                    Reserve
                  </Button>
                </>
              )}
              {book.status !== 'available' && book.source === 'gsa' && (
                <Button size="sm" variant="secondary" onClick={handleReserve} disabled={isReserving} leftIcon={<Calendar className="w-4 h-4" />}>
                  Reserve
                </Button>
              )}
              <Button
                size="sm"
                variant={isSaved ? 'danger' : 'ghost'}
                onClick={handleSave}
                disabled={isSaving}
                leftIcon={<Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />}
              >
                {isSaving ? '...' : (isSaved ? 'Saved' : 'Save')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BookCard;
