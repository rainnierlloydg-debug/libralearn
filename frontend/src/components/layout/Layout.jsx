import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { StudentHeader, LibrarianHeader } from './Header';
import { StudentSidebar, LibrarianSidebar } from './Sidebar';
import StudentAssistant from './StudentAssistant';
import { getThemePreference, setShellTheme } from '../../utils/theme';

function Layout({ role }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const syncTheme = () => setShellTheme(role, getThemePreference(role));
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

    syncTheme();
    colorScheme.addEventListener('change', syncTheme);
    return () => colorScheme.removeEventListener('change', syncTheme);
  }, [role]);

  if (role === 'student') {
    return (
      <div className="student-shell">
        <StudentHeader
          mobileMenuOpen={mobileSidebarOpen}
          onMobileMenuToggle={() => setMobileSidebarOpen((open) => !open)}
        />
        {mobileSidebarOpen && (
          <button
            type="button"
            className="student-sidebar-backdrop"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close student navigation"
          />
        )}
        <StudentSidebar
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
        />
        <main className={`student-main ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className="student-workspace">
            <Outlet />
          </div>
        </main>
        <StudentAssistant />
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <LibrarianHeader
        mobileMenuOpen={mobileSidebarOpen}
        onMobileMenuToggle={() => setMobileSidebarOpen((open) => !open)}
      />
      {mobileSidebarOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close admin navigation"
        />
      )}
      <LibrarianSidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
      <main className={`admin-main ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        <div className="admin-workspace">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
