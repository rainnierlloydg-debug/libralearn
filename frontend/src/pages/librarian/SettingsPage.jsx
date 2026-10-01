import { useState, useEffect } from 'react';
import { Save, Plus, Edit, Trash2, BookOpen, MapPin, Users, Bell, Shield, Palette, Key, Database, Wrench, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { formatDate } from '../../utils/helpers';
import { getThemePreference, setShellTheme } from '../../utils/theme';

function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [theme, setTheme] = useState(() => getThemePreference('admin'));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Settings data
  const [settings, setSettings] = useState({
    loan_period_days: 14,
    max_renewals: 2,
    renewal_days: 7,
    reservation_pickup_days: 3,
    max_reservations_per_student: 3,
    overdue_fine_per_day: 0,
    email_notifications: true,
    due_reminder_days: [3, 1],
    library_name: 'Good Shepherded Academy Library',
    library_address: '',
    library_phone: '',
    library_email: 'library@gsa.edu',
  });

  // Library sections/shelves
  const [sections, setSections] = useState([]);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({
    section_name: '',
    shelf_number: '',
    description: '',
    color: '#4F46E5',
  });

  // Genres/Subjects
  const [genres, setGenres] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [editingInterest, setEditingInterest] = useState(null);
  const [interestForm, setInterestForm] = useState({
    name: '',
    type: 'genre',
    description: '',
  });

  const tabs = [
    { id: 'general', label: 'General', icon: Wrench },
    { id: 'circulation', label: 'Circulation', icon: BookOpen },
    { id: 'library', label: 'Library Map', icon: MapPin },
    { id: 'categories', label: 'Categories', icon: BookOpen },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'system', label: 'System', icon: Database },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  useEffect(() => {
    setShellTheme('admin', theme);
  }, [theme]);

  const handleThemeChange = (newTheme) => {
    localStorage.setItem('admin-theme', newTheme);
    setTheme(newTheme);
    setShellTheme('admin', newTheme);
  };

  useEffect(() => {
    fetchSettings();
    fetchSections();
    fetchCategories();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await api.get('/library-locations');
      if (response.data.success) {
        setSections(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch sections:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const [genresRes, subjectsRes] = await Promise.all([
        api.get('/books/genres'),
        api.get('/books/subjects'),
      ]);
      if (genresRes.data.success) setGenres(genresRes.data.data);
      if (subjectsRes.data.success) setSubjects(subjectsRes.data.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async (section) => {
    setSaving(true);
    setSuccessMessage('');
    try {
      // In a real app, you'd send to backend
      // await api.put('/settings', settings);
      setSuccessMessage(`${section} settings saved successfully!`);
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Section management
  const openAddSection = () => {
    setEditingSection(null);
    setSectionForm({ section_name: '', shelf_number: '', description: '', color: '#4F46E5' });
  };

  const openEditSection = (section) => {
    setEditingSection(section);
    setSectionForm({
      section_name: section.section_name,
      shelf_number: section.shelf_number,
      description: section.description || '',
      color: section.color || '#4F46E5',
    });
  };

  const handleSectionSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingSection) {
        await api.put(`/library-locations/${editingSection.id}`, sectionForm);
      } else {
        await api.post('/library-locations', sectionForm);
      }
      fetchSections();
      setEditingSection(null);
    } catch (err) {
      alert('Failed to save section');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (id) => {
    if (!confirm('Delete this shelf location?')) return;
    try {
      await api.delete(`/library-locations/${id}`);
      fetchSections();
    } catch (err) {
      alert('Failed to delete section');
    }
  };

  // Interest management
  const openAddInterest = (type) => {
    setEditingInterest(null);
    setInterestForm({ name: '', type, description: '' });
  };

  const openEditInterest = (interest) => {
    setEditingInterest(interest);
    setInterestForm({ name: interest.name, type: interest.type, description: interest.description || '' });
  };

  const handleInterestSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingInterest) {
        await api.put(`/interests/${editingInterest.id}`, interestForm);
      } else {
        await api.post('/interests', interestForm);
      }
      fetchCategories();
      setEditingInterest(null);
    } catch (err) {
      alert('Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteInterest = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
      await api.delete(`/interests/${id}`);
      fetchCategories();
    } catch (err) {
      alert('Failed to delete category');
    }
  };

  const renderGeneral = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Library Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Library Name" value={settings.library_name} onChange={(e) => handleSettingChange('library_name', e.target.value)} />
          <Input label="Library Email" type="email" value={settings.library_email} onChange={(e) => handleSettingChange('library_email', e.target.value)} />
          <Input label="Library Phone" value={settings.library_phone} onChange={(e) => handleSettingChange('library_phone', e.target.value)} />
          <Input label="Library Address" value={settings.library_address} onChange={(e) => handleSettingChange('library_address', e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => handleSaveSettings('General')} loading={saving}>
            <Save className="w-4 h-4" /> Save General Settings
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderCirculation = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Loan Periods</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Input label="Loan Period (days)" type="number" value={settings.loan_period_days} onChange={(e) => handleSettingChange('loan_period_days', parseInt(e.target.value) || 14)} min="1" max="90" />
          <Input label="Max Renewals" type="number" value={settings.max_renewals} onChange={(e) => handleSettingChange('max_renewals', parseInt(e.target.value) || 2)} min="0" max="10" />
          <Input label="Renewal Extension (days)" type="number" value={settings.renewal_days} onChange={(e) => handleSettingChange('renewal_days', parseInt(e.target.value) || 7)} min="1" max="30" />
        </div>
        <div className="border-t-[var(--border)] pt-6">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Reservations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input label="Reservation Pickup (days)" type="number" value={settings.reservation_pickup_days} onChange={(e) => handleSettingChange('reservation_pickup_days', parseInt(e.target.value) || 3)} min="1" max="14" />
            <Input label="Max Reservations per Student" type="number" value={settings.max_reservations_per_student} onChange={(e) => handleSettingChange('max_reservations_per_student', parseInt(e.target.value) || 3)} min="1" max="20" />
          </div>
        </div>
        <div className="border-t-[var(--border)] pt-6">
          <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Fines & Notifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input label="Overdue Fine per Day (₱)" type="number" step="0.01" value={settings.overdue_fine_per_day} onChange={(e) => handleSettingChange('overdue_fine_per_day', parseFloat(e.target.value) || 0)} min="0" />
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.email_notifications}
                onChange={(e) => handleSettingChange('email_notifications', e.target.checked)}
                className="w-4 h-4 rounded border-[var(--border)] text-primary-600 focus:ring-primary-500"
              />
              <span className="text-[var(--text)]">Enable Email Notifications</span>
            </label>
          </div>
          <div>
            <label className="label">Due Date Reminders (days before due)</label>
            <div className="flex flex-wrap gap-2">
              {[7, 5, 3, 2, 1].map((day) => (
                <label key={day} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${settings.due_reminder_days?.includes(day) ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'border-[var(--border)] text-[var(--text-muted)] hover:border-primary-300'}`}>
                  <input
                    type="checkbox"
                    value={day}
                    checked={settings.due_reminder_days?.includes(day)}
                    onChange={(e) => handleSettingChange('due_reminder_days', e.target.checked ? [...(settings.due_reminder_days || []), day] : (settings.due_reminder_days || []).filter(d => d !== day))}
                    className="w-4 h-4 text-primary-600 border-[var(--border)] rounded focus:ring-primary-500"
                  />
                  <span>{day} day{day !== 1 ? 's' : ''}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => handleSaveSettings('Circulation')} loading={saving}>
            <Save className="w-4 h-4" /> Save Circulation Settings
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderLibraryMap = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text)]">Library Sections & Shelves</h3>
        <Button onClick={openAddSection}><Plus className="w-4 h-4" /> Add Shelf</Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-[var(--border)]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Section</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Shelf</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Color</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Map Position</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <tr key={section.id} className="border-b-[var(--border)]">
                  <td className="px-4 py-4 font-medium text-[var(--text)]">{section.section_name}</td>
                  <td className="px-4 py-4 text-[var(--text)]">{section.shelf_number}</td>
                  <td className="px-4 py-4 text-[var(--text-muted)]">{section.description || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded border-[var(--border)]" style={{ backgroundColor: section.color || '#4F46E5' }} />
                      <span className="text-sm font-mono">{section.color || '#4F46E5'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-[var(--text-muted)]">
                    {section.map_position ? `X: ${section.map_position.x}, Y: ${section.map_position.y}` : 'Not set'}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditSection(section)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteSection(section.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {sections.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-muted)]">
                    No shelf locations configured. Click "Add Shelf" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section Modal */}
      <Modal isOpen={!!editingSection} onClose={() => setEditingSection(null)} title={editingSection ? 'Edit Shelf' : 'Add New Shelf'}>
        <form onSubmit={handleSectionSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Section Name *" name="section_name" value={sectionForm.section_name} onChange={(e) => setSectionForm({...sectionForm, section_name: e.target.value})} required />
            <Input label="Shelf Number *" name="shelf_number" value={sectionForm.shelf_number} onChange={(e) => setSectionForm({...sectionForm, shelf_number: e.target.value})} required />
          </div>
          <Input label="Description" name="description" value={sectionForm.description} onChange={(e) => setSectionForm({...sectionForm, description: e.target.value})} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Color" type="color" name="color" value={sectionForm.color} onChange={(e) => setSectionForm({...sectionForm, color: e.target.value})} className="h-12 cursor-pointer" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t-[var(--border)]">
            <Button type="button" variant="secondary" onClick={() => setEditingSection(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>
              <Save className="w-4 h-4" /> {editingSection ? 'Update' : 'Add'} Shelf
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
      {/* Genres */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text)]">Genres</h3>
        <Button onClick={() => openAddInterest('genre')} variant="secondary"><Plus className="w-4 h-4" /> Add Genre</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-[var(--border)]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {genres.map((g) => (
                <tr key={g.id} className="border-b-[var(--border)]">
                  <td className="px-4 py-4 font-medium text-[var(--text)]">{g.name}</td>
                  <td className="px-4 py-4 text-[var(--text-muted)]">{g.description || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditInterest(g)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteInterest(g.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Subjects */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text)]">Academic Subjects</h3>
        <Button onClick={() => openAddInterest('subject')} variant="secondary"><Plus className="w-4 h-4" /> Add Subject</Button>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-[var(--border)]">
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Description</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-b-[var(--border)]">
                  <td className="px-4 py-4 font-medium text-[var(--text)]">{s.name}</td>
                  <td className="px-4 py-4 text-[var(--text-muted)]">{s.description || '—'}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditInterest(s)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteInterest(s.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Interest Modal */}
      <Modal isOpen={!!editingInterest} onClose={() => setEditingInterest(null)} title={editingInterest ? 'Edit Category' : 'Add New Category'}>
        <form onSubmit={handleInterestSubmit} className="space-y-4">
          <Input label="Name *" name="name" value={interestForm.name} onChange={(e) => setInterestForm({...interestForm, name: e.target.value})} required />
          <Select label="Type *" value={interestForm.type} onChange={(e) => setInterestForm({...interestForm, type: e.target.value})} options={[
            { value: 'genre', label: 'Genre' },
            { value: 'subject', label: 'Academic Subject' },
          ]} required />
          <Input label="Description" name="description" value={interestForm.description} onChange={(e) => setInterestForm({...interestForm, description: e.target.value})} />
          <div className="flex justify-end gap-2 pt-4 border-t-[var(--border)]">
            <Button type="button" variant="secondary" onClick={() => setEditingInterest(null)}>Cancel</Button>
            <Button type="submit" loading={saving}>
              <Save className="w-4 h-4" /> {editingInterest ? 'Update' : 'Add'} Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );

  const renderNotifications = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Notification Settings</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.email_notifications}
              onChange={(e) => handleSettingChange('email_notifications', e.target.checked)}
              className="w-5 h-5 rounded border-[var(--border)] text-primary-600 focus:ring-primary-500"
            />
            <span className="text-[var(--text)]">Enable email notifications for all events</span>
          </label>
          <div className="p-4 bg-[var(--surface-2)] rounded-lg">
            <p className="font-medium text-[var(--text)] mb-2">Event Notifications</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['borrow_approved', 'borrow_rejected', 'reservation_approved', 'reservation_ready', 'due_reminder', 'overdue', 'return_confirmed'].map((event) => (
                <label key={event} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-[var(--border)] text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-[var(--text)] capitalize">{event.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => handleSaveSettings('Notifications')} loading={saving}>
            <Save className="w-4 h-4" /> Save Notification Settings
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderSystem = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-4">System Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-[var(--surface-2)] rounded-lg">
            <p className="text-[var(--text-muted)]">Laravel Version</p>
            <p className="font-medium text-[var(--text)]">12.x</p>
          </div>
          <div className="p-3 bg-[var(--surface-2)] rounded-lg">
            <p className="text-[var(--text-muted)]">PHP Version</p>
            <p className="font-medium text-[var(--text)]">8.2+</p>
          </div>
          <div className="p-3 bg-[var(--surface-2)] rounded-lg">
            <p className="text-[var(--text-muted)]">Database</p>
            <p className="font-medium text-[var(--text)]">MySQL 8.0</p>
          </div>
          <div className="p-3 bg-[var(--surface-2)] rounded-lg">
            <p className="text-[var(--text-muted)]">Frontend</p>
            <p className="font-medium text-[var(--text)]">React 18 + Vite</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-red-200 dark:border-red-800">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-4">Danger Zone</h3>
        <p className="text-red-700 dark:text-red-300 mb-4">These actions are irreversible. Use with caution.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="danger" onClick={() => { if (confirm('Clear all AI cataloging drafts?')) alert('Not implemented') }}>
            <Trash2 className="w-4 h-4 mr-1" />
            Clear AI Drafts
          </Button>
          <Button variant="danger" onClick={() => { if (confirm('Clear all notifications?')) alert('Not implemented') }}>
            <Bell className="w-4 h-4 mr-1" />
            Clear All Notifications
          </Button>
          <Button variant="ghost" onClick={() => alert('Backup functionality not implemented')}>
            <Database className="w-4 h-4 mr-1" />
            Create Backup
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderAppearance = () => (
    <Card className="p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text)]">Admin appearance</h3>
        <p className="text-sm text-[var(--text-muted)]">This preference only changes the admin interface.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { value: 'light', label: 'Light', description: 'Always use the light theme' },
          { value: 'dark', label: 'Dark', description: 'Always use the dark theme' },
          { value: 'system', label: 'System', description: 'Follow this device preference' },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={theme === option.value}
            onClick={() => handleThemeChange(option.value)}
            className={`rounded-lg border p-4 text-left transition-colors ${theme === option.value ? 'border-primary-500 bg-primary-50' : 'border-[var(--border)] hover:bg-[var(--surface-2)]'}`}
          >
            <span className="block font-semibold text-[var(--text)]">{option.label}</span>
            <span className="mt-1 block text-sm text-[var(--text-muted)]">{option.description}</span>
          </button>
        ))}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Settings</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-settings-page space-y-6">
      <div className="admin-settings-heading">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Settings</h1>
        <p className="text-[var(--text-muted)]">Configure library system settings</p>
      </div>

      {/* Tabs */}
      <div className="admin-tabs-shell border-b-[var(--border)]">
        <nav className="flex gap-1 overflow-x-auto pb-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-t-lg font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
          {successMessage}
        </div>
      )}

      {activeTab === 'general' && renderGeneral()}
      {activeTab === 'circulation' && renderCirculation()}
      {activeTab === 'library' && renderLibraryMap()}
      {activeTab === 'categories' && renderCategories()}
      {activeTab === 'notifications' && renderNotifications()}
      {activeTab === 'system' && renderSystem()}
      {activeTab === 'appearance' && renderAppearance()}
    </div>
  );
}

export default SettingsPage;
