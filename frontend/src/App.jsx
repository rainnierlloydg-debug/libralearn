import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/layout/Layout';
import LandingPage from './pages/LandingPage';
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const SearchLibraryPage = lazy(() => import('./pages/student/SearchLibraryPage'));
const BookDetailPage = lazy(() => import('./pages/student/BookDetailPage'));
const RecommendationsPage = lazy(() => import('./pages/student/RecommendationsPage'));
const MyBooksPage = lazy(() => import('./pages/student/MyBooksPage'));
const SavedBooksPage = lazy(() => import('./pages/student/SavedBooksPage'));
const OnlineSearchPage = lazy(() => import('./pages/student/OnlineSearchPage'));
const NotificationsPage = lazy(() => import('./pages/student/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/student/ProfilePage'));
const LibraryMapPage = lazy(() => import('./pages/student/LibraryMapPage'));
const LibrarianDashboard = lazy(() => import('./pages/librarian/Dashboard'));
const LibrarianBooksPage = lazy(() => import('./pages/librarian/BooksPage'));
const LibrarianAiCatalogPage = lazy(() => import('./pages/librarian/AiCatalogPage'));
const LibrarianStudentsPage = lazy(() => import('./pages/librarian/StudentsPage'));
const LibrarianBorrowingPage = lazy(() => import('./pages/librarian/BorrowingPage'));
const LibrarianLoanDeskPage = lazy(() => import('./pages/librarian/LoanDeskPage'));
const LibrarianReservationsPage = lazy(() => import('./pages/librarian/ReservationsPage'));
const LibrarianReturnsPage = lazy(() => import('./pages/librarian/ReturnsPage'));
const LibrarianReportsPage = lazy(() => import('./pages/librarian/ReportsPage'));
const LibrarianInsightsPage = lazy(() => import('./pages/librarian/InsightsPage'));
const LibrarianSettingsPage = lazy(() => import('./pages/librarian/SettingsPage'));
const LibrarianNotificationsPage = lazy(() => import('./pages/librarian/NotificationsPage'));
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="p-8 text-center" role="status">Loading page...</div>}>
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
              <Route path="/librarian/loan-desk" element={<LibrarianLoanDeskPage />} />
              <Route path="/librarian/reservations" element={<LibrarianReservationsPage />} />
              <Route path="/librarian/returns" element={<LibrarianReturnsPage />} />
              <Route path="/librarian/insights" element={<LibrarianInsightsPage />} />
              <Route path="/librarian/reports" element={<LibrarianReportsPage />} />
              <Route path="/librarian/settings" element={<LibrarianSettingsPage />} />
              <Route path="/librarian/notifications" element={<LibrarianNotificationsPage />} />
            </Route>

            {/* Redirect unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
