import { useState, useEffect } from 'react';
import { Search, Filter, CheckCircle, X, Calendar, Bookmark, MoreVertical, Eye, AlertCircle, X as XIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDate } from '../../utils/helpers';

function ReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  useEffect(() => {
    fetchReservations();
  }, [page, searchQuery, statusFilter]);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        per_page: 20,
      });
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/reservations?${params.toString()}`);
      if (response.data.success) {
        setReservations(response.data.data.data);
        setTotal(response.data.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    const days = prompt('Pickup deadline (days, default 3):', '3');
    if (days === null) return;
    const pickupDays = parseInt(days) || 3;
    if (pickupDays < 1 || pickupDays > 14) {
      alert('Pickup deadline must be between 1 and 14 days');
      return;
    }
    try {
      await api.post(`/reservations/${id}/approve`, { pickup_deadline_days: pickupDays });
      fetchReservations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return;
    try {
      await api.post(`/reservations/${id}/reject`, { reason });
      fetchReservations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject');
    }
  };

  const handleComplete = async (id) => {
    if (!confirm('Complete this reservation? The book will be marked as borrowed.')) return;
    try {
      await api.post(`/reservations/${id}/complete`);
      fetchReservations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete');
    }
  };

  const handleExpireOld = async () => {
    if (!confirm('Expire all reservations past their pickup deadline?')) return;
    try {
      await api.post('/reservations/expire-old');
      fetchReservations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to expire reservations');
    }
  };

  const renderReservationRow = (r) => {
    const isExpired = r.status === 'ready_for_pickup' && r.pickup_deadline && new Date(r.pickup_deadline) < new Date();

    return (
      <tr key={r.id} className={`border-b-[var(--border)] ${isExpired ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
        <td className="px-4 py-4">
          <div>
            <p className="font-medium text-[var(--text)]">{r.student.name}</p>
            <p className="text-sm text-[var(--text-muted)]">{r.student.school_id}</p>
          </div>
        </td>
        <td className="px-4 py-4">
          <p className="font-medium text-[var(--text)] truncate max-w-xs">{r.book.title}</p>
          <p className="text-sm text-[var(--text-muted)] truncate max-w-xs">{r.book.author}</p>
        </td>
        <td className="px-4 py-4 text-sm text-[var(--text-muted)]">
          {r.reservation_date ? formatDate(r.reservation_date) : 'N/A'}
        </td>
        <td className="px-4 py-4 text-sm text-[var(--text-muted)]">
          {r.pickup_deadline ? (
            <>
              <p className={isExpired ? 'text-red-600 font-medium' : 'text-[var(--text)]'}>
                {formatDate(r.pickup_deadline)}
              </p>
              {isExpired && (
                <p className="text-xs text-red-600">EXPIRED</p>
              )}
            </>
          ) : (
            <span className="text-[var(--text-muted)]">Not set</span>
          )}
        </td>
        <td className="px-4 py-4">
          <Badge variant={statusColors[r.status] || 'info'}>
            {statusLabels[r.status] || r.status}
          </Badge>
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-1">
            {r.status === 'pending' && (
              <div className="flex items-center gap-1">
                <Button variant="primary" size="sm" onClick={() => handleApprove(r.id)}>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Approve
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleReject(r.id)}>
                  <X className="w-3.5 h-3.5" />
                  Reject
                </Button>
              </div>
            )}
            {r.status === 'ready_for_pickup' && !isExpired && (
              <Button variant="success" size="sm" onClick={() => handleComplete(r.id)}>
                <Bookmark className="w-3.5 h-3.5" />
                Complete
              </Button>
            )}
            {isExpired && (
              <Badge variant="danger" className="text-xs">Expired</Badge>
            )}
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Reservations Management</h1>
          <Button onClick={handleExpireOld} variant="ghost" size="sm">
            <Calendar className="w-4 h-4 mr-1" />
            Expire Old
          </Button>
        </div>
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
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Reservations Management</h1>
          <p className="text-[var(--text-muted)]">Manage book reservations and pickup approvals</p>
        </div>
        <Button onClick={handleExpireOld} variant="ghost" size="sm">
          <Calendar className="w-4 h-4 mr-1" />
          Expire Old
        </Button>
      </div>

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
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Reservation Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Pickup Deadline</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    No reservations found
                  </td>
                </tr>
              ) : (
                reservations.map((r) => renderReservationRow(r))
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

export default ReservationsPage;