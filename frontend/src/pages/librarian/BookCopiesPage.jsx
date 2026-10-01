import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

const STATUS_OPTIONS = ['available', 'lost', 'damaged', 'withdrawn'].map((s) => ({ value: s, label: s }));
const EMPTY_FORM = { accession_no: '', library_location_id: '', status: 'available', condition: 'good' };

// Plain functional page: list, add, and edit the physical copies of one book.
function BookCopiesPage() {
  const { id } = useParams();
  const [book, setBook] = useState(null);
  const [copies, setCopies] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await api.get(`/books/${id}/copies`);
    setBook(res.data.data.book);
    setCopies(res.data.data.copies);
  }, [id]);

  useEffect(() => {
    load();
    api.get('/library-locations').then((res) => setLocations(res.data.data ?? []));
  }, [load]);

  const locationOptions = [
    { value: '', label: '(same as book)' },
    ...locations.map((l) => ({ value: String(l.id), label: `${l.section_name} / ${l.shelf_number}` })),
  ];

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    const payload = { ...form, library_location_id: form.library_location_id || null };
    // Borrowed/reserved come from loans and holds; only condition and location are editable then.
    if (!STATUS_OPTIONS.some((o) => o.value === payload.status)) delete payload.status;
    try {
      if (editingId) {
        await api.put(`/book-copies/${editingId}`, payload);
      } else {
        await api.post(`/books/${id}/copies`, payload);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      setMessage('Saved.');
      load();
    } catch (err) {
      const errors = err.response?.data?.errors;
      setMessage(errors ? Object.values(errors).flat().join(' ') : err.response?.data?.message || 'Save failed.');
    }
  };

  const startEdit = (copy) => {
    setEditingId(copy.id);
    setForm({
      accession_no: copy.accession_no,
      library_location_id: copy.library_location_id ? String(copy.library_location_id) : '',
      status: copy.status,
      condition: copy.condition || '',
    });
  };

  if (!book) return <p>Loading...</p>;

  return (
    <div>
      <p><Link to="/librarian/books">Back to books</Link></p>
      <h1>Copies: {book.title}</h1>
      <p>{book.author} | Book status (from copies): {book.status}</p>

      <table>
        <thead>
          <tr><th>Accession no.</th><th>Status</th><th>Condition</th><th>Location</th><th></th></tr>
        </thead>
        <tbody>
          {copies.map((c) => (
            <tr key={c.id}>
              <td>{c.accession_no}</td>
              <td>{c.status}</td>
              <td>{c.condition}</td>
              <td>{c.library_location ? `${c.library_location.section_name} / ${c.library_location.shelf_number}` : ''}</td>
              <td><Button size="sm" variant="secondary" onClick={() => startEdit(c)}>Edit</Button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{editingId ? 'Edit copy' : 'Add copy'}</h2>
      <form onSubmit={submit}>
        <Input label="Accession no. (blank = auto)" value={form.accession_no} onChange={(e) => setForm({ ...form, accession_no: e.target.value })} />
        <Select label="Status" options={STATUS_OPTIONS} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
        <Input label="Condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })} />
        <Select label="Location" options={locationOptions} value={form.library_location_id} onChange={(e) => setForm({ ...form, library_location_id: e.target.value })} />
        <Button type="submit">{editingId ? 'Update copy' : 'Add copy'}</Button>
        {editingId && <Button variant="secondary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Cancel</Button>}
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

export default BookCopiesPage;
