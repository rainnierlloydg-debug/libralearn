import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Bell, User, Search, LogOut, BookOpen, Home, Compass, Bookmark, History, Settings, ChevronDown, Sparkles, BarChart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import SearchBar from '../ui/SearchBar';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';

function StudentHeader({ mobileMenuOpen = false, onMobileMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const profileMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await api.get('/notifications/unread-count');
        if (response.data.success) {
          setUnreadCount(response.data.data.unread_count);
        }
      } catch (err) {
        // Ignore
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--surface)] border-b-[var(--border)] shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and mobile menu */}
          <div className="flex items-center gap-4">
            <button
              className="md:hidden btn-ghost p-2"
              onClick={onMobileMenuToggle}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="student-navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Link to="/" className="flex items-center gap-2 font-heading font-bold text-xl text-primary-600">
              <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="6" fill="currentColor"/>
                <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="24" cy="8" r="3" fill="white"/>
              </svg>
              <span className="hidden sm:block">LibraLearn</span>
            </Link>
          </div>

          {/* Search bar - desktop */}
          <div className="hidden md:block flex-1 max-w-xl mx-4">
            <SearchBar
              placeholder="Search by title, author, subject, or ISBN..."
              onSearch={(query) => navigate(`/search?q=${encodeURIComponent(query)}`)}
            />
          </div>

          {/* Right side - notifications and profile */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative btn-ghost p-2"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[var(--surface)] border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--text)]">Notifications</h3>
                    <Button variant="ghost" size="sm" onClick={() => api.post('/notifications/read-all')}>
                      Mark all read
                    </Button>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <p className="p-4 text-center text-[var(--text-muted)]">Click to view all notifications</p>
                  </div>
                  <div className="p-3 border-t-[var(--border)]">
                    <Link to="/notifications" className="btn-primary w-full justify-center">View All</Link>
                  </div>
                </div>
              )}
            </div>

            {/* Profile menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 btn-ghost p-1.5 rounded-lg"
                aria-label="Profile menu"
                aria-expanded={profileMenuOpen}
              >
                <Avatar src={user?.profile_image} name={user?.name} size="sm" />
                <span className="hidden sm:block font-medium text-[var(--text)]">{user?.name}</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="p-3 border-b-[var(--border)]">
                    <p className="font-medium text-[var(--text)]">{user?.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">{user?.school_id}</p>
                    <p className="text-xs text-[var(--text-faint)]">{user?.grade_level} • {user?.section}</p>
                  </div>
                  <nav className="py-2">
                    <Link to="/profile" className="flex items-center gap-3 px-4 py-2 text-[var(--text)] hover:bg-[var(--surface-2)]">
                      <User className="w-5 h-5" />
                      Profile
                    </Link>
                    <Link to="/my-books" className="flex items-center gap-3 px-4 py-2 text-[var(--text)] hover:bg-[var(--surface-2)]">
                      <BookOpen className="w-5 h-5" />
                      My Books
                    </Link>
                    <Link to="/saved-books" className="flex items-center gap-3 px-4 py-2 text-[var(--text)] hover:bg-[var(--surface-2)]">
                      <Bookmark className="w-5 h-5" />
                      Saved Books
                    </Link>
                    <Link to="/notifications" className="flex items-center gap-3 px-4 py-2 text-[var(--text)] hover:bg-[var(--surface-2)]">
                      <Bell className="w-5 h-5" />
                      Notifications
                    </Link>
                  </nav>
                  <div className="border-t-[var(--border)] p-2">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}

function LibrarianHeader({ mobileMenuOpen = false, onMobileMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCounts, setPendingCounts] = useState({ borrows: 0, reservations: 0, returns: 0 });
  const profileMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [notifResponse, pendingResponse] = await Promise.all([
          api.get('/notifications/unread-count'),
          api.get('/dashboard/librarian'),
        ]);
        if (notifResponse.data.success) {
          setUnreadCount(notifResponse.data.data.unread_count);
        }
        if (pendingResponse.data.success) {
          setPendingCounts({
            borrows: pendingResponse.data.data.stats.pending_borrow_requests || 0,
            reservations: pendingResponse.data.data.stats.pending_reservations || 0,
            returns: pendingResponse.data.data.stats.pending_return_confirmations || 0,
          });
        }
      } catch (err) {
        // Ignore
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="admin-header sticky top-0 z-40 bg-[var(--surface)] border-b-[var(--border)] shadow-sm">
      <div className="admin-header-inner max-w-[1400px] mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden btn-ghost p-2"
              onClick={onMobileMenuToggle}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="admin-navigation"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Link to="/librarian/dashboard" className="flex items-center gap-2 font-heading font-bold text-xl text-primary-600">
              <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="32" height="32" rx="6" fill="currentColor"/>
                <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="24" cy="8" r="3" fill="white"/>
              </svg>
              <span>LibraLearn Admin</span>
            </Link>
          </div>

          <div className="hidden lg:block flex-1 max-w-2xl mx-4">
            <SearchBar
              placeholder="Search books, students..."
              onSearch={(query) => navigate(`/librarian/books?q=${encodeURIComponent(query)}`)}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative btn-ghost p-2"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[var(--surface)] border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="p-4 border-b-[var(--border)]">
                    <h3 className="font-semibold text-[var(--text)]">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <p className="p-4 text-center text-[var(--text-muted)]">Click to view all notifications</p>
                  </div>
                  <div className="p-3 border-t-[var(--border)]">
                    <Link to="/librarian/reports" className="btn-primary w-full justify-center">View All</Link>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 btn-ghost p-1.5 rounded-lg"
                aria-label="Profile menu"
              >
                <Avatar src={user?.profile_image} name={user?.name} size="sm" />
                <span className="hidden sm:block font-medium text-[var(--text)]">{user?.name}</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[var(--surface)] border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="p-3 border-b-[var(--border)]">
                    <p className="font-medium text-[var(--text)]">{user?.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">{user?.role === 'admin' ? 'Administrator' : 'Librarian'}</p>
                  </div>
                  <nav className="py-2">
                    <Link to="/librarian/settings" className="flex items-center gap-3 px-4 py-2 text-[var(--text)] hover:bg-[var(--surface-2)]">
                      <Settings className="w-5 h-5" />
                      Settings
                    </Link>
                  </nav>
                  <div className="border-t-[var(--border)] p-2">
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}

export { StudentHeader, LibrarianHeader };
