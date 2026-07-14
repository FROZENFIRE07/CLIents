import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import api from '../services/api';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-panel">
        {/* Left: branding */}
        <div className="login-brand">
          <div className="login-brand-content">
            <div className="login-logo">G</div>
            <h1>Gorade<br />Classes</h1>
            <p className="login-tagline">Classroom Management System</p>
          </div>
          <p className="login-footer-text">
            Attendance · Exams · Notifications
          </p>
        </div>

        {/* Right: form */}
        <div className="login-form-side">
          <div className="login-form-inner">
            <h2>Welcome back</h2>
            <p className="login-subtitle">Sign in to continue managing your classes</p>

            {error && (
              <div className="error-box">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="login-user">Username</label>
                <input
                  id="login-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoFocus
                  autoComplete="username"
                />
              </div>

              <div className="login-field">
                <label htmlFor="login-pass">Password</label>
                <div className="login-password-wrap">
                  <input
                    id="login-pass"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                className="login-submit"
                disabled={loading || !username || !password}
                type="submit"
              >
                {loading ? (
                  <span className="login-spinner" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
