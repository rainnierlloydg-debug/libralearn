import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

function LoginPage() {
  const { login } = useAuth();
  const { error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  const [formData, setFormData] = useState({
    login: '',
    password: '',
    remember: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!formData.login) newErrors.login = 'Email or School ID is required';
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await login({ login: formData.login, password: formData.password, remember: formData.remember });
      if (result.success) {
        const isLibrarian = ['librarian', 'admin'].includes(result.user?.role);
        const defaultDestination = isLibrarian ? '/librarian/dashboard' : '/dashboard';
        const requestedDestinationIsAllowed = from && (isLibrarian
          ? from.startsWith('/librarian/')
          : !from.startsWith('/librarian/'));
        navigate(requestedDestinationIsAllowed ? from : defaultDestination, { replace: true });
      } else {
        error(result.message || 'Login failed');
        if (result.message?.includes('credentials')) {
          setErrors({ password: 'Invalid email/School ID or password' });
        }
      }
    } catch (err) {
      error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-inner">
        <Link to="/" className="login-brand">
          <span className="login-brand-badge">
            <Check size={22} strokeWidth={3} />
          </span>
          <span className="login-brand-text">LibraLearn</span>
        </Link>

        <p className="login-subtitle">Good Shepherded Academy Library</p>

        <div className="login-form-wrap">
          <h1 className="login-title">Welcome back</h1>
          <p className="login-helper">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field-block">
              <input
                type="text"
                name="login"
                value={formData.login}
                onChange={handleChange}
                placeholder="Email or School ID"
                autoComplete="username"
                className={errors.login ? 'login-input error' : 'login-input'}
              />
              {errors.login && <span className="field-error">{errors.login}</span>}
            </div>

            <div className="field-block">
              <div className="password-box">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password"
                  autoComplete="current-password"
                  className={errors.password ? 'login-input error' : 'login-input'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <div className="login-meta">
              <label className="remember-me">
                <input
                  type="checkbox"
                  name="remember"
                  checked={formData.remember}
                  onChange={handleChange}
                />
                <span>Remember me</span>
              </label>

              <Link to="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="register-links">
            <p>
              Don't have an account?{' '}
              <Link to="/register">Register as a student</Link>
            </p>
            <p>
              Librarian?{' '}
              <Link to="/librarian/login">Access admin panel</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default LoginPage;
