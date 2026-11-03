import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Plus, X, BookOpen, Save, Upload } from 'lucide-react';
import api from '../../utils/api';
import BookCard from '../../components/book/BookCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/Skeleton';
import './book-editor.css';

function BooksPage() {

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    genre: '',
    subject: '',
    status: '',
    library_section: '',
    author: '',
  });
  const [genres, setGenres] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    publisher: '',
    publication_date: '',
    edition: '',
    language: 'English',
    description: '',
    genre: '',
    subject: '',
    shelf: '',
    library_section: '',
    status: 'available',
    cover_image: '',
    initial_copies: 1,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const coverInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (coverPreview.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        per_page: 20,
      });
      if (searchQuery) params.append('search', searchQuery);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await api.get(`/books?${params.toString()}`);
      if (response.data.success) {
        setBooks(response.data.data.data);
        setTotal(response.data.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, filters]);

  const fetchGenresAndSubjects = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      fetchBooks();
      fetchGenresAndSubjects();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchBooks, fetchGenresAndSubjects]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ genre: '', subject: '', status: '', library_section: '', author: '' });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  const openAddModal = () => {
    setEditingBook(null);
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (book) => {
    setCoverFile(null);
    setCoverPreview(book.cover_url || '');
    setCoverUrl(/^https?:\/\//i.test(book.cover_image || '') ? book.cover_image : '');
    setErrors({});
    if (coverInputRef.current) coverInputRef.current.value = '';
    setEditingBook(book);
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      publisher: book.publisher || '',
      publication_date: book.publication_date || '',
      edition: book.edition || '',
      language: book.language || 'English',
      description: book.description || '',
      genre: book.genre || '',
      subject: book.subject || '',
      shelf: book.shelf || '',
      library_section: book.library_section || '',
      status: book.status,
      cover_image: book.cover_image || '',
      initial_copies: 0,
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setCoverFile(null);
    setCoverPreview('');
    setCoverUrl('');
    if (coverInputRef.current) coverInputRef.current.value = '';
    setFormData({
      title: '',
      author: '',
      isbn: '',
      publisher: '',
      publication_date: '',
      edition: '',
      language: 'English',
      description: '',
      genre: '',
      subject: '',
      shelf: '',
      library_section: '',
      status: 'available',
      cover_image: '',
      initial_copies: 1,
    });
    setErrors({});
  };

  const handleCoverSelection = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, cover_image: 'Choose a JPG, PNG, or WebP image up to 5 MB.' }));
      e.target.value = '';
      return;
    }
    setCoverFile(file);
    setCoverUrl('');
    setCoverPreview(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, cover_image: undefined }));
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview('');
    setCoverUrl('');
    setFormData((prev) => ({ ...prev, cover_image: '' }));
    setErrors((prev) => ({ ...prev, cover_image: undefined }));
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.author.trim()) newErrors.author = 'Author is required';
    if (formData.isbn && !/^[\d-]+$/.test(formData.isbn)) newErrors.isbn = 'Invalid ISBN format';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = { ...formData };
      if (payload.publication_date === '') delete payload.publication_date;
      if (payload.isbn === '') delete payload.isbn;

      if (coverFile) {
        const upload = new FormData();
        upload.append('image', coverFile);
        const response = await api.post('/books/upload-cover', upload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (!response.data.success || !response.data.path) throw new Error('Cover upload failed');
        payload.cover_image = response.data.path;
        setFormData((prev) => ({ ...prev, cover_image: response.data.path }));
        setCoverPreview(response.data.url);
        setCoverFile(null);
        if (coverInputRef.current) coverInputRef.current.value = '';
      }

      if (editingBook) {
        const response = await api.put(`/books/${editingBook.id}`, payload);
        if (response.data.success) {
          setBooks((prev) => prev.map((b) => (b.id === editingBook.id ? response.data.data : b)));
          setShowAddModal(false);
        }
      } else {
        const response = await api.post('/books', payload);
        if (response.data.success) {
          setBooks((prev) => [response.data.data, ...prev].slice(0, 20));
          setTotal((prev) => prev + 1);
          setShowAddModal(false);
        }
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors({ ...err.response.data.errors, cover_image: err.response.data.errors.image || err.response.data.errors.cover_image });
      } else {
        setErrors({ general: err.response?.data?.message || 'Failed to save book' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bookId) => {
    if (!confirm('Are you sure you want to delete this book?')) return;
    try {
      await api.delete(`/books/${bookId}`);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      setTotal((prev) => prev - 1);
    } catch {
      alert('Failed to delete book');
    }
  };

  const _statusColors = {
    available: 'success',
    borrowed: 'info',
    reserved: 'warning',
    overdue: 'danger',
    lost: 'purple',
    damaged: 'accent',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Books Management</h1>
          <Button onClick={openAddModal}><Plus className="w-4 h-4" /> Add Book</Button>
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
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Books Management</h1>
          <p className="text-[var(--text-muted)]">Manage the GSA library catalog</p>
        </div>
        <Button onClick={openAddModal}><Plus className="w-4 h-4" /> Add Book</Button>
      </div>

      {/* Search and filters */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-faint)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search by title, author, ISBN..."
                className="input pl-12"
              />
            </div>
            <Button type="submit" variant="primary"><Search className="w-4 h-4" /> Search</Button>
            <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4 mr-1" />
              Filters {hasActiveFilters && <Badge variant="primary" className="ml-1">{Object.values(filters).filter(v => v).length}</Badge>}
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-4 animate-slide-up">
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Genre"
                  options={[{ value: '', label: 'All Genres' }, ...genres.map(g => ({ value: g.name, label: g.name }))]}
                  value={filters.genre}
                  onChange={(e) => handleFilterChange('genre', e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Subject"
                  options={[{ value: '', label: 'All Subjects' }, ...subjects.map(s => ({ value: s.name, label: s.name }))]}
                  value={filters.subject}
                  onChange={(e) => handleFilterChange('subject', e.target.value)}
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
                    { value: 'lost', label: 'Lost' },
                    { value: 'damaged', label: 'Damaged' },
                  ]}
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
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
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Input
                  label="Author"
                  value={filters.author}
                  onChange={(e) => handleFilterChange('author', e.target.value)}
                  placeholder="Filter by author"
                />
              </div>
              <div className="flex items-end">
                <Button variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </Button>
              </div>
            </div>
          )}
        </form>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[var(--text-muted)]">
          Showing {((page - 1) * 20) + 1} to {Math.min(page * 20, total)} of {total} books
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : books.length === 0 ? (
        <Card className="p-12 text-center">
          <Search className="w-16 h-16 mx-auto text-[var(--text-faint)] mb-4" />
          <h3 className="text-xl font-semibold text-[var(--text)] mb-2">No books found</h3>
          <p className="text-[var(--text-muted)] mb-6">Try adjusting your search or filters.</p>
          <Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>
        </Card>
      ) : (
        <div className="admin-books-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              variant="grid"
              showActions={true}
              onViewDetails={() => openEditModal(book)}
              onEdit={() => openEditModal(book)}
              onDelete={() => handleDelete(book.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
            Previous
          </Button>
          <span className="px-4 text-[var(--text-muted)]">Page {page} of {Math.ceil(total / 20)}</span>
          <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / 20)}>
            Next
          </Button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showAddModal} onClose={() => { if (!saving) setShowAddModal(false); }} title={editingBook ? 'Edit Book' : 'Add New Book'} size="lg" className="book-editor-modal">
        <form onSubmit={handleSubmit} className="book-editor-form" aria-busy={saving}>
          <div className="book-editor-body">
          <div className="book-editor-intro"><BookOpen size={22} aria-hidden="true" /><p>{editingBook ? 'Update this book’s details and library information.' : 'Add a title to your library catalog.'} <span>Fields marked * are required.</span></p></div>
          <fieldset className="book-editor-section" disabled={saving}>
          <legend>Book information</legend>
          <p className="book-editor-section-help">Start with the title and author, then add any available publication details.</p>
          <div className="book-editor-grid">
            <Input label="Title *" name="title" placeholder="Enter book title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} error={errors.title} required />
            <Input label="Author *" name="author" placeholder="Enter author name" value={formData.author} onChange={(e) => setFormData({...formData, author: e.target.value})} error={errors.author} required />
          </div>
          <div className="book-editor-grid">
            <Input label="ISBN" name="isbn" value={formData.isbn} onChange={(e) => setFormData({...formData, isbn: e.target.value})} error={errors.isbn} placeholder="978-1234567890" />
            <Input label="Publisher" name="publisher" value={formData.publisher} onChange={(e) => setFormData({...formData, publisher: e.target.value})} placeholder="Publisher name" />
          </div>
          <div className="book-editor-grid">
            <Input label="Publication Date" type="date" name="publication_date" value={formData.publication_date} onChange={(e) => setFormData({...formData, publication_date: e.target.value})} />
            <Input label="Edition" name="edition" value={formData.edition} onChange={(e) => setFormData({...formData, edition: e.target.value})} placeholder="e.g., 1st, 2nd" />
          </div>
          </fieldset>
          <fieldset className="book-editor-section" disabled={saving}>
          <legend>Library &amp; classification</legend>
          <p className="book-editor-section-help">Set availability and help readers find this book.</p>
          <div className={`book-editor-grid ${editingBook ? '' : 'book-editor-grid-three'}`}>
            <Input label="Language" name="language" value={formData.language} onChange={(e) => setFormData({...formData, language: e.target.value})} placeholder="English" />
            <Select label="Status" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} options={[
              { value: 'available', label: 'Available' },
              { value: 'borrowed', label: 'Borrowed' },
              { value: 'reserved', label: 'Reserved' },
              { value: 'lost', label: 'Lost' },
              { value: 'damaged', label: 'Damaged' },
            ]} />
            {!editingBook && <Input
              label="Initial Copies"
              helperText="Number of copies to create."
              name="initial_copies"
              type="number"
              value={formData.initial_copies}
              onChange={(e) => setFormData({...formData, initial_copies: parseInt(e.target.value) || 0})}
              placeholder="e.g., 3"
              min="0"
              max="100"
            />}
          </div>
          <div className="book-editor-grid">
            <Input label="Genre" name="genre" value={formData.genre} onChange={(e) => setFormData({...formData, genre: e.target.value})} placeholder="e.g., Fiction, Science Fiction" />
            <Input label="Subject" name="subject" value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} placeholder="e.g., Mathematics, History" />
          </div>
          <div className="book-editor-grid">
            <Input label="Shelf" name="shelf" value={formData.shelf} onChange={(e) => setFormData({...formData, shelf: e.target.value})} placeholder="e.g., F-01" />
            <Select label="Library Section" options={[
              { value: '', label: 'Select Section' },
              { value: 'Fiction', label: 'Fiction' },
              { value: 'Science', label: 'Science' },
              { value: 'Mathematics', label: 'Mathematics' },
              { value: 'English', label: 'English' },
              { value: 'Filipino', label: 'Filipino' },
              { value: 'History', label: 'History' },
              { value: 'Reference', label: 'Reference' },
              { value: 'Others', label: 'Others' },
            ]} value={formData.library_section} onChange={(e) => setFormData({...formData, library_section: e.target.value})} />
          </div>
          </fieldset>
          <fieldset className="book-editor-section" disabled={saving}>
          <legend>Description &amp; cover</legend>
          <p className="book-editor-section-help">Optional details that help readers recognize and explore the book.</p>
          <div>
            <label className="label" htmlFor="book-description">Description</label>
            <textarea
              id="book-description"
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="input min-h-[100px] resize-y"
              placeholder="Book description..."
            />
          </div>
          <div className="book-editor-cover">
            <label htmlFor="book-cover-file" className="label"><Upload size={16} aria-hidden="true" /> Book Cover</label>
            <input
              ref={coverInputRef}
              id="book-cover-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleCoverSelection}
              disabled={saving}
              aria-describedby="book-cover-help"
              className="input"
            />
            <p id="book-cover-help" className="mt-1 text-xs text-[var(--text-muted)]">Upload a JPG, PNG, or WebP image (max 5 MB), or enter an image URL below.</p>
            <label htmlFor="book-cover-url" className="label mt-3">Cover Image URL</label>
            <input
              id="book-cover-url"
              type="url"
              name="cover_image"
              value={coverUrl}
              disabled={saving}
              onChange={(e) => {
                setCoverFile(null);
                setCoverUrl(e.target.value);
                setCoverPreview(e.target.value);
                setFormData({...formData, cover_image: e.target.value});
                setErrors((prev) => ({ ...prev, cover_image: undefined }));
                if (coverInputRef.current) coverInputRef.current.value = '';
              }}
              className="input"
              placeholder="https://example.com/cover.jpg"
            />
            {errors.cover_image && <p className="mt-1 text-red-600 text-sm" role="alert">{errors.cover_image}</p>}
            {coverPreview && (
              <div className="mt-3 flex items-start gap-3">
                <img src={coverPreview} alt="Book cover preview" className="max-h-40 max-w-32 object-contain rounded" />
                <Button type="button" variant="secondary" size="sm" onClick={removeCover} disabled={saving}>Remove cover</Button>
              </div>
            )}
          </div>
          </fieldset>
          {errors.general && <p className="book-editor-error" role="alert">{errors.general}</p>}
          {editingBook && <Link className="book-editor-copies-link" to={`/librarian/books/${editingBook.id}/copies`}>Manage existing copies →</Link>}
          </div>
          <div className="book-editor-footer">
            <span>{saving ? 'Saving book…' : 'Review the details before saving.'}</span>
            <div className="book-editor-footer-actions">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}><Save size={17} aria-hidden="true" />{editingBook ? 'Save Changes' : 'Add Book'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default BooksPage;
