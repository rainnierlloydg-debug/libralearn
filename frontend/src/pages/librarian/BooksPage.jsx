import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Edit, Trash2, Eye, Download, Upload, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import BookCard from '../../components/book/BookCard';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function BooksPage() {
  const { user } = useAuth();
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
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchBooks();
    fetchGenresAndSubjects();
  }, [page, searchQuery, filters]);

  const fetchBooks = async () => {
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
  };

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
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
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
    });
    setErrors({});
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
        setErrors(err.response.data.errors);
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
    } catch (err) {
      alert('Failed to delete book');
    }
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
                    { value: 'overdue', label: 'Overdue' },
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
              showActions={false}
              onViewDetails={() => openEditModal(book)}
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
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingBook ? 'Edit Book' : 'Add New Book'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Title *" name="title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} error={errors.title} required />
            <Input label="Author *" name="author" value={formData.author} onChange={(e) => setFormData({...formData, author: e.target.value})} error={errors.author} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="ISBN" name="isbn" value={formData.isbn} onChange={(e) => setFormData({...formData, isbn: e.target.value})} error={errors.isbn} placeholder="978-1234567890" />
            <Input label="Publisher" name="publisher" value={formData.publisher} onChange={(e) => setFormData({...formData, publisher: e.target.value})} placeholder="Publisher name" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Publication Date" type="date" name="publication_date" value={formData.publication_date} onChange={(e) => setFormData({...formData, publication_date: e.target.value})} />
            <Input label="Edition" name="edition" value={formData.edition} onChange={(e) => setFormData({...formData, edition: e.target.value})} placeholder="e.g., 1st, 2nd" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Language" name="language" value={formData.language} onChange={(e) => setFormData({...formData, language: e.target.value})} placeholder="English" />
            <Select label="Status" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} options={[
              { value: 'available', label: 'Available' },
              { value: 'borrowed', label: 'Borrowed' },
              { value: 'reserved', label: 'Reserved' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'lost', label: 'Lost' },
              { value: 'damaged', label: 'Damaged' },
            ]} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Genre" options={[{ value: '', label: 'Select Genre' }, ...genres.map(g => ({ value: g.name, label: g.name }))]} value={formData.genre} onChange={(e) => setFormData({...formData, genre: e.target.value})} />
            <Select label="Subject" options={[{ value: '', label: 'Select Subject' }, ...subjects.map(s => ({ value: s.name, label: s.name }))]} value={formData.subject} onChange={(e) => setFormData({...formData, subject: e.target.value})} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="input min-h-[100px] resize-y"
              placeholder="Book description..."
            />
          </div>
          <div>
            <label className="label">Cover Image URL</label>
            <input
              type="url"
              name="cover_image"
              value={formData.cover_image}
              onChange={(e) => setFormData({...formData, cover_image: e.target.value})}
              className="input"
              placeholder="https://example.com/cover.jpg"
            />
            {formData.cover_image && (
              <img src={formData.cover_image} alt="Cover preview" className="mt-2 max-h-32 rounded" />
            )}
          </div>
          {errors.general && <p className="text-red-600 text-sm">{errors.general}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t-[var(--border)]">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingBook ? 'Update' : 'Add'} Book</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default BooksPage;
