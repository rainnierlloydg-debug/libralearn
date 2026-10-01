import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, BookOpen, Bookmark, History, MapPin, Bell, User, LayoutDashboard, Book, Sparkles, Users, Clock, BookmarkCheck, RotateCcw, BarChart, Settings, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

function StudentSidebar({ collapsed = false, mobileOpen = false, onClose, onToggle }) {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/recommendations', label: 'Recommendations', icon: Compass },
    { path: '/my-books', label: 'My Books', icon: BookOpen },
    { path: '/saved-books', label: 'Saved Books', icon: Bookmark },
    { path: '/online-search', label: 'Online Search', icon: Compass },
    { path: '/notifications', label: 'Notifications', icon: Bell },
    { path: '/profile', label: 'Profile', icon: User },
    { path: '/library-map', label: 'Library Map', icon: MapPin },
  ];

  return (
    <aside className={`student-sidebar fixed left-0 top-16 bottom-0 z-30 bg-[var(--surface)] border-r-[var(--border)] transition-all duration-300 ${collapsed ? 'is-collapsed w-16' : 'w-64'} ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <nav className="h-full flex flex-col p-3" aria-label="Main navigation">
        <ul className="flex-1 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={onClose}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed && (
          <div className="border-t-[var(--border)] pt-3">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-[var(--text-muted)]">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)] truncate">{user?.name}</p>
                <p className="text-xs text-[var(--text-faint)] truncate">{user?.school_id}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onToggle}
          className={`student-nav-toggle flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors ${
            collapsed ? 'mx-auto' : ''
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </nav>
    </aside>
  );
}

function LibrarianSidebar({ collapsed = false, mobileOpen = false, onClose, onToggle }) {
  const location = useLocation();

  const navSections = [
    {
      title: 'Overview',
      items: [
        { path: '/librarian/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Catalog',
      items: [
        { path: '/librarian/books', label: 'Books', icon: Book },
        { path: '/librarian/ai-catalog', label: 'AI Cataloging', icon: Sparkles },
      ],
    },
    {
      title: 'Circulation',
      items: [
        { path: '/librarian/borrowing', label: 'Borrowing', icon: Clock },
        { path: '/librarian/reservations', label: 'Reservations', icon: BookmarkCheck },
        { path: '/librarian/returns', label: 'Returns', icon: RotateCcw },
      ],
    },
    {
      title: 'People',
      items: [
        { path: '/librarian/students', label: 'Students', icon: Users },
      ],
    },
    {
      title: 'Insights',
      items: [
        { path: '/librarian/reports', label: 'Reports', icon: BarChart },
      ],
    },
    {
      title: 'System',
      items: [
        { path: '/librarian/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className={`admin-sidebar fixed left-0 top-16 bottom-0 z-30 bg-[var(--surface)] border-r-[var(--border)] transition-all duration-300 ${collapsed ? 'is-collapsed w-16' : 'w-64'} ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <nav id="admin-navigation" className="admin-side-nav h-full flex flex-col p-3 overflow-y-auto" aria-label="Admin navigation">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="admin-side-section mb-4">
            {(!collapsed || mobileOpen) && (
              <h3 className="admin-side-title px-3 py-1.5 text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                {section.title}
              </h3>
            )}
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`admin-nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'is-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={onClose}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      {(!collapsed || mobileOpen) && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-auto pt-4 border-t-[var(--border)]">
          <button
            onClick={onToggle}
            className={`admin-nav-toggle flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors ${collapsed ? 'mx-auto' : ''}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </nav>
    </aside>
  );
}

export { StudentSidebar, LibrarianSidebar };
