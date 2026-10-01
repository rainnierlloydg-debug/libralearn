import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import StudentDashboard from './pages/student/Dashboard';
import SearchLibraryPage from './pages/student/SearchLibraryPage';
import BookDetailPage from './pages/student/BookDetailPage';
import RecommendationsPage from './pages/student/RecommendationsPage';
import MyBooksPage from './pages/student/MyBooksPage';
import SavedBooksPage from './pages/student/SavedBooksPage';
import OnlineSearchPage from './pages/student/OnlineSearchPage';
import NotificationsPage from './pages/student/NotificationsPage';
import ProfilePage from './pages/student/ProfilePage';
import LibraryMapPage from './pages/student/LibraryMapPage';
import LibrarianDashboard from './pages/librarian/Dashboard';
import LibrarianBooksPage from './pages/librarian/BooksPage';
import LibrarianAiCatalogPage from './pages/librarian/AiCatalogPage';
import LibrarianStudentsPage from './pages/librarian/StudentsPage';
import LibrarianBorrowingPage from './pages/librarian/BorrowingPage';
import LibrarianReservationsPage from './pages/librarian/ReservationsPage';
import LibrarianReturnsPage from './pages/librarian/ReturnsPage';
import LibrarianReportsPage from './pages/librarian/ReportsPage';
import LibrarianSettingsPage from './pages/librarian/SettingsPage';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/librarian/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected student routes */}
            <Route element={
              <ProtectedRoute allowedRoles={['student']}>
                <Layout role="student" />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<StudentDashboard />} />
              <Route path="/search" element={<SearchLibraryPage />} />
              <Route path="/books/:id" element={<BookDetailPage />} />
              <Route path="/recommendations" element={<RecommendationsPage />} />
              <Route path="/my-books" element={<MyBooksPage />} />
              <Route path="/saved-books" element={<SavedBooksPage />} />
              <Route path="/online-search" element={<OnlineSearchPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/library-map" element={<LibraryMapPage />} />
            </Route>

            {/* Protected librarian routes */}
            <Route element={
              <ProtectedRoute allowedRoles={['librarian', 'admin']}>
                <Layout role="librarian" />
              </ProtectedRoute>
            }>
              <Route path="/librarian/dashboard" element={<LibrarianDashboard />} />
              <Route path="/librarian/books" element={<LibrarianBooksPage />} />
              <Route path="/librarian/ai-catalog" element={<LibrarianAiCatalogPage />} />
              <Route path="/librarian/students" element={<LibrarianStudentsPage />} />
              <Route path="/librarian/borrowing" element={<LibrarianBorrowingPage />} />
              <Route path="/librarian/reservations" element={<LibrarianReservationsPage />} />
              <Route path="/librarian/returns" element={<LibrarianReturnsPage />} />
              <Route path="/librarian/reports" element={<LibrarianReportsPage />} />
              <Route path="/librarian/settings" element={<LibrarianSettingsPage />} />
            </Route>

            {/* Redirect unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
