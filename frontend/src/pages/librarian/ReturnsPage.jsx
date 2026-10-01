import { useState, useEffect } from 'react';
import { Search, Filter, RotateCcw, CheckCircle, AlertCircle, X, Eye, MoreVertical, Clock, Calendar, Download, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function ReturnsPage() {
  const { user } = useAuth();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('return_requested');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickResult, setQuickResult] = useState(null);

  const statusOptions = [
    { value: 'return_requested', label: 'Return Requested' },
    { value: 'borrowed', label: 'All Borrowed' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'returned', label: 'Returned' },
  ];

  const statusColors = {
    return_requested: 'warning',
    borrowed: 'primary',
    overdue: 'danger',
    returned: 'success',
  };

  const statusLabels = {
    return_requested: 'Return Requested',
    borrowed: 'Borrowed',
    overdue: 'Overdue',
    returned: 'Returned',
  };

  useEffect(() => {
    fetchReturns();
  }, [page, searchQuery, statusFilter]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        per_page: 20,
      });
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/borrow?${params.toString()}`);
      if (response.data.success) {
        setReturns(response.data.data.data.filter(t =>
          statusFilter === 'return_requested' ? t.status === 'return_requested' :
          statusFilter === 'borrowed' ? ['borrowed', 'return_requested', 'overdue'].includes(t.status) :
          statusFilter === 'overdue' ? t.status === 'overdue' :
          t.status === 'returned'
        ));
        setTotal(response.data.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch returns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSearch = async () => {
    if (!quickSearch.trim()) return;
    try {
      const response = await api.get(`/borrow?search=${encodeURIComponent(quickSearch)}&status=borrowed,return_requested,overdue`);
      if (response.data.success && response.data.data.data.length > 0) {
        setQuickResult(response.data.data.data[0]);
      } else {
        setQuickResult(null);
        alert('No matching borrowed book found');
      }
    } catch (err) {
      alert('Search failed');
    }
  };

  const handleConfirmReturn = async (id, condition = 'good') => {
    try {
      await api.post(`/borrow/${id}/confirm-return`, { condition });
      fetchReturns();
      setQuickResult(null);
      setQuickSearch('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to confirm return');
    }
  };

  const handleConfirmQuickReturn = async (condition = 'good') => {
    if (quickResult) {
      await handleConfirmReturn(quickResult.id, condition);
    }
  };

  const renderReturnRow = (t) => {
    const isOverdue = t.status === 'overdue' || (t.status === 'borrowed' && t.due_date && new Date(t.due_date) < new Date());
    const daysOverdue = isOverdue && t.due_date ? Math.ceil((new Date() - new Date(t.due_date)) / (1000 * 60 * 60 * 24)) : 0;

    return (
      <tr key={t.id} className={`border-b-[var(--border)] ${isOverdue ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
        <td className="px-4 py-4">
          <div>
            <p className="font-medium text-[var(--text)]">{t.student.name}</p>
            <p className="text-sm text-[var(--text-muted)]">{t.student.school_id}</p>
          </div>
        </td>
        <td className="px-4 py-4">
          <p className="font-medium text-[var(--text)] truncate max-w-xs">{t.book.title}</p>
          <p className="text-sm text-[var(--text-muted)] truncate max-w-xs">{t.book.author}</p>
        </td>
        <td className="px-4 py-4 text-sm text-[var(--text-muted)]">
          {t.borrow_date ? formatDate(t.borrow_date) : 'N/A'}
        </td>
        <td className="px-4 py-4">
          {t.due_date ? (
            <>
              <p className={isOverdue ? 'text-red-600 font-medium' : 'text-[var(--text)]'}>
                {formatDate(t.due_date)}
              </p>
              {isOverdue && (
                <p className="text-xs text-red-600">{daysOverdue} days overdue</p>
              )}
            </>
          ) : (
            <span className="text-[var(--text-muted)]">N/A</span>
          )}
        </td>
        <td className="px-4 py-4 text-sm text-[var(--text-muted)]">
          {t.return_request_date ? formatDate(t.return_request_date) : 'Not requested'}
        </td>
        <td className="px-4 py-4">
          <Badge variant={statusColors[t.status] || 'info'}>
            {statusLabels[t.status] || t.status}
          </Badge>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-1">
            {t.status === 'return_requested' && (
              <div className="flex items-center gap-1">
                <Button variant="primary" size="sm" onClick={() => handleConfirmReturn(t.id, 'good')}>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Good
                </Button>
                <Button variant="warning" size="sm" onClick={() => handleConfirmReturn(t.id, 'damaged')}>
                  <AlertCircle className="w-3.5 h-3.5" />
                  Damaged
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleConfirmReturn(t.id, 'lost')}>
                  <X className="w-3.5 h-3.5" />
                  Lost
                </Button>
              </div>
            )}
            {t.status === 'borrowed' && (
              <Button variant="secondary" size="sm" onClick={() => handleConfirmReturn(t.id, 'good')}>
                <RotateCcw className="w-3.5 h-3.5" />
                Return (Good)
              </Button>
            )}
            {t.status === 'overdue' && (
              <Button variant="primary" size="sm" onClick={() => handleConfirmReturn(t.id, 'good')}>
                <CheckCircle className="w-3.5 h-3.5" />
                Confirm Return
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Returns Management</h1>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Returns Management</h1>
          <p className="text-[var(--text-muted)]">Confirm book returns and manage return requests</p>
        </div>
      </div>

      <Card className="p-5 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-primary-800 dark:text-primary-200">Quick Return Confirmation</h3>
        </div>
        <p className="text-sm text-primary-700 dark:text-primary-300 mb-4">
          Scan or type a Student ID or ISBN to quickly find and confirm a return.
        </p>
        <div className="flex gap-2">
          <Input
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickSearch()}
            placeholder="Enter Student ID or ISBN..."
            leftIcon={<Search className="w-5 h-5" />}
            className="flex-1"
          />
          <Button onClick={handleQuickSearch}><Search className="w-4 h-4" /> Find</Button>
        </div>
        {quickResult && (
          <div className="mt-4 p-4 bg-[var(--surface)] rounded-lg border border-primary-200 dark:border-primary-800 animate-slide-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="admin-mini-cover-wrap relative w-12 h-16 flex-shrink-0 overflow-hidden rounded bg-[var(--surface-2)]">
                  <div className="admin-mini-cover" aria-hidden="true"><BookOpen className="w-5 h-5" /></div>
                  {quickResult.book.cover_image && (
                    <img
                      src={`/storage/${quickResult.book.cover_image}`}
                      alt={quickResult.book.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
                <div>
                  <p className="font-medium text-[var(--text)]">{quickResult.book.title}</p>
                  <p className="text-sm text-[var(--text-muted)]">{quickResult.book.author}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Student: {quickResult.student.name} ({quickResult.student.school_id})
                  </p>
                  <Badge variant={statusColors[quickResult.status] || 'info'}>
                    {statusLabels[quickResult.status]}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleConfirmQuickReturn('good')}>
                  <CheckCircle className="w-4 h-4" />
                  Good Condition
                </Button>
                <Button variant="warning" onClick={() => handleConfirmQuickReturn('damaged')}>
                  <AlertCircle className="w-4 h-4" />
                  Damaged
                </Button>
                <Button variant="danger" onClick={() => handleConfirmQuickReturn('lost')}>
                  <X className="w-4 h-4" />
                  Lost
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <form className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-faint)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
              placeholder="Search by student name, school ID, or book title..."
              className="input pl-12"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input w-auto min-w-[200px]"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-[var(--border)]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Book</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Borrow Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Due Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Return Requested</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    No return requests found
                  </td>
                </tr>
              ) : (
                returns.map((t) => renderReturnRow(t))
              )}
            </tbody>
          </table>
        </div>

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
    </div>
  );
}

export default ReturnsPage;
