import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Search, Grid, List } from 'lucide-react';
import api from '../../utils/api';
import BookCard from '../../components/book/BookCard';

import Card from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';

function SavedBooksPage() {

  const [savedBooks, setSavedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');

  const fetchSavedBooks = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      fetchSavedBooks();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSavedBooks]);

  const handleSaveChange = (bookId, isSaved) => {
    // BookCard already saves/removes the book and shows the result message.
    if (!isSaved) setSavedBooks(current => current.filter(saved => saved.book.id !== bookId));
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
    <div className="saved-books-page space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Saved Books</h1>
          <p className="text-[var(--text-muted)]">{savedBooks.length} book{savedBooks.length !== 1 ? 's' : ''} saved for later</p>
        </div>
        {savedBooks.length > 0 && <div className="flex flex-wrap items-center gap-3">
          <Link to="/search" className="btn btn-secondary"><Search className="w-4 h-4" aria-hidden="true" />Browse Library</Link>
          <div className="library-view-toggle" role="group" aria-label="Saved books display">
          <button
            onClick={() => setViewMode('grid')}
            className="library-view-button"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <Grid className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className="library-view-button"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <List className="w-5 h-5" aria-hidden="true" />
          </button>
          </div>
        </div>}
      </div>

      {savedBooks.length === 0 ? (
        <Card className="saved-books-empty p-6 sm:p-12 text-center">
          <div className="saved-books-empty-icon"><Heart className="w-8 h-8" aria-hidden="true" /></div>
          <h3 className="text-xl font-semibold text-[var(--text)] mb-2">No saved books yet</h3>
          <p className="text-[var(--text-muted)] mb-6">Start exploring the library and save books you want to read later!</p>
          <Link to="/search" className="btn btn-primary">
            <Search className="w-4 h-4" aria-hidden="true" />
            Browse Library
          </Link>
        </Card>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[var(--text-muted)]">Choose a book to view its details, or use the Saved button to remove it from this list.</p>
          </div>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {savedBooks.map((saved) => (
                <BookCard
                  key={saved.book.id}
                  book={saved.book}
                  variant="grid"
                  showActions={true}
                  onSave={(isSaved) => handleSaveChange(saved.book.id, isSaved)}
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
                  onSave={(isSaved) => handleSaveChange(saved.book.id, isSaved)}
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
