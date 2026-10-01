import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Bookmark, BookOpen, Calendar, MapPin, X, Search, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import BookCard from '../../components/book/BookCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function SavedBooksPage() {
  const { user } = useAuth();
  const [savedBooks, setSavedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    fetchSavedBooks();
  }, []);

  const fetchSavedBooks = async () => {
    setLoading(true);
    try {
      const response = await api.get('/saved-books');
      if (response.data.success) {
        setSavedBooks(response.data.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch saved books:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (bookId) => {
    setRemovingId(bookId);
    try {
      await api.delete(`/saved-books/${bookId}`);
      setSavedBooks((prev) => prev.filter((s) => s.book.id !== bookId));
    } catch (err) {
      alert('Failed to remove book');
    } finally {
      setRemovingId(null);
    }
  };

  const handleBorrow = async (bookId) => {
    try {
      await api.post('/borrow', { book_id: bookId });
      alert('Borrowing request submitted!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request borrow');
    }
  };

  const handleReserve = async (bookId) => {
    try {
      await api.post('/reservations', { book_id: bookId });
      alert('Reservation request submitted!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reserve');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Saved Books</h1>
          <p className="text-[var(--text-muted)]">Your bookmarked books for later reading</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Saved Books</h1>
          <p className="text-[var(--text-muted)]">{savedBooks.length} book{savedBooks.length !== 1 ? 's' : ''} saved for later</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            aria-label="Grid view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            aria-label="List view"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>

      {savedBooks.length === 0 ? (
        <Card className="p-12 text-center">
          <Heart className="w-16 h-16 mx-auto text-[var(--text-faint)] mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text)] mb-2">No saved books yet</h3>
          <p className="text-[var(--text-muted)] mb-6">Start exploring the library and save books you want to read later!</p>
          <Link to="/search" className="btn-primary inline-flex items-center gap-2">
            <Search className="w-4 h-4" />
            Browse Library
          </Link>
        </Card>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[var(--text-muted)]">Click the heart icon to remove a book from your saved list</p>
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {savedBooks.map((saved) => (
                <BookCard 
                  key={saved.book.id} 
                  book={saved.book} 
                  variant="grid" 
                  showActions={true}
                  onSave={() => handleRemove(saved.book.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {savedBooks.map((saved) => (
                <BookCard 
                  key={saved.book.id} 
                  book={saved.book} 
                  variant="list" 
                  showActions={true}
                  onSave={() => handleRemove(saved.book.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SavedBooksPage;