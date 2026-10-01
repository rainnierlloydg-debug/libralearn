import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Lock, Calendar, BookOpen, Heart, Bookmark, Eye, EyeOff, Camera, X, CheckCircle, AlertCircle, Settings, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { getThemePreference, setShellTheme } from '../../utils/theme';
import Avatar from '../../components/ui/Avatar';
import { formatDate } from '../../utils/helpers';

const GRADE_LEVELS = [
  'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10',
  'Grade 11 - STEM', 'Grade 11 - ABM', 'Grade 11 - HUMSS', 'Grade 11 - GAS',
  'Grade 12 - STEM', 'Grade 12 - ABM', 'Grade 12 - HUMSS', 'Grade 12 - GAS',
];

const SECTIONS = [
  'St. Joseph', 'St. Mary', 'St. Peter', 'St. Paul',
  'St. John', 'St. Matthew', 'St. Mark', 'St. Luke',
  'STEM-A', 'STEM-B', 'ABM-A', 'ABM-B', 'HUMSS-A', 'HUMSS-B', 'GAS-A', 'GAS-B',
];

const ALL_INTERESTS = [
  // Genres
  { id: 'genre-fiction', name: 'Fiction', type: 'genre' },
  { id: 'genre-fantasy', name: 'Fantasy', type: 'genre' },
  { id: 'genre-sci-fi', name: 'Science Fiction', type: 'genre' },
  { id: 'genre-mystery', name: 'Mystery', type: 'genre' },
  { id: 'genre-romance', name: 'Romance', type: 'genre' },
  { id: 'genre-adventure', name: 'Adventure', type: 'genre' },
  { id: 'genre-horror', name: 'Horror', type: 'genre' },
  { id: 'genre-thriller', name: 'Thriller', type: 'genre' },
  { id: 'genre-biography', name: 'Biography', type: 'genre' },
  { id: 'genre-poetry', name: 'Poetry', type: 'genre' },
  { id: 'genre-historical', name: 'Historical Fiction', type: 'genre' },
  { id: 'genre-graphic', name: 'Graphic Novels', type: 'genre' },
  { id: 'genre-ya', name: 'Young Adult', type: 'genre' },
  { id: 'genre-dystopian', name: 'Dystopian', type: 'genre' },
  // Subjects
  { id: 'subject-math', name: 'Mathematics', type: 'subject' },
  { id: 'subject-science', name: 'Science', type: 'subject' },
  { id: 'subject-english', name: 'English', type: 'subject' },
  { id: 'subject-filipino', name: 'Filipino', type: 'subject' },
  { id: 'subject-history', name: 'History', type: 'subject' },
  { id: 'subject-social', name: 'Social Studies', type: 'subject' },
  { id: 'subject-tech', name: 'Technology', type: 'subject' },
  { id: 'subject-arts', name: 'Arts', type: 'subject' },
  { id: 'subject-pe', name: 'Physical Education', type: 'subject' },
  { id: 'subject-values', name: 'Values Education', type: 'subject' },
];

function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [activity, setActivity] = useState({ history: [], saved: [], loading: false, loaded: false });

  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    grade_level: user?.grade_level || '',
    section: user?.section || '',
    current_password: '',
    new_password: '',
    confirm_password: '',
    interests: user?.interests?.map(i => i.id) || [],
    profile_image: user?.profile_image || '',
  });

  // Theme
  const [theme, setTheme] = useState('light');
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    const savedTheme = getThemePreference('student');
    setTheme(savedTheme);
    setShellTheme('student', savedTheme);
  }, []);

  useEffect(() => {
    if (activeTab !== 'activity' || activity.loaded || activity.loading) return;

    const fetchActivity = async () => {
      setActivity((prev) => ({ ...prev, loading: true }));
      try {
        const [historyResponse, dashboardResponse] = await Promise.all([
          api.get('/borrow?status=returned,rejected,lost,damaged'),
          api.get('/dashboard/student'),
        ]);
        setActivity({
          history: historyResponse.data.success ? historyResponse.data.data.data : [],
          saved: dashboardResponse.data.success ? dashboardResponse.data.data.saved_books || [] : [],
          loading: false,
          loaded: true,
        });
      } catch (err) {
        setActivity((prev) => ({ ...prev, loading: false, loaded: true }));
      }
    };

    fetchActivity();
  }, [activeTab, activity.loaded, activity.loading]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'interests') {
      if (checked) {
        setFormData((prev) => ({
          ...prev,
          interests: [...prev.interests, value],
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          interests: prev.interests.filter((id) => id !== value),
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setSuccessMessage('');
  };

  const validateProfile = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.grade_level) newErrors.grade_level = 'Grade level is required';
    if (!formData.section) newErrors.section = 'Section is required';
    if (formData.current_password || formData.new_password || formData.confirm_password) {
      if (!formData.current_password) newErrors.current_password = 'Current password is required';
      if (!formData.new_password) newErrors.new_password = 'New password is required';
      else if (formData.new_password.length < 8) newErrors.new_password = 'Password must be at least 8 characters';
      if (formData.new_password !== formData.confirm_password) newErrors.confirm_password = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;

    setSaving(true);
    setSuccessMessage('');
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        grade_level: formData.grade_level,
        section: formData.section,
        interests: formData.interests,
        profile_image: formData.profile_image,
      };
      if (formData.current_password) {
        payload.current_password = formData.current_password;
        payload.new_password = formData.new_password;
        payload.new_password_confirmation = formData.confirm_password;
      }
      const result = await updateProfile(payload);
      if (result.success) {
        setSuccessMessage('Profile updated successfully!');
        setFormData((prev) => ({ ...prev, current_password: '', new_password: '', confirm_password: '' }));
        setErrors({});
      } else {
        setErrors(result.errors || { general: result.message });
      }
    } catch (err) {
      setErrors({ general: 'An error occurred. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('student-theme', newTheme);
    setShellTheme('student', newTheme);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'interests', label: 'Interests', icon: Heart },
    { id: 'activity', label: 'Activity', icon: BookOpen },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'appearance', label: 'Appearance', icon: Settings },
  ];

  return (
    <div className="student-profile-page space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">Profile Settings</h1>
      </div>

      {/* Tabs */}
      <div className="student-profile-tabs border-b-[var(--border)]">
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

      {/* Tab content */}
      {activeTab === 'profile' && (
        <Card className="profile-main-card p-6 space-y-6">
          <div className="profile-form-layout">
            <div className="profile-identity">
              <Avatar src={formData.profile_image} name={formData.name} size="2xl" />
              <div>
                <strong>{formData.name || 'Student profile'}</strong>
                <span>{user?.school_id}</span>
              </div>
              <label className="profile-photo-button">
                <Camera className="w-4 h-4" />
                Change Photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => setFormData((prev) => ({ ...prev, profile_image: event.target.result }));
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
              {formData.profile_image && (
                <Button variant="ghost" size="sm" onClick={() => setFormData((prev) => ({ ...prev, profile_image: '' }))}>
                  <X className="w-4 h-4" />
                  Remove photo
                </Button>
              )}
            </div>
            <div className="profile-fields">
              <Input
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                error={errors.name}
                placeholder="Enter your full name"
                leftIcon={<User className="w-5 h-5" />}
              />
              <Input
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="student@gsa.edu"
                leftIcon={<Mail className="w-5 h-5" />}
              />
              <div className="profile-select-grid">
                <label className="profile-select-field">
                  <span>Grade level</span>
                  <select
                    name="grade_level"
                    value={formData.grade_level}
                    onChange={handleChange}
                    className={`input ${errors.grade_level ? 'input-error' : ''}`}
                  >
                    <option value="" disabled>Select grade level</option>
                    {GRADE_LEVELS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {errors.grade_level && <small>{errors.grade_level}</small>}
                </label>
                <label className="profile-select-field">
                  <span>Section</span>
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    className={`input ${errors.section ? 'input-error' : ''}`}
                  >
                    <option value="" disabled>Select section</option>
                    {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.section && <small>{errors.section}</small>}
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t-[var(--border)]">
            <Button onClick={handleSaveProfile} size="lg" loading={saving}>
              <CheckCircle className="w-4 h-4" />
              Save Changes
            </Button>
            {successMessage && <span className="ml-4 text-green-600">{successMessage}</span>}
            {errors.general && <p className="text-red-600 mt-2">{errors.general}</p>}
          </div>
        </Card>
      )}

      {activeTab === 'interests' && (
        <Card className="p-6 space-y-6">
          <p className="text-[var(--text-muted)]">
            Select your favorite genres and academic subjects to get better book recommendations.
            You can choose as many as you like, but we recommend at least 3.
          </p>

          <div>
            <h3 className="font-semibold text-[var(--text)] mb-3">Genres</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_INTERESTS.filter(i => i.type === 'genre').map((interest) => (
                <label
                  key={interest.id}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.interests.includes(interest.id)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-primary-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="interests"
                    value={interest.id}
                    checked={formData.interests.includes(interest.id)}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-600 border-[var(--border)] rounded focus:ring-primary-500"
                  />
                  <span>{interest.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-[var(--text)] mb-3">Academic Subjects</h3>
            <div className="flex flex-wrap gap-2">
              {ALL_INTERESTS.filter(i => i.type === 'subject').map((interest) => (
                <label
                  key={interest.id}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.interests.includes(interest.id)
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300'
                      : 'border-[var(--border)] text-[var(--text-muted)] hover:border-accent-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="interests"
                    value={interest.id}
                    checked={formData.interests.includes(interest.id)}
                    onChange={handleChange}
                    className="w-4 h-4 text-accent-600 border-[var(--border)] rounded focus:ring-accent-500"
                  />
                  <span>{interest.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)] mb-3">
              Selected: <strong>{formData.interests.length}</strong> interests
            </p>
            <Button onClick={handleSaveProfile} size="lg" loading={saving}>
              <CheckCircle className="w-4 h-4" />
              Save Interests
            </Button>
            {successMessage && <span className="ml-4 text-green-600">{successMessage}</span>}
          </div>
        </Card>
      )}

      {activeTab === 'activity' && (
        <div className="profile-activity-grid">
          <Card className="profile-activity-card">
            <div className="profile-section-heading">
              <div>
                <h3>Borrowing History</h3>
                <p>{activity.history.length} completed records</p>
              </div>
              <Link to="/my-books" className="btn btn-secondary btn-sm">Open My Books</Link>
            </div>
            {activity.loading ? <p className="profile-muted">Loading activity...</p> : activity.history.length > 0 ? (
              <div className="profile-activity-list">
                {activity.history.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="profile-activity-row">
                    <BookOpen className="w-4 h-4" />
                    <div>
                      <strong>{transaction.book?.title}</strong>
                      <span>{transaction.status} {transaction.return_date ? `• ${formatDate(transaction.return_date)}` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="profile-muted">No borrowing history yet.</p>}
          </Card>
          <Card className="profile-activity-card">
            <div className="profile-section-heading">
              <div>
                <h3>Saved Books</h3>
                <p>{activity.saved.length} saved for later</p>
              </div>
              <Link to="/saved-books" className="btn btn-secondary btn-sm">Open Saved Books</Link>
            </div>
            {activity.saved.length > 0 ? (
              <div className="profile-activity-list">
                {activity.saved.slice(0, 5).map((saved) => (
                  <div key={saved.book?.id || saved.id} className="profile-activity-row">
                    <Bookmark className="w-4 h-4" />
                    <div>
                      <strong>{saved.book?.title}</strong>
                      <span>{saved.book?.author}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="profile-muted">No saved books yet.</p>}
          </Card>
          <Card className="profile-activity-card profile-activity-note">
            <Heart className="w-5 h-5" />
            <div>
              <h3>Recommendations</h3>
              <p>Your interests and feedback help personalize the books shown on your Recommendations page.</p>
              <Link to="/recommendations" className="profile-inline-link">View recommendations</Link>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'security' && (
        <Card className="profile-security-card p-6 space-y-6">
          <div className="profile-security-heading">
            <div className="profile-security-icon"><Lock className="w-5 h-5" /></div>
            <div>
              <h3>Change Password</h3>
              <p>Use a strong password with at least 8 characters.</p>
            </div>
          </div>
          <div className="profile-security-fields">
            {[
              { label: 'Current Password', name: 'current_password', placeholder: 'Enter current password', error: errors.current_password },
              { label: 'New Password', name: 'new_password', placeholder: 'At least 8 characters', error: errors.new_password },
              { label: 'Confirm New Password', name: 'confirm_password', placeholder: 'Confirm new password', error: errors.confirm_password },
            ].map((field) => (
              <div key={field.name} className="profile-password-field">
                <Input
                  label={field.label}
                  name={field.name}
                  type={showPasswords ? 'text' : 'password'}
                  value={formData[field.name]}
                  onChange={handleChange}
                  error={field.error}
                  placeholder={field.placeholder}
                  leftIcon={<Lock className="w-5 h-5" />}
                />
              </div>
            ))}
          </div>
          <label className="profile-show-password">
            <input type="checkbox" checked={showPasswords} onChange={(e) => setShowPasswords(e.target.checked)} />
            <span>Show passwords</span>
          </label>
          <div className="profile-security-actions pt-4 border-t-[var(--border)]">
            <Button onClick={handleSaveProfile} size="lg" loading={saving}>
              <CheckCircle className="w-4 h-4" />
              Update Password
            </Button>
            {successMessage && <span className="ml-4 text-green-600">{successMessage}</span>}
            {errors.general && <p className="text-red-600 mt-2">{errors.general}</p>}
          </div>
        </Card>
      )}

      {activeTab === 'appearance' && (
        <Card className="p-6 space-y-6">
          <h3 className="font-semibold text-[var(--text)]">Theme</h3>
          <p className="text-[var(--text-muted)]">Choose your preferred color scheme.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['light', 'dark', 'system'].map((t) => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${theme === t ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-[var(--border)] hover:border-primary-300'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t === 'dark' ? 'bg-gray-800' : t === 'system' ? 'bg-gradient-to-br from-white to-gray-100' : 'bg-white'}`}>
                    {t === 'light' && <span className="text-2xl">☀️</span>}
                    {t === 'dark' && <span className="text-2xl">🌙</span>}
                    {t === 'system' && <span className="text-2xl">💻</span>}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text)] capitalize">{t}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {t === 'light' ? 'Always light' : t === 'dark' ? 'Always dark' : 'Match system'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default ProfilePage;
