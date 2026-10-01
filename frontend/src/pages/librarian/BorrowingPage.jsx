import { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, X, Clock, RotateCcw, AlertCircle, MoreVertical, Eye, Calendar, Download, X as XIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function BorrowingPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'borrowed', label: 'Borrowed' },
    { value: 'return_requested', label: 'Return Requested' },
    { value: 'returned', label: 'Returned' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'lost', label: 'Lost' },
    { value: 'damaged', label: 'Damaged' },
  ];

  const statusColors = {
    pending: 'warning',
    approved: 'info',
    borrowed: 'primary',
    return_requested: 'warning',
    returned: 'success',
    rejected: 'danger',
    overdue: 'danger',
    lost: 'purple',
    damaged: 'accent',
  };

  const statusLabels = {
    pending: 'Pending Approval',
    approved: 'Approved',
    borrowed: 'Borrowed',
    return_requested: 'Return Requested',
    returned: 'Returned',
    rejected: 'Rejected',
    overdue: 'Overdue',
    lost: 'Lost',
    damaged: 'Damaged',
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, searchQuery, statusFilter]);

  const fetchTransactions = async () => {
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
        setTransactions(response.data.data.data);
        setTotal(response.data.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/borrow/${id}/approve`);
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return;
    try {
      await api.post(`/borrow/${id}/reject`, { reason });
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject');
    }
  };

  const handleConfirmReturn = async (id) => {
    const condition = prompt('Book condition (good/damaged/lost):', 'good');
    if (!condition) return;
    try {
      await api.post(`/borrow/${id}/confirm-return`, { condition });
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to confirm return');
    }
  };

  const handleExtend = async (id) => {
    const days = prompt('Additional days (1-30):', '7');
    if (!days || isNaN(days) || days < 1 || days > 30) return;
    try {
      await api.post(`/borrow/${id}/extend`, { additional_days: parseInt(days) });
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to extend');
    }
  };

  const handleMarkOverdue = async (id) => {
    if (!confirm('Mark this book as overdue?')) return;
    try {
      await api.post(`/borrow/${id}/mark-overdue`);
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark overdue');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Borrowing Management</h1>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  const renderTransactionRow = (t) => {
    const isOverdue = t.status === 'borrowed' && t.due_date && new Date(t.due_date) < new Date();
    const daysOverdue = isOverdue ? Math.ceil((new Date() - new Date(t.due_date)) / (1000 * 60 * 60 * 24)) : 0;

    const actionButtons = (
      <div className="flex items-center gap-1">
        {t.status === 'pending' && (
          <div className="flex items-center gap-1">
            <Button variant="primary" size="sm" onClick={() => handleApprove(t.id)}>
              <CheckCircle className="w-3.5 h-3.5" />
              Approve
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleReject(t.id)}>
              <X className="w-3.5 h-3.5" />
              Reject
            </Button>
          </div>
        )}
        {t.status === 'borrowed' && (
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => handleConfirmReturn(t.id)}>
              <RotateCcw className="w-3.5 h-3.5" />
              Return
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleExtend(t.id)}>
              <Calendar className="w-3.5 h-3.5" />
              Extend
            </Button>
            {isOverdue && (
              <Button variant="danger" size="sm" onClick={() => handleMarkOverdue(t.id)}>
                <AlertCircle className="w-3.5 h-3.5" />
                Mark Overdue
              </Button>
            )}
          </div>
        )}
        {t.status === 'return_requested' && (
          <Button variant="primary" size="sm" onClick={() => handleConfirmReturn(t.id)}>
            <RotateCcw className="w-3.5 h-3.5" />
            Confirm Return
          </Button>
        )}
        {t.status === 'overdue' && (
          <Button variant="secondary" size="sm" onClick={() => handleConfirmReturn(t.id)}>
            <RotateCcw className="w-3.5 h-3.5" />
            Confirm Return
          </Button>
        )}
      </div>
    );

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
          {t.request_date ? formatDate(t.request_date) : 'N/A'}
        </td>
        <td className="px-4 py-4 text-sm text-[var(--text-muted)]">
          {t.borrow_date ? formatDate(t.borrow_date) : 'N/A'}
        </td>
        <td className="px-4 py-4">
          {t.due_date ? (
            <div>
              <p className={isOverdue ? 'text-red-600 font-medium' : 'text-[var(--text)]'}>
                {formatDate(t.due_date)}
              </p>
              {isOverdue && (
                <p className="text-xs text-red-600">{daysOverdue} days overdue</p>
              )}
            </div>
          ) : (
            <span className="text-[var(--text-muted)]">N/A</span>
          )}
        </td>
        <td className="px-4 py-4">
          <Badge variant={statusColors[t.status] || 'info'}>
            {statusLabels[t.status] || t.status}
          </Badge>
        </td>
        <td className="px-4 py-4">
          {actionButtons}
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Borrowing Management</h1>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Borrowing Management</h1>
          <p className="text-[var(--text-muted)]">Manage book borrowing requests and transactions</p>
        </div>
      </div>

      {/* Filters */}
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

      {/* Transactions table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-[var(--border)]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Book</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Request Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Borrow Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Due Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map(renderTransactionRow)
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
    </div>
  );
}

export default BorrowingPage;