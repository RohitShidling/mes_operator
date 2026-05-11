import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Mail, Cpu, LogIn, UserPlus } from 'lucide-react';
import { authApi } from '../../api/authApi';
import './AuthPages.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [error, setError] = useState('');
  const [routeHint, setRouteHint] = useState(null);
  const isValidOtp = (value) => /^\d{6}$/.test(value);

  useEffect(() => {
    const st = location.state;
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get('email');
    if (st?.prefillEmail) setEmail(st.prefillEmail);
    else if (fromQuery) setEmail(decodeURIComponent(fromQuery));
    if (st?.authHint) setRouteHint(st.authHint);
  }, [location.state, location.search]);

  const goToRegister = (prefill) => {
    navigate('/register', {
      replace: true,
      state: { prefillEmail: prefill || email.trim(), authHint: 'no_account' },
    });
  };

  const isNoAccountMessage = (msg) => {
    if (!msg || typeof msg !== 'string') return false;
    const t = msg.toLowerCase();
    return (
      t.includes('register first')
      || t.includes('no account')
      || t.includes('does not exist')
      || t.includes('not found')
    );
  };

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }

    setSendingOtp(true);
    setError('');
    try {
      await authApi.requestLoginOtp({ email: trimmedEmail });
      setOtpSent(true);
    } catch (e) {
      const msg = e?.response?.data?.message;
      const status = e?.response?.status;
      if (status === 401 && isNoAccountMessage(msg)) {
        setError(
          msg || 'No operator account for this email. Create an account first — you will be signed in after registration.'
        );
      } else {
        setError(msg || 'Failed to send OTP');
      }
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setError('');

    const trimmedEmail = email.trim();
    const trimmedOtp = otp.trim();
    if (!trimmedEmail) return setError('Email is required');
    if (!isValidOtp(trimmedOtp)) return setError('OTP must be a 6-digit number');

    setLoading(true);
    try {
      const result = await login({ email: trimmedEmail, otp: trimmedOtp });
      if (result.success) navigate('/', { replace: true });
      else setError(result.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const showRegisterCta = /register first|create an account|no operator account/i.test(error);

  return (
    <div className="auth-page">
      <div className="auth-bg-pattern" />
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="auth-logo-icon">
                <Cpu size={28} />
              </div>
            </div>
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">Sign in to your operator panel</p>
          </div>

          {routeHint === 'already_registered' && (
            <div className="auth-hint-banner" role="status">
              This email already has an operator account. Request an OTP and sign in below.
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <Mail size={18} />
                </span>
                <input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                    setRouteHint(null);
                  }}
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-full"
              onClick={handleSendOtp}
              disabled={sendingOtp}
            >
              {sendingOtp ? 'Sending OTP...' : otpSent ? 'Resend OTP' : 'Send OTP'}
            </button>

            <div className="form-group">
              <label htmlFor="login-otp">OTP</label>
              <div className="input-with-icon">
                <span className="input-icon-wrap">
                  <Mail size={18} />
                </span>
                <input
                  id="login-otp"
                  type="text"
                  placeholder="Enter OTP from email"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setError('');
                  }}
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            {error && (
              <div className="auth-error-wrap">
                <div className="auth-error">{error}</div>
                {showRegisterCta && (
                  <div className="auth-action-row">
                    <button type="button" className="btn btn-primary btn-full" onClick={() => goToRegister()}>
                      <UserPlus size={16} />
                      Create account
                    </button>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner spinner-sm" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don&apos;t have an account?{' '}
              <Link to="/register" state={{ prefillEmail: email.trim() || undefined }}>
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
