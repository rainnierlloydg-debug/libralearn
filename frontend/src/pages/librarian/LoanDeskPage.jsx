import { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Clock, RotateCcw, CheckCircle, X, Save, Wallet, Calendar, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';
import api from '../../utils/api';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../contexts/useToast';
import { formatDate } from '../../utils/helpers';
import './borrowing.css';
import './loan-desk.css';

const currency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0));

function LoanDeskPage() {
  const [settings, setSettings] = useState(null);
  const [fineInput, setFineInput] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [renewals, setRenewals] = useState([]);
  const [fines, setFines] = useState([]);
  const [renewalTotal, setRenewalTotal] = useState(0);
  const [fineTotal, setFineTotal] = useState(0);
  const [renewalPage, setRenewalPage] = useState(1);
  const [finePage, setFinePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState('');
  const [action, setAction] = useState(null);
  const [dialog, setDialog] = useState(null);
  const queueRequest = useRef(0);
  const toast = useToast();

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError('');
    try {
      const response = await api.get('/library-settings');
      if (!response.data.success) throw new Error('Unable to load settings');
      setSettings(response.data.data);
      setFineInput(response.data.data.fine_per_day == null ? '' : String(response.data.data.fine_per_day));
    } catch {
      setSettingsError('Unable to load fine settings. Please try again.');
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const fetchQueues = useCallback(async () => {
    const current = ++queueRequest.current;
    setLoading(true);
    setQueueError('');
    try {
      const [renewalsRes, finesRes] = await Promise.all([
        api.get(`/borrow?renewal_requested=1&per_page=10&page=${renewalPage}`),
        api.get(`/borrow?fine_unpaid=1&per_page=10&page=${finePage}`),
      ]);
      if (current !== queueRequest.current) return;
      if (!renewalsRes.data.success || !finesRes.data.success) throw new Error('Unable to load queues');
      const renewalData = renewalsRes.data.data;
      const fineData = finesRes.data.data;
      setRenewals(renewalData.data);
      setFines(fineData.data);
      setRenewalTotal(renewalData.total);
      setFineTotal(fineData.total);
      if (renewalPage > renewalData.last_page) setRenewalPage(renewalData.last_page);
      if (finePage > fineData.last_page) setFinePage(fineData.last_page);
    } catch {
      if (current === queueRequest.current) setQueueError('Unable to load renewal requests and unpaid fines. Please try again.');
    } finally {
      if (current === queueRequest.current) setLoading(false);
    }
  }, [renewalPage, finePage]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchSettings(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchSettings]);

  useEffect(() => {
    const timer = setTimeout(() => { fetchQueues(); }, 0);
    return () => { clearTimeout(timer); queueRequest.current += 1; };
  }, [fetchQueues]);

  const saveFine = async (event) => {
    event.preventDefault();
    if (action) return;
    setAction('settings');
    try {
      const response = await api.put('/library-settings', { fine_per_day: fineInput });
      if (!response.data.success) throw new Error('Unable to save settings');
      setSettings(response.data.data);
      setFineInput(String(response.data.data.fine_per_day));
      toast.success('Daily fine rate saved.');
    } catch (err) {
      toast.error(err.response?.data?.errors?.fine_per_day?.[0] || err.response?.data?.message || 'Unable to save the fine rate.');
    } finally {
      setAction(null);
    }
  };

  const submitAction = async (event) => {
    event.preventDefault();
    if (!dialog || action) return;
    setAction(dialog.kind);
    try {
      const response = await api.post(`/borrow/${dialog.transaction.id}/${dialog.kind}`);
      if (!response.data.success) throw new Error('Unable to update loan');
      toast.success({ renew: 'Renewal approved.', 'renew-reject': 'Renewal declined.', 'fine-paid': 'Fine marked as paid.' }[dialog.kind]);
      setDialog(null);
      await fetchQueues();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update this loan. Please try again.');
    } finally {
      setAction(null);
    }
  };

  const pagination = (page, total, updatePage, label) => total > 10 && (
    <div className="borrowing-pagination"><span>{total} {label}</span><div>
      <Button size="sm" variant="secondary" disabled={loading || !!action || page === 1} onClick={() => updatePage(page - 1)}><ChevronLeft size={16} /> Previous</Button>
      <span>Page {page} of {Math.ceil(total / 10)}</span>
      <Button size="sm" variant="secondary" disabled={loading || !!action || page >= Math.ceil(total / 10)} onClick={() => updatePage(page + 1)}>Next <ChevronRight size={16} /></Button>
    </div></div>
  );

  const queuePlaceholder = (kind) => loading ? <div className="loan-desk-loading" role="status" aria-label="Loading loan desk records">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div> : queueError ? <div className="loan-desk-empty"><AlertCircle size={28} /><p>Records are temporarily unavailable.</p></div> : (
    <div className="loan-desk-empty"><div className="loan-desk-empty-icon">{kind === 'renewals' ? <CheckCircle size={27} /> : <Wallet size={27} />}</div>
      <h3>{kind === 'renewals' ? 'No renewal requests to review' : 'No unpaid fines'}</h3><p>{kind === 'renewals' ? 'New student renewal requests will appear here.' : 'All recorded fines have been settled.'}</p>
    </div>
  );

  return (
    <div className="borrowing-page loan-desk-page">
      <div className="borrowing-heading"><div><h1>Loan Desk</h1><p>Review renewals, track unpaid fines, and manage the daily fine rate.</p></div><Button variant="secondary" disabled={loading || !!action} onClick={fetchQueues}><RefreshCw size={16} /> Refresh requests</Button></div>
      <div className="loan-desk-summary" aria-label="Loan desk overview">
        {[
          { label: 'Renewal requests', value: loading || queueError ? '—' : renewalTotal, icon: RotateCcw, note: 'Awaiting your decision' },
          { label: 'Unpaid fines', value: loading || queueError ? '—' : fineTotal, icon: Wallet, note: 'Payments to record' },
          { label: 'Daily fine rate', value: settingsLoading || settingsError ? '—' : settings?.fine_per_day == null ? 'Not set' : currency(settings.fine_per_day), icon: Receipt, note: 'Per overdue day' },
        ].map(({ label, value, icon: Icon, note }) => (
          <Card key={label} className="loan-desk-stat">
            <div className="loan-desk-stat-heading"><p>{label}</p><div className="loan-desk-stat-icon"><Icon size={20} /></div></div>
            <strong>{value}</strong>
            <small>{note}</small>
          </Card>
        ))}
      </div>
      <div className="loan-desk-settings-grid">
        <Card className="loan-desk-settings-card"><div className="loan-desk-section-heading"><Wallet size={20} /><div><h2>Overdue fine rate</h2><p>Set the amount charged per overdue day.</p></div></div>
          {settingsLoading ? <Skeleton className="h-24" /> : settingsError ? <div className="borrowing-error" role="alert"><p>{settingsError}</p><Button variant="secondary" onClick={fetchSettings}>Try again</Button></div> : <form className="loan-desk-fine-form" onSubmit={saveFine}>
            <label htmlFor="loan-desk-fine">Fine per day (PHP)</label><div><div className="loan-desk-money-input"><span aria-hidden="true">₱</span><input id="loan-desk-fine" className="input" type="number" min="0" max="1000" step="0.01" required value={fineInput} onChange={(event) => setFineInput(event.target.value)} aria-describedby="loan-desk-fine-help" disabled={!!action} /></div><Button type="submit" loading={action === 'settings'} disabled={!!action || fineInput.trim() === '' || (settings?.fine_per_day != null && Number(fineInput) === Number(settings.fine_per_day))}><Save size={16} /> Save rate</Button></div>
            <p id="loan-desk-fine-help">Enter 0 to disable overdue fines. Maximum: ₱1,000 per day.</p>
          </form>}
        </Card>
        <Card className="loan-desk-rules-card"><div className="loan-desk-section-heading"><BookOpen size={20} /><div><h2>Current loan rules</h2><p>Use these limits when reviewing requests.</p></div></div>
          {settingsLoading ? <Skeleton className="h-24" /> : settings ? <dl className="loan-desk-rules">
            <div><dt><Calendar size={15} /> Loan period</dt><dd>{settings.loan_days} days</dd></div><div><dt><BookOpen size={15} /> Active loans per student</dt><dd>{settings.max_active_loans} maximum</dd></div><div><dt><RotateCcw size={15} /> Renewals per loan</dt><dd>{settings.max_renewals} maximum</dd></div><div><dt><Clock size={15} /> Renewal extension</dt><dd>+{settings.renewal_days} day{settings.renewal_days === 1 ? '' : 's'}</dd></div>
          </dl> : <p className="loan-desk-rules-error">Loan rules are temporarily unavailable.</p>}
        </Card>
      </div>
      {queueError && <div className="borrowing-error loan-desk-error" role="alert"><AlertCircle size={18} /><p>{queueError}</p><Button variant="secondary" onClick={fetchQueues}>Try again</Button></div>}
      <Card className="borrowing-table-card"><div className="borrowing-table-heading"><div><h2><RotateCcw size={18} /> Renewal requests</h2><p>Review students requesting more time with a book.</p></div><span>{!loading && !queueError ? `${renewalTotal} pending` : 'Checking requests'}</span></div>
        {loading || queueError || renewals.length === 0 ? queuePlaceholder('renewals') : <div className="borrowing-table-scroll" role="region" tabIndex={0} aria-label="Renewal requests"><table className="borrowing-table loan-desk-table"><caption className="sr-only">Student loan renewal requests</caption><thead><tr>{['Student', 'Book', 'Current due date', 'Renewals used', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{renewals.map((transaction) => <tr key={transaction.id}><td><p className="borrowing-cell-title">{transaction.student?.name}</p><p>{transaction.student?.school_id}</p></td><td><p className="borrowing-cell-title">{transaction.book?.title}</p><p>{transaction.book?.author}</p></td><td>{transaction.due_date ? formatDate(transaction.due_date) : 'Not set'}</td><td>{transaction.renewal_count ?? 0}{settings ? ` of ${settings.max_renewals}` : ''}</td><td><div className="borrowing-row-actions"><Button size="sm" disabled={!!action} onClick={() => setDialog({ kind: 'renew', transaction })}><CheckCircle size={15} /> Approve renewal</Button><Button size="sm" variant="secondary" disabled={!!action} onClick={() => setDialog({ kind: 'renew-reject', transaction })}><X size={15} /> Decline</Button></div></td></tr>)}</tbody></table></div>}
        {!queueError && pagination(renewalPage, renewalTotal, setRenewalPage, 'requests')}
      </Card>
      <Card className="borrowing-table-card"><div className="borrowing-table-heading"><div><h2><Wallet size={18} /> Unpaid fines</h2><p>Record payment after collecting the outstanding amount.</p></div><span>{!loading && !queueError ? `${fineTotal} unpaid` : 'Checking fines'}</span></div>
        {loading || queueError || fines.length === 0 ? queuePlaceholder('fines') : <div className="borrowing-table-scroll" role="region" tabIndex={0} aria-label="Unpaid fines"><table className="borrowing-table loan-desk-table"><caption className="sr-only">Unpaid student fines and payment actions</caption><thead><tr>{['Student', 'Book', 'Return date', 'Fine amount', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{fines.map((transaction) => <tr key={transaction.id}><td><p className="borrowing-cell-title">{transaction.student?.name}</p><p>{transaction.student?.school_id}</p></td><td><p className="borrowing-cell-title">{transaction.book?.title}</p><p>{transaction.book?.author}</p></td><td>{transaction.return_date ? formatDate(transaction.return_date) : 'Not recorded'}</td><td><strong className="loan-desk-fine-amount">{currency(transaction.fine_amount)}</strong></td><td><Button size="sm" disabled={!!action} onClick={() => setDialog({ kind: 'fine-paid', transaction })}><Receipt size={15} /> Mark as paid</Button></td></tr>)}</tbody></table></div>}
        {!queueError && pagination(finePage, fineTotal, setFinePage, 'unpaid fines')}
      </Card>
      <Modal isOpen={!!dialog} className="borrowing-action-modal" title={{ renew: 'Approve renewal', 'renew-reject': 'Decline renewal', 'fine-paid': 'Record fine payment' }[dialog?.kind]} onClose={() => { if (!action) setDialog(null); }}>
        {dialog && <form onSubmit={submitAction}><div className="borrowing-dialog-context"><BookOpen size={21} /><div><strong>{dialog.transaction.book?.title}</strong><p>{dialog.transaction.student?.name} · {dialog.transaction.student?.school_id}</p></div></div>
          <p className="borrowing-dialog-help">{dialog.kind === 'fine-paid' ? <>Confirm that you have received <strong>{currency(dialog.transaction.fine_amount)}</strong> from this student. The fine will be marked as paid.</> : dialog.kind === 'renew' ? <>Approve this request to extend the loan{settings ? ` by ${settings.renewal_days} day${settings.renewal_days === 1 ? '' : 's'}` : ' using the library renewal period'}. The student will be notified.</> : 'Decline this renewal request. The student will be notified to return the book by the current due date.'}</p>
          <div className="borrowing-dialog-actions"><Button variant="secondary" disabled={!!action} onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" loading={!!action} variant={dialog.kind === 'renew-reject' ? 'danger' : 'primary'}>{dialog.kind === 'fine-paid' ? 'Confirm payment received' : dialog.kind === 'renew' ? 'Approve renewal' : 'Decline renewal'}</Button></div>
        </form>}
      </Modal>
    </div>
  );
}

export default LoanDeskPage;