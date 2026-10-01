import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, X, ChevronDown, Grid, List } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import BookCard from '../../components/book/BookCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Card from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';

function SearchLibraryPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [genres, setGenres] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');

  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQuery);

  const [filters, setFilters] = useState({
    genre: searchParams.get('genre') || '',
    subject: searchParams.get('subject') || '',
    status: searchParams.get('status') || '',
    library_section: searchParams.get('library_section') || '',
  });

  useEffect(() => {
    fetchGenresAndSubjects();
  }, []);

  const fetchGenresAndSubjects = async () => {
    try {
      const [genresRes, subjectsRes] = await Promise.all([
        api.get('/books/genres'),
        api.get('/books/subjects'),
      ]);
      if (genresRes.data.success) setGenres(genresRes.data.data);
      if (subjectsRes.data.success) setSubjects(subjectsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch genres/subjects:', err);
    }
  };

  const fetchBooks = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum,
        per_page: 20,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      if (query) params.append('search', query);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(`/books?${params.toString()}`);
      if (response.data.success) {
        setBooks(response.data.data.data);
        setTotal(response.data.data.total);
        setPage(response.data.data.current_page);
      }
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks(1);
  }, [query, filters, sortBy, sortOrder]);

  const handleSearch = (searchQuery) => {
    setQuery(searchQuery);
    setSearchParams({ q: searchQuery });
    fetchBooks(1);
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    setSearchParams(params);
    fetchBooks(1);
  };

  const clearFilters = () => {
    setFilters({ genre: '', subject: '', status: '', library_section: '' });
    setSearchParams({ q: query });
    fetchBooks(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Search Library</h1>
          <p className="text-[var(--text-muted)]">Find books in the GSA library catalog</p>
        </div>
        <Link to="/online-search" className="btn-accent w-full md:w-auto">
          <Search className="w-4 h-4" />
          Search Online
        </Link>
      </div>

      {/* Search bar and filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search-input" className="sr-only">Search books</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-faint)]" />
              <input
                id="search-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(e.target.value)}
                placeholder="Search by title, author, subject, ISBN, or keywords..."
                className="input pl-12 pr-4"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); handleSearch(''); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]"
                  aria-label="Clear search"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setFiltersOpen(!filtersOpen)}>
              <Filter className="w-4 h-4 mr-1" />
              Filters
              {hasActiveFilters && (
                <Badge variant="primary" className="ml-1">
                  {Object.values(filters).filter(v => v).length}
                </Badge>
              )}
            </Button>
            <div className="flex items-center gap-1 border-[var(--border)] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
                aria-label="Grid view"
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
                aria-label="List view"
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters panel */}
        {filtersOpen && (
          <div className="mt-4 pt-4 border-t-[var(--border)] animate-slide-up">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Genre"
                  options={[{ value: '', label: 'All Genres' }, ...genres.map(g => ({ value: g.name, label: g.name }))]}
                  value={filters.genre}
                  onChange={(e) => handleFilterChange('genre', e.target.value)}
                  placeholder="All Genres"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Subject"
                  options={[{ value: '', label: 'All Subjects' }, ...subjects.map(s => ({ value: s.name, label: s.name }))]}
                  value={filters.subject}
                  onChange={(e) => handleFilterChange('subject', e.target.value)}
                  placeholder="All Subjects"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Select
                  label="Status"
                  options={[
                    { value: '', label: 'All Statuses' },
                    { value: 'available', label: 'Available' },
                    { value: 'borrowed', label: 'Borrowed' },
                    { value: 'reserved', label: 'Reserved' },
                    { value: 'overdue', label: 'Overdue' },
                  ]}
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  placeholder="All Statuses"
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Select
                  label="Section"
                  options={[
                    { value: '', label: 'All Sections' },
                    { value: 'Fiction', label: 'Fiction' },
                    { value: 'Science', label: 'Science' },
                    { value: 'Mathematics', label: 'Mathematics' },
                    { value: 'English', label: 'English' },
                    { value: 'Filipino', label: 'Filipino' },
                    { value: 'History', label: 'History' },
                    { value: 'Reference', label: 'Reference' },
                    { value: 'Others', label: 'Others' },
                  ]}
                  value={filters.library_section}
                  onChange={(e) => handleFilterChange('library_section', e.target.value)}
                  placeholder="All Sections"
                />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-[var(--text-muted)]">
          {total > 0 ? `Showing ${((page - 1) * 20) + 1} to ${Math.min(page * 20, total)} of ${total} results` : 'No results found'}
          {query && <span className="ml-2">for <strong>"{query}"</strong></span>}
        </p>
        <Select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            if (sortBy === e.target.value) {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            }
          }}
          options={[
            { value: 'title', label: 'Title' },
            { value: 'author', label: 'Author' },
            { value: 'publication_date', label: 'Publication Date' },
            { value: 'created_at', label: 'Recently Added' },
          ]}
          className="w-auto"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : books.length === 0 ? (
        <Card className="p-12 text-center">
          <Search className="w-16 h-16 mx-auto text-[var(--text-faint)] mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text)] mb-2">No books found</h3>
          <p className="text-[var(--text-muted)] mb-6">
            {query 
              ? `We couldn't find any books matching "${query}" in the GSA library.`
              : 'No books match your current filters.'
            }
          </p>
          {query && (
            <Link to={`/online-search?q=${encodeURIComponent(query)}`} className="btn-accent inline-flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Search Online Instead
            </Link>
          )}
          {!query && (
            <Button variant="secondary" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </Card>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {books.map((book) => (
                <BookCard key={book.id} book={book} variant="grid" showActions={true} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {books.map((book) => (
                <BookCard key={book.id} book={book} variant="list" showActions={true} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchBooks(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="px-4 text-[var(--text-muted)]">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fetchBooks(page + 1)}
                disabled={page >= Math.ceil(total / 20)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SearchLibraryPage;