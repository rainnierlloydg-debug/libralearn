import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, MapPin, Layers, Search, X, Info } from 'lucide-react';
import api from '../../utils/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import BookCard from '../../components/book/BookCard';
import { SkeletonCard } from '../../components/ui/Skeleton';

export default function LibraryMapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSection = searchParams.get('section') || '';
  const selectedShelf = searchParams.get('shelf') || '';
  const [sections, setSections] = useState([]);
  const [unassigned, setUnassigned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [sectionSearch, setSectionSearch] = useState('');
  const [bookResult, setBookResult] = useState({ key: '', books: [], error: '' });
  const sectionKey = JSON.stringify([selectedSection, selectedShelf]);
  const selected = sections.find(section => section.section_name === selectedSection);
  const visibleSections = sections.filter(section => section.section_name.toLowerCase().includes(sectionSearch.toLowerCase().trim()));
  const bookCount = sections.reduce((sum, section) => sum + section.book_count, 0);
  const shelfCount = sections.reduce((sum, section) => sum + section.shelves.length, 0);

  const fetchMap = useCallback(async (signal) => {
    setLoading(true);
    setMapError('');
    try {
      const { data } = await api.get('/library-locations/map', { signal });
      if (!data.success || !Array.isArray(data.data)) throw new Error('Invalid map response');
      setSections(data.data);
      setUnassigned(data.unassigned_book_count || 0);
    } catch {
      if (!signal?.aborted) setMapError('Unable to load library sections. Please try again.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [setLoading, setMapError, setSections, setUnassigned]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchMap(controller.signal), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [fetchMap]);

  const fetchBooks = useCallback(async (signal) => {
    if (!selectedSection) return;
    try {
      const { data } = await api.get(`/library-locations/section/${encodeURIComponent(selectedSection)}/books`, {
        signal, params: selectedShelf ? { shelf: selectedShelf } : {},
      });
      if (!data.success || !Array.isArray(data.data)) throw new Error('Invalid section response');
      if (!signal?.aborted) setBookResult({ key: sectionKey, books: data.data, error: '' });
    } catch {
      if (!signal?.aborted) setBookResult({ key: sectionKey, books: [], error: 'Unable to load these books. Please try again.' });
    }
  }, [selectedSection, selectedShelf, sectionKey, setBookResult]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchBooks(controller.signal), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [fetchBooks]);

  const chooseSection = (name, shelf = '') => {
    setSearchParams(shelf ? { section: name, shelf } : { section: name });
  };
  const clearSelection = () => setSearchParams({});
  const booksLoading = bookResult.key !== sectionKey;
  const invalidShelf = selectedShelf && selected && !selected.shelves.some(shelf => shelf.shelf_number === selectedShelf);

  return (
    <div className="library-map-page space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Library Map</h1>
          <p className="text-[var(--text-muted)] mt-1">Find a section, choose a shelf, and explore its books.</p>
        </div>
        <Link to="/search" className="btn btn-secondary"><BookOpen className="w-4 h-4" aria-hidden="true" />Browse All Books</Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Loading library sections" aria-busy="true">
          {[0, 1, 2].map(index => <SkeletonCard key={index} />)}
        </div>
      ) : mapError ? (
        <Card className="p-8 text-center" role="alert">
          <p className="text-[var(--text-muted)] mb-4">{mapError}</p>
          <Button variant="secondary" onClick={() => fetchMap()}>Try Again</Button>
        </Card>
      ) : sections.length === 0 ? (
        <Card className="library-map-empty p-8 text-center">
          <div className="saved-books-empty-icon"><MapPin className="w-8 h-8" aria-hidden="true" /></div>
          <h2 className="text-lg font-semibold text-[var(--text)]">No library sections available yet</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md mt-2 mb-5">Section and shelf details will appear here once locations are assigned to library books. Ask the librarian for help locating a book.</p>
          <Link to="/search" className="btn btn-primary">Browse All Books</Link>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[[MapPin, sections.length, 'Sections'], [Layers, shelfCount, 'Shelves'], [BookOpen, bookCount, 'Located titles']].map(([Icon, count, label]) => (
              <Card key={label} className="library-map-stat p-4">
                <Icon className="w-5 h-5" aria-hidden="true" />
                <div><strong>{count}</strong><span>{label}</span></div>
              </Card>
            ))}
          </div>

          <div className="library-map-layout">
            <Card className="library-map-sidebar p-4">
              <h2 className="font-semibold text-[var(--text)]">Library Sections</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">Choose a section to see its shelves.</p>
              <label htmlFor="map-section-search" className="sr-only">Find a library section</label>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" aria-hidden="true" />
                <input id="map-section-search" className="input library-map-search" placeholder="Find a section..." value={sectionSearch} onChange={event => setSectionSearch(event.target.value)} />
              </div>
              <nav className="library-section-list" aria-label="Library sections">
                <button className="library-section-button" aria-pressed={!selectedSection} onClick={clearSelection}>
                  <MapPin className="w-5 h-5 shrink-0" aria-hidden="true" /><span><strong>All Sections</strong><small>View section overview</small></span>
                </button>
                {visibleSections.map(section => (
                  <button key={section.section_name} className="library-section-button" aria-pressed={selectedSection === section.section_name} onClick={() => chooseSection(section.section_name)}>
                    <BookOpen className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span><strong>Section {section.section_name}</strong><small>{section.shelves.length} shelves · {section.book_count} titles</small></span>
                  </button>
                ))}
                {visibleSections.length === 0 && <p className="text-sm text-[var(--text-muted)] p-3">No matching sections.</p>}
              </nav>
            </Card>

            <div className="min-w-0 space-y-4">
              {!selectedSection ? (
                <Card className="p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-[var(--text)]">Section Overview</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1 mb-5">Select a section below to browse its books and shelf labels.</p>
                  <div className="library-map-tiles">
                    {sections.map(section => (
                      <button key={section.section_name} className="library-map-tile" onClick={() => chooseSection(section.section_name)} aria-label={`Explore section ${section.section_name}, ${section.book_count} titles`}>
                        <div className="flex items-center gap-3"><span className="library-map-section-icon"><BookOpen className="w-5 h-5" aria-hidden="true" /></span><div><strong>Section {section.section_name}</strong><small>{section.book_count} titles · {section.shelves.length} shelves</small></div></div>
                        <div className="library-map-shelf-tags">
                          {section.shelves.slice(0, 6).map(shelf => <span key={shelf.shelf_number}>Shelf {shelf.shelf_number}</span>)}
                          {section.shelves.length > 6 && <span>+{section.shelves.length - 6} more</span>}
                          {section.shelves.length === 0 && <span>Shelf labels not assigned</span>}
                        </div>
                        <span className="library-map-explore">Explore Section</span>
                      </button>
                    ))}
                  </div>
                </Card>
              ) : !selected || invalidShelf ? (
                <Card className="p-8 text-center" role="alert">
                  <h2 className="font-semibold text-[var(--text)]">{invalidShelf ? 'Shelf not found' : 'Section not found'}</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-2 mb-4">This location is no longer listed. Choose a section from the overview.</p>
                  <Button variant="secondary" onClick={clearSelection}>View All Sections</Button>
                </Card>
              ) : (
                <>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h2 className="text-lg font-semibold text-[var(--text)]">Section {selectedSection}{selectedShelf && ` · Shelf ${selectedShelf}`}</h2><p className="text-sm text-[var(--text-muted)] mt-1" role="status">{booksLoading ? 'Loading books...' : bookResult.error ? 'Books unavailable' : `${bookResult.books.length} titles in this ${selectedShelf ? 'shelf' : 'section'}`}</p></div>
                      <Button variant="secondary" size="sm" onClick={clearSelection}><X className="w-4 h-4" aria-hidden="true" />Clear Selection</Button>
                    </div>
                    <div className="library-map-shelf-filters" role="group" aria-label="Filter by shelf">
                      <button aria-pressed={!selectedShelf} onClick={() => chooseSection(selectedSection)}>All Shelves</button>
                      {selected.shelves.map(shelf => <button key={shelf.shelf_number} aria-pressed={selectedShelf === shelf.shelf_number} onClick={() => chooseSection(selectedSection, shelf.shelf_number)} title={shelf.description || `Shelf ${shelf.shelf_number}`}>Shelf {shelf.shelf_number}<span>{shelf.book_count}</span></button>)}
                    </div>
                    {selectedShelf && selected.shelves.find(shelf => shelf.shelf_number === selectedShelf)?.description && <p className="text-sm text-[var(--text-muted)] mt-3">{selected.shelves.find(shelf => shelf.shelf_number === selectedShelf).description}</p>}
                  </Card>
                  {booksLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true">{[0, 1].map(index => <SkeletonCard key={index} />)}</div>
                  ) : bookResult.error ? (
                    <Card className="p-8 text-center" role="alert"><p className="text-[var(--text-muted)] mb-4">{bookResult.error}</p><Button variant="secondary" onClick={() => fetchBooks()}>Try Again</Button></Card>
                  ) : bookResult.books.length === 0 ? (
                    <Card className="library-map-empty p-8 text-center"><BookOpen className="w-10 h-10 text-[var(--text-faint)] mb-3" aria-hidden="true" /><h3 className="font-semibold text-[var(--text)]">No books assigned here yet</h3><p className="text-sm text-[var(--text-muted)] mt-2">Choose another shelf or section to continue browsing.</p></Card>
                  ) : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{bookResult.books.map(book => <BookCard key={book.id} book={book} showActions />)}</div>}
                </>
              )}
              <div className="library-map-help"><Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /><p>Sections are grouped by their catalog labels; this overview does not show exact floor positions. Ask the librarian for directions.{unassigned > 0 && ` ${unassigned} ${unassigned === 1 ? 'title has' : 'titles have'} no section assigned yet.`}</p></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
