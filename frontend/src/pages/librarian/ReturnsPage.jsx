import useNow from '../../utils/useNow';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, RotateCcw, CheckCircle, AlertCircle, X, BookOpen, ScanLine, Clock, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../contexts/useToast';
import './borrowing.css';
import './returns.css';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function ReturnsPage() {
  const now = useNow();

  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('return_requested');
  const [quickSearch, setQuickSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [condition, setCondition] = useState('good');
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const resultsRef = useRef(null);
  const toast = useToast();

  const statusOptions = [
    { value: 'return_requested', label: 'Return requests' },
    { value: 'borrowed', label: 'All active loans' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'returned', label: 'Return history' },
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

  const fetchReturns = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, per_page: 20,
        status: statusFilter === 'borrowed' ? 'borrowed,return_requested,overdue' : statusFilter,
      });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      const response = await api.get(`/borrow?${params.toString()}`);
      if (currentRequest !== requestId.current) return;
      if (!response.data.success) throw new Error('Unable to load returns');
      setReturns(response.data.data.data);
      setTotal(response.data.data.total);
    } catch (err) {
      if (currentRequest === requestId.current) setError(err.response?.data?.message || 'Unable to load return records. Please try again.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchReturns(); }, 250);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [fetchReturns]);

  const applyStatus = (value) => {
    if (value === statusFilter && page === 1) return;
    setLoading(true);
    setStatusFilter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setQuickSearch('');
    setStatusFilter('return_requested');
    setPage(1);
  };

  const handleQuickSearch = (event) => {
    event.preventDefault();
    const query = quickSearch.trim();
    if (!query) return;
    if (query === searchQuery && statusFilter === 'borrowed' && page === 1) {
      fetchReturns();
    } else {
      setLoading(true);
      setSearchQuery(query);
      setStatusFilter('borrowed');
      setPage(1);
    }
    resultsRef.current?.focus();
    resultsRef.current?.scrollIntoView({ block: 'start' });
  };

  const openReturn = (transaction) => {
    setCondition('good');
    setSelectedReturn(transaction);
  };

  const confirmReturn = async (event) => {
    event.preventDefault();
    if (!selectedReturn || saving) return;
    setSaving(true);
    try {
      const response = await api.post(`/borrow/${selectedReturn.id}/confirm-return`, { condition });
      if (!response.data.success) throw new Error('Unable to confirm return');
      toast.success(condition === 'lost' ? 'Book recorded as lost.' : 'Book return confirmed.');
      setSelectedReturn(null);
      if (page > 1) {
        setLoading(true);
        setPage(1);
      } else {
        await fetchReturns();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to confirm this return. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderReturnRow = (transaction) => {
    const isActive = ['borrowed', 'return_requested', 'overdue'].includes(transaction.status);
    const isOverdue = transaction.status === 'overdue' || (isActive && transaction.due_date && new Date(transaction.due_date) < new Date(now));
    const daysOverdue = isOverdue && transaction.due_date ? Math.max(0, Math.ceil((new Date(now) - new Date(transaction.due_date)) / 86400000)) : 0;
    return (
      <tr key={transaction.id} className={isOverdue ? 'borrowing-row-overdue' : ''}>
        <td><p className="borrowing-cell-title">{transaction.student.name}</p><p>{transaction.student.school_id}</p></td>
        <td><p className="borrowing-cell-title borrowing-book-title" title={transaction.book.title}>{transaction.book.title}</p><p>{transaction.book.author}</p></td>
        <td>{transaction.borrow_date ? formatDate(transaction.borrow_date) : 'Not available'}</td>
        <td>{transaction.due_date ? <><p className={isOverdue ? 'borrowing-overdue-text' : ''}>{formatDate(transaction.due_date)}</p>{isOverdue && <p className="borrowing-overdue-text borrowing-overdue-days">{daysOverdue > 0 ? `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue` : 'Overdue'}</p>}</> : 'Not set'}</td>
        <td>{transaction.return_request_date ? formatDate(transaction.return_request_date) : <span className="borrowing-no-action">Not requested</span>}</td>
        <td><Badge variant={statusColors[transaction.status] || 'info'} className={`borrowing-status status-${transaction.status}`}>{statusLabels[transaction.status] || transaction.status}</Badge></td>
        <td>{isActive ? <Button size="sm" onClick={() => openReturn(transaction)} disabled={saving || loading}><RotateCcw size={15} /> Confirm return</Button> : <span className="borrowing-no-action"><CheckCircle size={13} className="returns-complete-icon" /> Return completed</span>}</td>
      </tr>
    );
  };

  return (
    <div className="borrowing-page returns-page">
      <div className="borrowing-heading"><div><h1>Returns Management</h1><p>Review return requests, check book condition, and confirm returns.</p></div><span className="borrowing-heading-label"><RotateCcw size={17} /> Circulation</span></div>
      <Card className="returns-lookup-card">
        <div className="returns-lookup-heading"><div className="returns-lookup-icon"><ScanLine size={23} /></div><div><h2>Quick return lookup</h2><p>Scan or enter a student ID or ISBN to find matching active loans below.</p></div></div>
        <form className="returns-lookup-form" onSubmit={handleQuickSearch}>
          <div className="borrowing-search-field"><label htmlFor="returns-quick-search">Student ID or ISBN</label><div className="borrowing-search-input"><ScanLine size={18} aria-hidden="true" /><input id="returns-quick-search" className="input" type="search" value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} placeholder="Scan or type student ID or ISBN…" required /></div></div>
          <Button type="submit" disabled={!quickSearch.trim() || saving}><Search size={17} /> Find loans</Button>
        </form>
        <p className="returns-lookup-hint"><BookOpen size={14} /> Check the student and book, then choose Confirm return.</p>
      </Card>
      <Card className="borrowing-filters-card">
        <div className="borrowing-quick-filters" role="group" aria-label="Quick return filters">
          {[['return_requested', 'Return requests', RotateCcw], ['borrowed', 'All active loans', BookOpen], ['overdue', 'Overdue', AlertCircle], ['returned', 'Return history', Clock]].map(([value, label, Icon]) =>
            <button type="button" key={value} className={statusFilter === value ? 'is-active' : ''} aria-pressed={statusFilter === value} onClick={() => applyStatus(value)}><Icon size={16} />{label}</button>
          )}
        </div>
        <form className="borrowing-search-form" onSubmit={(event) => { event.preventDefault(); setPage(1); }}>
          <div className="borrowing-search-field"><label htmlFor="returns-search">Search loans and returns</label><div className="borrowing-search-input"><Search size={18} aria-hidden="true" /><input id="returns-search" type="search" className="input" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} placeholder="Search by student, school ID, book title, or ISBN…" /></div></div>
          <div className="borrowing-status-field"><label htmlFor="returns-status">Status</label><select id="returns-status" className="input" value={statusFilter} onChange={(event) => applyStatus(event.target.value)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          {(searchQuery || statusFilter !== 'return_requested') && <Button variant="secondary" onClick={clearFilters}><X size={15} /> Reset filters</Button>}
        </form>
      </Card>
      <Card className="borrowing-table-card">
        <div ref={resultsRef} className="returns-results-anchor" tabIndex={-1} />
        <div className="borrowing-table-heading"><div><h2>{statusFilter === 'returned' ? 'Return history' : 'Loans awaiting return'}</h2><p>{loading ? 'Loading records…' : error ? 'Records temporarily unavailable' : `${total} matching record${total === 1 ? '' : 's'}`}</p></div><span>Latest loans first</span></div>
        {error && <div className="borrowing-error" role="alert"><AlertCircle size={18} /><p>{error}</p><Button variant="secondary" onClick={fetchReturns}><RotateCcw size={15} /> Try again</Button></div>}
        <div className="borrowing-table-scroll" role="region" aria-label="Loans and returns" tabIndex={0} aria-busy={loading}>
          <table className="borrowing-table"><caption className="sr-only">Book loans, student details, due dates, return requests, and return actions</caption>
            <thead><tr>{['Student', 'Book', 'Borrow date', 'Due date', 'Return requested', 'Status', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={7}><div className="borrowing-loading" role="status" aria-label="Loading returns">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div></td></tr> : error ? null : returns.length === 0 ? <tr><td colSpan={7}><div className="borrowing-empty"><Inbox size={32} /><h3>{searchQuery ? 'No matching records' : statusFilter === 'return_requested' ? 'No return requests to review' : statusFilter === 'returned' ? 'No completed returns yet' : 'No loans found'}</h3><p>{searchQuery ? 'Check the student ID or ISBN, or try another search.' : 'Use All active loans to find books still checked out.'}</p>{statusFilter !== 'borrowed' && <Button variant="secondary" onClick={() => applyStatus('borrowed')}>View active loans</Button>}</div></td></tr> : returns.map(renderReturnRow)}</tbody>
          </table>
        </div>
        {!error && total > 20 && <div className="borrowing-pagination"><span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span><div>
          <Button size="sm" variant="secondary" onClick={() => setPage(page - 1)} disabled={loading || page === 1}><ChevronLeft size={16} /> Previous</Button><span aria-live="polite">Page {page} of {Math.ceil(total / 20)}</span><Button size="sm" variant="secondary" onClick={() => setPage(page + 1)} disabled={loading || page >= Math.ceil(total / 20)}>Next <ChevronRight size={16} /></Button>
        </div></div>}
      </Card>
      <Modal isOpen={!!selectedReturn} title="Confirm book return" className="borrowing-action-modal" onClose={() => { if (!saving) setSelectedReturn(null); }}>
        {selectedReturn && <form onSubmit={confirmReturn}>
          <div className="borrowing-dialog-context"><BookOpen size={21} /><div><strong>{selectedReturn.book.title}</strong><p>{selectedReturn.student.name} · {selectedReturn.student.school_id}</p><p>Due: {selectedReturn.due_date ? formatDate(selectedReturn.due_date) : 'Not set'}</p></div></div>
          <div className="borrowing-dialog-field"><label htmlFor="returns-condition">Book condition</label><select id="returns-condition" className="input" value={condition} onChange={(event) => setCondition(event.target.value)} disabled={saving}><option value="good">Good condition</option><option value="damaged">Damaged</option><option value="lost">Lost</option></select><p>{condition === 'lost' ? 'This records the book as lost and closes the loan.' : condition === 'damaged' ? 'This records a damaged return and closes the loan.' : 'Confirm that you have received this book in good condition.'}</p></div>
          <div className="borrowing-dialog-actions"><Button variant="secondary" onClick={() => setSelectedReturn(null)} disabled={saving}>Cancel</Button><Button type="submit" variant={condition === 'lost' ? 'danger' : 'primary'} loading={saving}><CheckCircle size={16} />{condition === 'lost' ? 'Record as lost' : 'Confirm return'}</Button></div>
        </form>}
      </Modal>
    </div>
  );
}

export default ReturnsPage;