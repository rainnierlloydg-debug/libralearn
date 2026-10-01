import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

// Plain functional page: fine setting, renewal requests, unpaid fines.
function LoanDeskPage() {
  const [settings, setSettings] = useState(null);
  const [fineInput, setFineInput] = useState('');
  const [renewals, setRenewals] = useState([]);
  const [fines, setFines] = useState([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const [settingsRes, renewalsRes, finesRes] = await Promise.all([
      api.get('/library-settings'),
      api.get('/borrow?renewal_requested=1&per_page=100'),
      api.get('/borrow?fine_unpaid=1&per_page=100'),
    ]);
    setSettings(settingsRes.data.data);
    setFineInput(String(settingsRes.data.data.fine_per_day));
    setRenewals(renewalsRes.data.data.data);
    setFines(finesRes.data.data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (request, okMessage) => {
    setMessage('');
    try {
      await request();
      setMessage(okMessage);
      load();
    } catch (err) {
      const errors = err.response?.data?.errors;
      setMessage(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'Request failed.');
    }
  };

  if (!settings) return <p>Loading...</p>;

  return (
    <div>
      <h1>Loan Desk</h1>
      {message && <p>{message}</p>}

      <h2>Fine setting</h2>
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.put('/library-settings', { fine_per_day: fineInput }), 'Fine saved.'); }}>
        <Input label="Fine per overdue day (PHP)" type="number" min="0" step="0.01" value={fineInput} onChange={(e) => setFineInput(e.target.value)} />
        <Button type="submit">Save</Button>
      </form>
      <p>
        Loan rules: {settings.loan_days}-day loans, max {settings.max_active_loans} active loans per student,
        {' '}{settings.max_renewals} renewal per loan (+{settings.renewal_days} day).
      </p>

      <h2>Renewal requests</h2>
      {renewals.length === 0 ? <p>None.</p> : (
        <table>
          <thead><tr><th>Student</th><th>Book</th><th>Due</th><th>Renewals used</th><th></th></tr></thead>
          <tbody>
            {renewals.map((t) => (
              <tr key={t.id}>
                <td>{t.student?.name}</td>
                <td>{t.book?.title}</td>
                <td>{t.due_date?.slice(0, 10)}</td>
                <td>{t.renewal_count}</td>
                <td>
                  <Button size="sm" onClick={() => run(() => api.post(`/borrow/${t.id}/renew`), 'Renewal approved.')}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => run(() => api.post(`/borrow/${t.id}/renew-reject`), 'Renewal declined.')}>Decline</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Unpaid fines</h2>
      {fines.length === 0 ? <p>None.</p> : (
        <table>
          <thead><tr><th>Student</th><th>Book</th><th>Returned</th><th>Fine (PHP)</th><th></th></tr></thead>
          <tbody>
            {fines.map((t) => (
              <tr key={t.id}>
                <td>{t.student?.name}</td>
                <td>{t.book?.title}</td>
                <td>{t.return_date?.slice(0, 10)}</td>
                <td>{t.fine_amount}</td>
                <td><Button size="sm" onClick={() => run(() => api.post(`/borrow/${t.id}/fine-paid`), 'Fine marked paid.')}>Mark paid</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default LoanDeskPage;
