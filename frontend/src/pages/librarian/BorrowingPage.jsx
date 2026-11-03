import useNow from '../../utils/useNow';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, CheckCircle, X, RotateCcw, AlertCircle, Calendar, BookOpen, Clock, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../contexts/useToast';
import './borrowing.css';

import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function BorrowingPage() {
  const now = useNow();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');
  const [condition, setCondition] = useState('good');
  const [actionLoading, setActionLoading] = useState(false);
  const requestId = useRef(0);
  const toast = useToast();

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

  const fetchTransactions = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page,
        per_page: 20,
      });
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/borrow?${params.toString()}`);
      if (currentRequest !== requestId.current) return;
      if (response.data.success) {
        setTransactions(response.data.data.data);
        setTotal(response.data.data.total);
      }
    } catch (err) {
      if (currentRequest === requestId.current) setError(err.response?.data?.message || 'Unable to load borrowing records. Please try again.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, searchQuery, statusFilter]);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 250);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [fetchTransactions]);

  const openAction = (kind, transaction) => {
    setReason('');
    setCondition('good');
    setDialog({ kind, transaction });
  };

  const submitAction = async (kind, transaction, payload = {}) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const response = await api.post(`/borrow/${transaction.id}/${kind}`, payload);
      if (!response.data.success) throw new Error('Unable to update transaction');
      toast.success({ approve: 'Borrowing request approved.', reject: 'Borrowing request rejected.', 'confirm-return': 'Return confirmed.', extend: 'Loan extended.', 'mark-overdue': 'Loan marked as overdue.' }[kind]);
      setDialog(null);
      await fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update this transaction. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const applyStatus = (value) => {
    if (value === statusFilter && page === 1) return;
    setLoading(true);
    setStatusFilter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPage(1);
  };
  const renderTransactionRow = (t) => {
    const isOverdue = t.status === 'overdue' || (['borrowed', 'return_requested'].includes(t.status) && t.due_date && new Date(t.due_date) < new Date(now));
    const daysOverdue = isOverdue && t.due_date ? Math.max(0, Math.ceil((new Date(now) - new Date(t.due_date)) / (1000 * 60 * 60 * 24))) : 0;

    const actionButtons = (
      <div className="borrowing-row-actions">
        {t.status === 'pending' && (
          <div className="flex items-center gap-1">
            <Button variant="primary" size="sm" onClick={() => submitAction('approve', t)} disabled={actionLoading || loading}>
              <CheckCircle className="w-3.5 h-3.5" />
              Approve
            </Button>
            <Button variant="danger" size="sm" onClick={() => openAction('reject', t)} disabled={actionLoading || loading}>
              <X className="w-3.5 h-3.5" />
              Reject
            </Button>
          </div>
        )}
        {t.status === 'borrowed' && (
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => openAction('confirm-return', t)} disabled={actionLoading || loading}>
              <RotateCcw className="w-3.5 h-3.5" />
              Return
            </Button>
            {!isOverdue && <Button variant="secondary" size="sm" onClick={() => openAction('extend', t)} disabled={actionLoading || loading}>
              <Calendar className="w-3.5 h-3.5" />
              Extend
            </Button>}
            {isOverdue && (
              <Button variant="danger" size="sm" onClick={() => openAction('mark-overdue', t)} disabled={actionLoading || loading}>
                <AlertCircle className="w-3.5 h-3.5" />
                Mark Overdue
              </Button>
            )}
          </div>
        )}
        {t.status === 'return_requested' && (
          <Button variant="primary" size="sm" onClick={() => openAction('confirm-return', t)} disabled={actionLoading || loading}>
            <RotateCcw className="w-3.5 h-3.5" />
            Confirm Return
          </Button>
        )}
        {t.status === 'overdue' && (
          <Button variant="secondary" size="sm" onClick={() => openAction('confirm-return', t)} disabled={actionLoading || loading}>
            <RotateCcw className="w-3.5 h-3.5" />
            Confirm Return
          </Button>
        )}
      </div>
    );

    return (
      <tr key={t.id} className={isOverdue ? 'borrowing-row-overdue' : ''}>
        <td className="px-4 py-4">
          <div>
            <p className="borrowing-cell-title">{t.student.name}</p>
            <p className="text-sm text-[var(--text-muted)]">{t.student.school_id}</p>
          </div>
        </td>
        <td className="px-4 py-4">
          <p className="borrowing-cell-title borrowing-book-title" title={t.book.title}>{t.book.title}</p>
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
              <p className={isOverdue ? 'borrowing-overdue-text' : ''}>
                {formatDate(t.due_date)}
              </p>
              {isOverdue && (
                <p className="borrowing-overdue-text borrowing-overdue-days">{daysOverdue > 0 ? `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue` : 'Overdue'}</p>
              )}
            </div>
          ) : (
            <span className="text-[var(--text-muted)]">N/A</span>
          )}
        </td>
        <td className="px-4 py-4">
          <Badge variant={statusColors[t.status] || 'info'} className={`borrowing-status status-${t.status}`}>
            {statusLabels[t.status] || t.status}
          </Badge>
        </td>
        <td className="px-4 py-4">
          {['pending', 'borrowed', 'return_requested', 'overdue'].includes(t.status) ? actionButtons : <span className="borrowing-no-action">{t.status === 'approved' ? 'Awaiting checkout' : 'No action needed'}</span>}
        </td>
      </tr>
    );
  };


  return (
    <div className="borrowing-page">
      <div className="borrowing-heading">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Borrowing Management</h1>
          <p className="text-[var(--text-muted)]">Manage book borrowing requests and transactions</p>
        </div>
        <span className="borrowing-heading-label"><BookOpen size={17} /> Circulation</span>
      </div>

      {/* Filters */}
      <Card className="borrowing-filters-card">
        <div className="borrowing-quick-filters" role="group" aria-label="Quick status filters">
          {[['', 'All transactions', BookOpen], ['pending', 'Pending requests', Clock], ['borrowed', 'Borrowed', Calendar], ['overdue', 'Overdue', AlertCircle]].map(([value, label, Icon]) =>
            <button type="button" key={value} aria-pressed={statusFilter === value} className={statusFilter === value ? 'is-active' : ''} onClick={() => applyStatus(value)}><Icon size={16} />{label}</button>
          )}
        </div>
        <form className="borrowing-search-form" onSubmit={(e) => { e.preventDefault(); setPage(1); }}>
          <div className="borrowing-search-field">
            <label htmlFor="borrowing-search">Search transactions</label>
            <div className="borrowing-search-input"><Search size={18} aria-hidden="true" />
            <input
              id="borrowing-search"
              type="search"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search by student name, school ID, or book title..."
              className="input"
            />
            </div>
          </div>
          <div className="borrowing-status-field"><label htmlFor="borrowing-status-filter">Status</label>
          <select
            id="borrowing-status-filter"
            value={statusFilter}
            onChange={(e) => applyStatus(e.target.value)}
            className="input w-auto min-w-[200px]"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          </div>
          {(searchQuery || statusFilter) && <Button variant="secondary" onClick={clearFilters}><X size={15} /> Clear filters</Button>}
        </form>
      </Card>

      {/* Transactions table */}
      <Card className="borrowing-table-card">
        <div className="borrowing-table-heading"><div><h2>Borrowing transactions</h2><p>{loading ? 'Loading records…' : error ? 'Records temporarily unavailable' : `${total} matching transaction${total === 1 ? '' : 's'}`}</p></div><span>Latest requests first</span></div>
        {error && <div className="borrowing-error" role="alert"><AlertCircle size={18} /><p>{error}</p><Button variant="secondary" onClick={fetchTransactions}><RotateCcw size={15} /> Try again</Button></div>}
        <div className="borrowing-table-scroll" role="region" aria-label="Borrowing transactions" tabIndex={0} aria-busy={loading}>
          <table className="borrowing-table">
            <caption className="sr-only">Student borrowing requests, loan dates, status, and available actions</caption>
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
              {loading ? <tr><td colSpan={7}><div className="borrowing-loading" role="status" aria-label="Loading transactions">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div></td></tr> : error ? null : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    <div className="borrowing-empty"><Inbox size={32} /><h3>No transactions found</h3><p>{searchQuery || statusFilter ? 'Try another search or clear your filters.' : 'Borrowing requests will appear here.'}</p>{(searchQuery || statusFilter) && <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}</div>
                  </td>
                </tr>
              ) : (
                transactions.map(renderTransactionRow)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!error && total > 20 && (
          <div className="borrowing-pagination">
            <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
            <div><Button variant="secondary" size="sm" onClick={() => setPage(page - 1)} disabled={loading || page === 1}>
              <ChevronLeft size={16} /> Previous
            </Button>
            <span aria-live="polite">Page {page} of {Math.ceil(total / 20)}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={loading || page >= Math.ceil(total / 20)}>
              Next <ChevronRight size={16} />
            </Button>
            </div>
          </div>
        )}
      </Card>
      <Modal isOpen={!!dialog} onClose={() => { if (!actionLoading) setDialog(null); }} className="borrowing-action-modal"
        title={{ reject: 'Reject borrowing request', 'confirm-return': 'Confirm book return', extend: 'Extend loan', 'mark-overdue': 'Mark loan as overdue' }[dialog?.kind]}>
        {dialog && <form onSubmit={(event) => { event.preventDefault(); submitAction(dialog.kind, dialog.transaction, dialog.kind === 'reject' ? { reason } : dialog.kind === 'confirm-return' ? { condition } : {}); }}>
          <div className="borrowing-dialog-context"><BookOpen size={21} /><div><strong>{dialog.transaction.book.title}</strong><p>{dialog.transaction.student.name} · {dialog.transaction.student.school_id}</p></div></div>
          {dialog.kind === 'reject' && <div className="borrowing-dialog-field"><label htmlFor="borrowing-reason">Reason <span>(optional)</span></label><textarea id="borrowing-reason" className="input" rows={3} placeholder="Explain why this request is being declined…" value={reason} onChange={(e) => setReason(e.target.value)} disabled={actionLoading} /></div>}
          {dialog.kind === 'confirm-return' && <div className="borrowing-dialog-field"><label htmlFor="borrowing-condition">Book condition</label><select id="borrowing-condition" className="input" value={condition} onChange={(e) => setCondition(e.target.value)} disabled={actionLoading}><option value="good">Good condition</option><option value="damaged">Damaged</option><option value="lost">Lost</option></select><p>Select the condition checked at the loan desk.</p></div>}
          {dialog.kind === 'extend' && <p className="borrowing-dialog-help">The due date will be extended by the library’s configured renewal period.</p>}
          {dialog.kind === 'mark-overdue' && <p className="borrowing-dialog-help">This loan will be marked as overdue. Confirm that the book has not been returned.</p>}
          <div className="borrowing-dialog-actions"><Button variant="secondary" disabled={actionLoading} onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" variant={['reject', 'mark-overdue'].includes(dialog.kind) ? 'danger' : 'primary'} loading={actionLoading}>{ { reject: 'Reject request', 'confirm-return': 'Confirm return', extend: 'Extend loan', 'mark-overdue': 'Mark overdue' }[dialog.kind] }</Button></div>
        </form>}
      </Modal>
    </div>
  );
}

export default BorrowingPage;
