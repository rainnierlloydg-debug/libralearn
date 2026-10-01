import { useState, useEffect } from 'react';
import { Search, ExternalLink, BookOpen, X, ChevronDown, History, Clock } from 'lucide-react';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { SkeletonCard } from '../../components/ui/Skeleton';

function OnlineSearchPage() {
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [source, setSource] = useState('all');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/online-search/history');
      if (response.data.success) {
        setSearchHistory(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const handleSearch = async (searchQuery, searchSource = source) => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) return;

    setQuery(normalizedQuery);
    setSearchedQuery(normalizedQuery);
    setLoading(true);
    try {
      const response = await api.post('/online-search', { query: normalizedQuery, source: searchSource });
      if (response.data.success) {
        setResults(response.data.data);
        fetchHistory(); // Refresh history
      }
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleHistoryClick = (item) => {
    handleSearch(item.query);
    setShowHistory(false);
  };

  const handleSourceChange = (newSource) => {
    setSource(newSource);
    if (query.trim()) {
      handleSearch(query, newSource);
    }
  };

  const clearResults = () => {
    setResults([]);
    setQuery('');
    setSearchedQuery('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Search Online</h1>
          <p className="text-[var(--text-muted)]">Find books from Open Library, Google Books, and other sources</p>
        </div>
        <Badge variant="teal" className="text-sm">
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Online Sources Only
        </Badge>
      </div>

      <Card className="border-teal-200 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-900/10">
        <div className="flex items-start gap-3">
          <ExternalLink className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600" />
          <div className="text-sm text-teal-800 dark:text-teal-200">
            <p className="mb-1 font-medium">Books found here are not part of the GSA physical collection.</p>
            <p>We only link to legitimate sources. Some books may offer free previews or full-text access.</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(180px,220px)_auto] md:items-end">
          <div className="relative min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--text-faint)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, author, ISBN, or keywords..."
              className="input w-full pl-12 pr-4"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={clearResults}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <Select
            label="Source"
            value={source}
            onChange={(e) => handleSourceChange(e.target.value)}
            options={[
              { value: 'all', label: 'All Sources' },
              { value: 'open_library', label: 'Open Library' },
              { value: 'google_books', label: 'Google Books' },
            ]}
          />
          <Button type="submit" disabled={loading || !query.trim()} className="w-full md:w-auto md:min-w-28">
            <Search className="h-4 w-4" />
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </form>
      </Card>

      {/* Search history */}
      {searchHistory.length > 0 && !results.length && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--text)]">Recent Searches</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
              <History className="w-4 h-4 mr-1" />
              {showHistory ? 'Hide' : 'Show'}
            </Button>
          </div>
          {showHistory && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchHistory.slice(0, 10).map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleHistoryClick(item)}
                  className="w-full flex items-center justify-between p-3 text-left bg-[var(--surface-2)] rounded-lg hover:bg-[var(--border)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text)] truncate">{item.query}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.source} • {new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-[var(--text-faint)]" />
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Results */}
      {searchedQuery && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[var(--text-muted)]">
              {loading ? 'Searching...' : results.length > 0 ? `Found ${results.length} results` : 'No results found'}
              <span className="ml-2">for <strong>"{searchedQuery}"</strong></span>
            </p>
            {results.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearResults}>
                <X className="mr-1 h-4 w-4" />
                Clear Results
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, index) => <SkeletonCard key={index} />)}
            </div>
          ) : results.length === 0 ? (
            <Card className="p-8 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-[var(--text-faint)]" />
              <h3 className="mb-2 text-xl font-semibold text-[var(--text)]">No results found</h3>
              <p className="text-[var(--text-muted)]">Try different keywords or search by ISBN for better results.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((book, index) => (
                <article key={`${book.source}-${book.isbn || `${book.title}-${index}`}`} className="card card-hover overflow-hidden p-4">
                  <div className="mb-4 flex h-44 items-center justify-center overflow-hidden rounded-lg bg-[var(--surface-2)]">
                    {book.cover_url ? (
                      <img src={book.cover_url} alt={`Cover of ${book.title}`} loading="lazy" className="h-full w-full object-contain" />
                    ) : (
                      <BookOpen className="h-12 w-12 text-[var(--text-faint)]" aria-hidden="true" />
                    )}
                  </div>
                  <Badge variant="teal" size="sm">{book.source_name || 'Online source'}</Badge>
                  <h2 className="mt-2 line-clamp-2 font-semibold text-[var(--text)]">{book.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">{book.author || 'Unknown author'}</p>
                  <p className="mt-1 text-xs text-[var(--text-faint)]">
                    {[book.publisher, book.publication_year, book.isbn && `ISBN ${book.isbn}`].filter(Boolean).join(' · ')}
                  </p>
                  {book.description && <p className="mt-3 line-clamp-3 text-sm text-[var(--text-muted)]">{book.description}</p>}
                  {(book.preview_link || book.external_url) && (
                    <a
                      href={book.preview_link || book.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
                    >
                      View online <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Empty state */}
      {!searchedQuery && !results.length && !loading && (
        <Card className="p-8 text-center">
          <Search className="mx-auto mb-3 h-12 w-12 text-[var(--text-faint)]" />
          <h3 className="mb-2 text-xl font-semibold text-[var(--text)]">Search for books online</h3>
          <p className="mx-auto max-w-lg text-[var(--text-muted)]">
            Find books from online catalogs. Results are not part of the GSA physical collection.
          </p>
        </Card>
      )}
    </div>
  );
}

export default OnlineSearchPage;
