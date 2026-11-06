import useNow from '../../utils/useNow';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, CheckCircle, X, Calendar, Bookmark, Clock, AlertCircle, RotateCcw, Inbox, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../contexts/useToast';
import './borrowing.css';
import './reservations.css';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function ReservationsPage() {
  const now = useNow();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [pickupDays, setPickupDays] = useState('3');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const requestId = useRef(0);
  const toast = useToast();

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'ready_for_pickup', label: 'Ready for Pickup' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'expired', label: 'Expired' },
  ];

  const statusColors = {
    pending: 'warning',
    approved: 'info',
    ready_for_pickup: 'success',
    completed: 'primary',
    cancelled: 'danger',
    expired: 'danger',
  };

  const statusLabels = {
    pending: 'Pending',
    approved: 'Approved',
    ready_for_pickup: 'Ready for Pickup',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };

  const fetchReservations = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page, per_page: 20 });
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/reservations?${params.toString()}`);
      if (currentRequest !== requestId.current) return;
      if (!response.data.success) throw new Error('Unable to load reservations');
      setReservations(response.data.data.data);
      setTotal(response.data.data.total);
    } catch (err) {
      if (currentRequest === requestId.current) setError(err.response?.data?.message || 'Unable to load reservations. Please try again.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page, searchQuery, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchReservations(); }, 250);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [fetchReservations]);

  const applyStatus = (value) => {
    if (statusFilter === value && page === 1) return;
    setLoading(true);
    setStatusFilter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPage(1);
  };

  const openAction = (kind, reservation = null) => {
    setPickupDays('3');
    setReason('');
    setDialog({ kind, reservation });
  };

  const submitAction = async (event) => {
    event.preventDefault();
    if (!dialog || actionLoading) return;
    setActionLoading(true);
    try {
      const { kind, reservation } = dialog;
      const url = kind === 'expire-old' ? '/reservations/expire-old' : `/reservations/${reservation.id}/${kind}`;
      const payload = kind === 'approve' ? { pickup_deadline_days: Number(pickupDays) } : kind === 'reject' ? { reason } : {};
      const response = await api.post(url, payload);
      if (!response.data.success) throw new Error('Unable to update reservation');
      toast.success(response.data.message || 'Reservation updated.');
      setDialog(null);
      if (page > 1) {
        setLoading(true);
        setPage(1);
      } else {
        await fetchReservations();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update reservations. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderReservationRow = (r) => {
    const deadlinePassed = r.status === 'ready_for_pickup' && r.pickup_deadline && new Date(r.pickup_deadline) < new Date(now);
    return (
      <tr key={r.id} className={deadlinePassed ? 'borrowing-row-overdue' : ''}>
        <td><p className="borrowing-cell-title">{r.student.name}</p><p>{r.student.school_id}</p></td>
        <td><p className="borrowing-cell-title borrowing-book-title" title={r.book.title}>{r.book.title}</p><p>{r.book.author}</p></td>
        <td>{r.reservation_date ? formatDate(r.reservation_date) : 'Not available'}</td>
        <td>{r.pickup_deadline ? <><p className={deadlinePassed ? 'borrowing-overdue-text' : ''}>{formatDate(r.pickup_deadline)}</p>{deadlinePassed && <p className="borrowing-overdue-text borrowing-overdue-days">Pickup deadline passed</p>}</> : <span className="reservation-no-deadline">Not set</span>}</td>
        <td><Badge variant={statusColors[r.status] || 'info'} className={`borrowing-status status-${r.status}`}>{statusLabels[r.status] || r.status}</Badge></td>
        <td><div className="borrowing-row-actions">
          {r.status === 'pending' && <>
            <Button size="sm" onClick={() => openAction('approve', r)} disabled={actionLoading || loading}><CheckCircle size={15} /> Approve</Button>
            <Button variant="danger" size="sm" onClick={() => openAction('reject', r)} disabled={actionLoading || loading}><X size={15} /> Reject</Button>
          </>}
          {r.status === 'ready_for_pickup' && !deadlinePassed && <Button size="sm" onClick={() => openAction('complete', r)} disabled={actionLoading || loading}><Bookmark size={15} /> Confirm pickup</Button>}
          {deadlinePassed && <span className="reservation-deadline-hint"><AlertCircle size={14} /> Awaiting expiry</span>}
          {r.status === 'approved' && <span className="borrowing-no-action">Awaiting pickup readiness</span>}
          {['completed', 'cancelled', 'expired'].includes(r.status) && <span className="borrowing-no-action">No action needed</span>}
        </div></td>
      </tr>
    );
  };

  const dialogTitles = { approve: 'Approve reservation', reject: 'Reject reservation', complete: 'Confirm book pickup', 'expire-old': 'Expire overdue reservations' };

  return (
    <div className="borrowing-page reservations-page">
      <div className="borrowing-heading">
        <div><h1>Reservations Management</h1><p>Manage book reservations and pickup approvals.</p></div>
        <Button variant="secondary" onClick={() => openAction('expire-old')} disabled={actionLoading}><Calendar size={17} /> Expire overdue reservations</Button>
      </div>
      <Card className="borrowing-filters-card">
        <div className="borrowing-quick-filters" role="group" aria-label="Quick reservation filters">
          {[['', 'All reservations', Bookmark], ['pending', 'Pending approval', Clock], ['ready_for_pickup', 'Ready for pickup', CheckCircle], ['completed', 'Completed', Calendar]].map(([value, label, Icon]) =>
            <button type="button" key={value} aria-pressed={statusFilter === value} className={statusFilter === value ? 'is-active' : ''} onClick={() => applyStatus(value)}><Icon size={16} />{label}</button>
          )}
        </div>
        <form className="borrowing-search-form" onSubmit={(event) => { event.preventDefault(); setPage(1); }}>
          <div className="borrowing-search-field">
            <label htmlFor="reservation-search">Search reservations</label>
            <div className="borrowing-search-input"><Search size={18} aria-hidden="true" />
              <input id="reservation-search" type="search" className="input" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setPage(1); }} placeholder="Search by student name, school ID, or book title…" />
            </div>
          </div>
          <div className="borrowing-status-field"><label htmlFor="reservation-status">Status</label>
            <select id="reservation-status" className="input" value={statusFilter} onChange={(event) => applyStatus(event.target.value)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </div>
          {(searchQuery || statusFilter) && <Button variant="secondary" onClick={clearFilters}><X size={15} /> Clear filters</Button>}
        </form>
      </Card>
      <Card className="borrowing-table-card">
        <div className="borrowing-table-heading"><div><h2>Reservation requests</h2><p>{loading ? 'Loading reservations…' : error ? 'Reservations temporarily unavailable' : `${total} matching reservation${total === 1 ? '' : 's'}`}</p></div><span>Latest requests first</span></div>
        {error && <div className="borrowing-error" role="alert"><AlertCircle size={18} /><p>{error}</p><Button variant="secondary" onClick={fetchReservations}><RotateCcw size={15} /> Try again</Button></div>}
        <div className="borrowing-table-scroll" role="region" aria-label="Reservation requests" tabIndex={0} aria-busy={loading}>
          <table className="borrowing-table">
            <caption className="sr-only">Student book reservations, pickup deadlines, status, and available actions</caption>
            <thead><tr>{['Student', 'Book', 'Reservation date', 'Pickup deadline', 'Status', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={6}><div className="borrowing-loading" role="status" aria-label="Loading reservations">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div></td></tr> : error ? null : reservations.length === 0 ?
              <tr><td colSpan={6}><div className="borrowing-empty"><Inbox size={32} /><h3>No reservations found</h3><p>{searchQuery || statusFilter ? 'Try another search or clear your filters.' : 'New reservation requests will appear here.'}</p>{(searchQuery || statusFilter) && <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}</div></td></tr>
              : reservations.map(renderReservationRow)}</tbody>
          </table>
        </div>
        {!error && total > 20 && <div className="borrowing-pagination"><span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span><div>
          <Button size="sm" variant="secondary" onClick={() => setPage(page - 1)} disabled={loading || page === 1}><ChevronLeft size={16} /> Previous</Button>
          <span aria-live="polite">Page {page} of {Math.ceil(total / 20)}</span>
          <Button size="sm" variant="secondary" onClick={() => setPage(page + 1)} disabled={loading || page >= Math.ceil(total / 20)}>Next <ChevronRight size={16} /></Button>
        </div></div>}
      </Card>
      <Modal isOpen={!!dialog} title={dialogTitles[dialog?.kind]} className="borrowing-action-modal" onClose={() => { if (!actionLoading) setDialog(null); }}>
        {dialog && <form onSubmit={submitAction}>
          {dialog.reservation && <div className="borrowing-dialog-context"><Bookmark size={21} /><div><strong>{dialog.reservation.book.title}</strong><p>{dialog.reservation.student.name} · {dialog.reservation.student.school_id}</p></div></div>}
          {dialog.kind === 'approve' && <div className="borrowing-dialog-field"><label htmlFor="reservation-pickup-days">Pickup window (days)</label><input id="reservation-pickup-days" type="number" className="input" min="1" max="14" step="1" required value={pickupDays} onChange={(event) => setPickupDays(event.target.value)} disabled={actionLoading} /><p>Choose 1–14 days. Approval holds an available copy and notifies the student that it is ready for pickup.</p></div>}
          {dialog.kind === 'reject' && <div className="borrowing-dialog-field"><label htmlFor="reservation-reason">Reason <span>(optional)</span></label><textarea id="reservation-reason" className="input" maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this request is being declined…" disabled={actionLoading} /><p>The student will receive a notification about this decision.</p></div>}
          {dialog.kind === 'complete' && <p className="borrowing-dialog-help">Confirm that the student has collected this book. This completes the reservation and starts a borrowing transaction.</p>}
          {dialog.kind === 'expire-old' && <div className="reservation-expire-notice"><AlertCircle size={22} /><p>Expire all reservations that are ready for pickup and past their pickup deadline. Their held copies will be released.</p></div>}
          <div className="borrowing-dialog-actions"><Button variant="secondary" disabled={actionLoading} onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" loading={actionLoading} variant={['reject', 'expire-old'].includes(dialog.kind) ? 'danger' : 'primary'}>{ { approve: 'Approve reservation', reject: 'Reject reservation', complete: 'Confirm pickup', 'expire-old': 'Expire overdue reservations' }[dialog.kind] }</Button></div>
        </form>}
      </Modal>
    </div>
  );
}

export default ReservationsPage;
