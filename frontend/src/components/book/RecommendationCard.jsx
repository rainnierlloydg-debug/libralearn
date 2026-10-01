import { useState, useEffect } from 'react';
import { Heart, EyeOff, Bookmark, Sparkles, BookOpen, Calendar, MapPin, ExternalLink } from 'lucide-react';
import BookCard from './BookCard';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import { formatDate } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

function RecommendationCard({
  book,
  relevanceReason,
  onLike,
  onNotInterested,
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
  const [feedback, setFeedback] = useState(null); // 'like' | 'not_interested' | null
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    checkFeedback();
  }, [book.id]);

  const checkFeedback = async () => {
    if (!user) return;
    try {
      const response = await api.get(`/recommendations/${book.id}/feedback`);
      if (response.data.success && response.data.data) {
        setFeedback(response.data.data.feedback);
      }
    } catch (err) {
      // Ignore
    }
  };

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

  const handleFeedback = async (type) => {
    if (!user) return;
    try {
      await api.post(`/recommendations/${book.id}/feedback`, { feedback: type });
      setFeedback(type);
      setShowFeedback(true);
      if (type === 'like') {
        success('Thanks for your feedback!');
        onLike?.();
      } else {
        success('We\'ll show you fewer similar books');
        onNotInterested?.();
      }
      // Hide feedback after 3 seconds
      setTimeout(() => setShowFeedback(false), 3000);
    } catch (err) {
      error('Failed to submit feedback');
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

  return (
    <article className="card card-hover relative overflow-hidden">
      <div className="relative h-44 overflow-hidden bg-[var(--surface-2)] sm:h-48">
        {getCoverUrl() && !coverFailed ? (
          <img
            src={getCoverUrl()}
            alt={`Cover of ${book.title}`}
            className="h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-105"
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
        {feedback && showFeedback && (
          <div className="absolute bottom-3 left-3 right-3 animate-slide-up">
            <Badge
              variant={feedback === 'like' ? 'success' : 'warning'}
              className="w-full text-center py-2"
            >
              {feedback === 'like' ? (
                <>
                  <Heart className="w-4 h-4 fill-current mr-1" />
                  Thanks! We'll show more like this
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 mr-1" />
                  Noted! We'll show fewer like this
                </>
              )}
            </Badge>
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <h3 className="font-semibold text-[var(--text)] line-clamp-2">{book.title}</h3>
        <p className="text-sm text-[var(--text-muted)] line-clamp-1">{book.author}</p>

        <div className="flex flex-wrap gap-1.5">
          {book.genre && <Badge variant="primary" size="sm">{book.genre}</Badge>}
          {book.subject && <Badge variant="accent" size="sm">{book.subject}</Badge>}
        </div>

        {relevanceReason && (
          <div className="flex items-start gap-2 p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
            <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-primary-800 dark:text-primary-200">
              <span className="font-medium">Why this book?</span> {relevanceReason}
            </p>
          </div>
        )}

        {book.library_section && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{book.library_section}</span>
            {book.shelf && <span>• Shelf {book.shelf}</span>}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t-[var(--border)]">
          <Button
            size="sm"
            variant={feedback === 'like' ? 'success' : 'ghost'}
            onClick={() => !feedback && handleFeedback('like')}
            disabled={!!feedback || isBorrowing}
            leftIcon={<Heart className={`w-4 h-4 ${feedback === 'like' ? 'fill-current text-green-500' : ''}`} />}
            className="flex-1"
            aria-label={feedback === 'like' ? 'Already liked' : 'Like this recommendation'}
          >
            {feedback === 'like' ? 'Liked' : 'Like'}
          </Button>
          <Button
            size="sm"
            variant={feedback === 'not_interested' ? 'warning' : 'ghost'}
            onClick={() => !feedback && handleFeedback('not_interested')}
            disabled={!!feedback}
            leftIcon={<EyeOff className={`w-4 h-4 ${feedback === 'not_interested' ? 'text-yellow-500' : ''}`} />}
            className="flex-1"
            aria-label={feedback === 'not_interested' ? 'Already marked not interested' : 'Not interested'}
          >
            {feedback === 'not_interested' ? 'Not Interested' : 'Not Interested'}
          </Button>
          <Button
            size="sm"
            variant={isSaved ? 'danger' : 'ghost'}
            onClick={handleSave}
            disabled={isSaving}
            leftIcon={<Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />}
            aria-label={isSaved ? 'Remove from saved' : 'Save book'}
          >
            {isSaving ? '...' : (isSaved ? 'Saved' : 'Save')}
          </Button>
        </div>

        <div className="flex gap-2">
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
          {book.source === 'online' && (
            <Button
              size="sm"
              variant="accent"
              className="flex-1"
              onClick={onViewDetails}
              leftIcon={<ExternalLink className="w-4 h-4" />}
            >
              View Online
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

export default RecommendationCard;
