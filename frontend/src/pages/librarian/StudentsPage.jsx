import { useState, useEffect } from 'react';
import { Search, UserPlus, Edit, Trash2, MoreVertical, Eye, Clock, Bookmark, BookOpen, RotateCcw, Filter, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    grade_level: '',
    section: '',
    status: '',
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    school_id: '',
    email: '',
    password: '',
    confirm_password: '',
    grade_level: '',
    section: '',
    status: 'active',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const GRADE_LEVELS = [
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
    'Grade 11 - STEM', 'Grade 11 - ABM', 'Grade 11 - HUMSS', 'Grade 11 - GAS',
    'Grade 12 - STEM', 'Grade 12 - ABM', 'Grade 12 - HUMSS', 'Grade 12 - GAS',
  ];

  const SECTIONS = [
    'St. Joseph', 'St. Mary', 'St. Peter', 'St. Paul',
    'St. John', 'St. Matthew', 'St. Mark', 'St. Luke',
    'STEM-A', 'STEM-B', 'ABM-A', 'ABM-B', 'HUMSS-A', 'HUMSS-B', 'GAS-A', 'GAS-B',
  ];

  useEffect(() => {
    fetchStudents();
  }, [page, searchQuery, filters]);

  const fetchStudents = async () => {
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
      const response = await api.get(`/users?${params.toString()}`);
      if (response.data.success) {
        setStudents(response.data.data.data);
        setTotal(response.data.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
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
    setFilters({ grade_level: '', section: '', status: '' });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(v => v);

  const openAddModal = () => {
    setEditingStudent(null);
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setFormData({
      name: student.name,
      school_id: student.school_id,
      email: student.email,
      password: '',
      confirm_password: '',
      grade_level: student.grade_level || '',
      section: student.section || '',
      status: student.status,
    });
    setShowAddModal(true);
  };

  const openViewModal = async (studentId) => {
    try {
      const response = await api.get(`/users/${studentId}/details`);
      if (response.data.success) {
        setViewingStudent(response.data.data);
      }
    } catch (err) {
      alert('Failed to load student details');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      school_id: '',
      email: '',
      password: '',
      confirm_password: '',
      grade_level: '',
      section: '',
      status: 'active',
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.school_id.trim()) newErrors.school_id = 'School ID is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.grade_level) newErrors.grade_level = 'Grade level is required';
    if (!formData.section) newErrors.section = 'Section is required';
    if (editingStudent) {
      if (formData.password && formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
      if (formData.password !== formData.confirm_password) newErrors.confirm_password = 'Passwords do not match';
    } else {
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
      if (formData.password !== formData.confirm_password) newErrors.confirm_password = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        school_id: formData.school_id,
        email: formData.email,
        grade_level: formData.grade_level,
        section: formData.section,
        status: formData.status,
      };
      if (formData.password) {
        payload.password = formData.password;
      }

      if (editingStudent) {
        const response = await api.put(`/users/${editingStudent.id}`, payload);
        if (response.data.success) {
          setStudents((prev) => prev.map((s) => (s.id === editingStudent.id ? response.data.data : s)));
          setShowAddModal(false);
        }
      } else {
        const response = await api.post('/users', payload);
        if (response.data.success) {
          setStudents((prev) => [response.data.data, ...prev].slice(0, 20));
          setTotal((prev) => prev + 1);
          setShowAddModal(false);
        }
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({ general: err.response?.data?.message || 'Failed to save student' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (studentId) => {
    if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) return;
    try {
      await api.delete(`/users/${studentId}`);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      alert('Failed to delete student');
    }
  };

  const handleStatusToggle = async (student) => {
    try {
      await api.put(`/users/${student.id}`, { status: student.status === 'active' ? 'inactive' : 'active' });
      setStudents((prev) => prev.map((s) =>
        s.id === student.id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s
      ));
    } catch (err) {
      alert('Failed to update status');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Student Management</h1>
          <Button onClick={openAddModal}><UserPlus className="w-4 h-4" /> Add Student</Button>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-students-page space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Student Management</h1>
          <p className="text-[var(--text-muted)]">Manage student accounts and view details</p>
        </div>
        <Button onClick={openAddModal}><UserPlus className="w-4 h-4" /> Add Student</Button>
      </div>

      {/* Search and filters */}
      <Card className="admin-filter-panel p-4">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-faint)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search by name, school ID, or email..."
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
            <div id="student-filters" className="admin-filter-fields flex flex-wrap gap-4 animate-slide-up">
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Grade Level"
                  options={[{ value: '', label: 'All Grades' }, ...GRADE_LEVELS.map(g => ({ value: g, label: g }))]}
                  value={filters.grade_level}
                  onChange={(e) => handleFilterChange('grade_level', e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <Select
                  label="Section"
                  options={[{ value: '', label: 'All Sections' }, ...SECTIONS.map(s => ({ value: s, label: s }))]}
                  value={filters.section}
                  onChange={(e) => handleFilterChange('section', e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <Select
                  label="Status"
                  options={[
                    { value: '', label: 'All Statuses' },
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
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

      {/* Students table */}
      <Card className="admin-student-results">
        <div className="admin-table-heading">
          <div>
            <h2>Student directory</h2>
            <p>{total} registered students</p>
          </div>
          <span>{students.length} shown</span>
        </div>
        <div className="admin-table-scroll overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-[var(--border)]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Grade / Section</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Borrowed</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Reservations</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Overdue</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="border-b-[var(--border)] hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm font-medium text-[var(--text-muted)]">
                          {student.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text)]">{student.name}</p>
                          <p className="text-sm text-[var(--text-muted)]">{student.school_id} • {student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-[var(--text)]">{student.grade_level}</p>
                      <p className="text-xs text-[var(--text-muted)]">{student.section}</p>
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={student.status === 'active' ? 'success' : 'danger'}>
                        {student.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--text)]">
                      {student.borrowed_books_count || 0}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--text)]">
                      {student.reservations_count || 0}
                    </td>
                    <td className="px-4 py-4">
                      {student.overdue_count > 0 ? (
                        <Badge variant="danger">{student.overdue_count} overdue</Badge>
                      ) : (
                        <span className="text-[var(--text-muted)]">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="admin-student-actions flex items-center gap-2">
                        <Button variant="ghost" size="sm" aria-label="View student details" title="View details" onClick={() => openViewModal(student.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Edit student" title="Edit student" onClick={() => openEditModal(student)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={student.status === 'active' ? 'Deactivate student' : 'Activate student'} title={student.status === 'active' ? 'Deactivate student' : 'Activate student'} onClick={() => handleStatusToggle(student)}>
                          {student.status === 'active' ? (
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Delete student" title="Delete student" onClick={() => handleDelete(student.id)} className="text-red-500 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-4 py-4 border-t-[var(--border)] flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
              Previous
            </Button>
            <span className="px-4 text-[var(--text-muted)]">Page {page} of {Math.ceil(total / 20)}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / 20)}>
              Next
            </Button>
          </div>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingStudent ? 'Edit Student' : 'Add New Student'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Full Name *" name="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} error={errors.name} required />
          <Input label="School ID *" name="school_id" value={formData.school_id} onChange={(e) => setFormData({...formData, school_id: e.target.value})} error={errors.school_id} required />
          <Input label="Email *" type="email" name="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} error={errors.email} required />
          {editingStudent ? (
            <>
              <Input label="New Password (leave blank to keep current)" type="password" name="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} error={errors.password} />
              <Input label="Confirm New Password" type="password" name="confirm_password" value={formData.confirm_password} onChange={(e) => setFormData({...formData, confirm_password: e.target.value})} error={errors.confirm_password} />
            </>
          ) : (
            <>
              <Input label="Password *" type="password" name="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} error={errors.password} required />
              <Input label="Confirm Password *" type="password" name="confirm_password" value={formData.confirm_password} onChange={(e) => setFormData({...formData, confirm_password: e.target.value})} error={errors.confirm_password} required />
            </>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Grade Level *" options={[{ value: '', label: 'Select Grade' }, ...GRADE_LEVELS.map(g => ({ value: g, label: g }))]} value={formData.grade_level} onChange={(e) => setFormData({...formData, grade_level: e.target.value})} error={errors.grade_level} required />
            <Select label="Section *" options={[{ value: '', label: 'Select Section' }, ...SECTIONS.map(s => ({ value: s, label: s }))]} value={formData.section} onChange={(e) => setFormData({...formData, section: e.target.value})} error={errors.section} required />
          </div>
          <Select label="Status" options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]} value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} />
          {errors.general && <p className="text-red-600 text-sm">{errors.general}</p>}
          <div className="flex justify-end gap-2 pt-4 border-t-[var(--border)]">
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingStudent ? 'Update' : 'Add'} Student</Button>
          </div>
        </form>
      </Modal>

      {/* View Student Modal */}
      <Modal isOpen={!!viewingStudent} onClose={() => setViewingStudent(null)} title="Student Details" size="xl">
        {viewingStudent && (
          <div className="space-y-6">
            {/* Student info */}
            <Card className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xl font-medium text-[var(--text-muted)]">
                  {viewingStudent.student.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text)]">{viewingStudent.student.name}</h3>
                  <p className="text-[var(--text-muted)]">{viewingStudent.student.school_id} • {viewingStudent.student.email}</p>
                  <p className="text-sm text-[var(--text-muted)]">{viewingStudent.student.grade_level} • {viewingStudent.student.section}</p>
                </div>
                <div className="ml-auto">
                  <Badge variant={viewingStudent.student.status === 'active' ? 'success' : 'danger'}>
                    {viewingStudent.student.status}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Tabs for details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-4">
                <h4 className="font-semibold text-[var(--text)] mb-3">Borrowing History</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {viewingStudent.borrowing_history?.length > 0 ? (
                    viewingStudent.borrowing_history.map((t) => (
                      <div key={t.id} className="p-3 bg-[var(--surface-2)] rounded-lg">
                        <p className="font-medium text-sm">{t.book.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">Borrowed: {t.borrow_date ? formatDate(t.borrow_date) : 'N/A'} • Due: {t.due_date ? formatDate(t.due_date) : 'N/A'}</p>
                        <Badge variant={t.status === 'returned' ? 'success' : t.status === 'overdue' ? 'danger' : 'info'} className="text-xs mt-1">{t.status}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-[var(--text-muted)] text-center py-4">No borrowing history</p>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-semibold text-[var(--text)] mb-3">Reservations</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {viewingStudent.reservations?.length > 0 ? (
                    viewingStudent.reservations.map((r) => (
                      <div key={r.id} className="p-3 bg-[var(--surface-2)] rounded-lg">
                        <p className="font-medium text-sm">{r.book.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">Reserved: {r.reservation_date ? formatDate(r.reservation_date) : 'N/A'}</p>
                        <Badge variant={r.status === 'ready_for_pickup' ? 'success' : r.status === 'pending' ? 'warning' : 'info'} className="text-xs mt-1">{r.status.replace('_', ' ')}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-[var(--text-muted)] text-center py-4">No reservations</p>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-semibold text-[var(--text)] mb-3">Overdue Books</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {viewingStudent.overdue_books?.length > 0 ? (
                    viewingStudent.overdue_books.map((t) => (
                      <div key={t.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-lg">
                        <p className="font-medium text-sm">{t.book.title}</p>
                        <p className="text-xs text-red-700">Overdue: {t.due_date ? formatDate(t.due_date) : 'N/A'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[var(--text-muted)] text-center py-4">No overdue books</p>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-semibold text-[var(--text)] mb-3">Reading Interests</h4>
                <div className="flex flex-wrap gap-2">
                  {viewingStudent.interests?.map((i) => (
                    <Badge key={i.id} variant={i.type === 'genre' ? 'primary' : 'accent'}>{i.name}</Badge>
                  ))}
                  {(!viewingStudent.interests || viewingStudent.interests.length === 0) && (
                    <span className="text-[var(--text-muted)]">No interests selected</span>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-semibold text-[var(--text)] mb-3">Recommendation Activity</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {viewingStudent.recommendation_activity?.length > 0 ? (
                    viewingStudent.recommendation_activity.map((r) => (
                      <div key={r.id} className="p-3 bg-[var(--surface-2)] rounded-lg">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">{r.book.title}</p>
                          <Badge variant={r.feedback === 'like' ? 'success' : 'warning'}>
                            {r.feedback}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">{formatDate(r.created_at)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[var(--text-muted)] text-center py-4">No recommendation activity</p>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="font-semibold text-[var(--text)] mb-3">Saved Books</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {viewingStudent.saved_books?.length > 0 ? (
                    viewingStudent.saved_books.map((s) => (
                      <div key={s.id} className="p-3 bg-[var(--surface-2)] rounded-lg">
                        <p className="font-medium text-sm">{s.book.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">{s.book.author}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[var(--text-muted)] text-center py-4">No saved books</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CheckCircle() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default StudentsPage;
