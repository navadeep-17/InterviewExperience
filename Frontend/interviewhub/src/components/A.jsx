import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { apiRequest } from '../services/apiClient';
function StatusMessage({ message }) {
  if (!message) return null;
  const positive = [
    'OTP sent to your email. Please verify.',
    'OTP sent to your email.',
    'Password reset successful! You can now log in.',
  ].includes(message);
  return (
    <div role={positive ? 'status' : 'alert'} className={`text-center text-base font-medium mt-2 ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
      {message}
    </div>
  );
}

function AuthForm() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    gradYear: '',
    major: '',
    email: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('login'); // 'login' | 'otp'
  const [resetStep, setResetStep] = useState('email'); // 'email' | 'otp'
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) return;
    let cancelled = false;
    const validateSession = async () => {
      try {
        const user = await apiRequest('/api/auth/me');
        if (!cancelled && localStorage.getItem('authToken') === authToken && user?._id) {
          localStorage.setItem('user', JSON.stringify(user));
          navigate('/home', { replace: true });
        }
      } catch (error) {
        if (cancelled || localStorage.getItem('authToken') !== authToken) return;
        if (error.status === 401 || error.status === 403) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
        }
        // Temporary connectivity failures leave the login form and credentials available.
      }
    };
    validateSession();
    return () => { cancelled = true; };
  }, [navigate]);

  const isCollegeEmail = (email) => /^[a-zA-Z0-9._-]+@mgit\.ac\.in$/.test(email);

  const toggleForm = () => {
    setIsSignIn(!isSignIn);
    setMessage('');
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isCollegeEmail(formData.email)) {
      setMessage('Please use your college email (@mgit.ac.in)');
      return;
    }

    setMessage('');
    setIsSubmitting(true);
    try {
      if (isSignIn) {
        const result = await apiRequest('/api/auth/login', {
          method: 'POST', auth: false,
          data: { email: formData.email, password: formData.password },
        });
        if (result?.token && result.user) {
          localStorage.setItem('authToken', result.token);
          localStorage.setItem('user', JSON.stringify(result.user));
          navigate('/home');
        } else {
          setMessage(result?.message || 'Authentication failed!');
        }
      } else {
        await apiRequest('/api/auth/register', {
          method: 'POST', auth: false,
          data: {
            name: formData.fullName,
            email: formData.email,
            password: formData.password,
            graduationYear: formData.gradYear,
            department: formData.major,
            context: 'welcome'
          }
        });
        setStep('otp');
        setMessage('OTP sent to your email. Please verify.');
      }
    } catch (error) {
      if (error.status === undefined) {
        setMessage('Unable to reach RoundRelay. Please try again.');
      } else {
        setMessage(error.data?.msg || error.data?.message || (isSignIn ? 'Authentication failed!' : 'Registration failed!'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    try {
      const result = await apiRequest('/api/auth/verify-otp', {
        method: 'POST', auth: false,
        data: { email: formData.email, otp, context: 'reset' },
      });
      if (result?.token && result.user) {
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        alert('Login successful!');
        navigate('/home');
      } else {
        setMessage(result?.message || 'OTP verification failed!');
      }
    } catch (error) {
      setMessage(error.status === undefined
        ? 'Unable to reach RoundRelay. Please try again.'
        : error.data?.message || 'OTP verification failed!');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetStep === 'email') {
      // Step 1: Send OTP
      try {
        await apiRequest('/api/auth/forgot-password', {
          method: 'POST', auth: false,
          data: { email: resetEmail },
        });
        setResetStep('otp');
        setResetMsg('OTP sent to your email.');
      } catch (error) {
        setResetMsg(error.status === undefined
          ? 'Unable to reach RoundRelay. Please try again.'
          : error.data?.message || 'Failed to send OTP');
      }
    } else {
      // Step 2: Verify OTP and set new password
      try {
        await apiRequest('/api/auth/reset-password', {
          method: 'POST', auth: false,
          data: { email: resetEmail, otp: resetOtp, newPassword: resetNewPassword },
        });
        setResetMsg('Password reset successful! You can now log in.');
        setTimeout(() => {
          setShowReset(false);
          setResetStep('email');
          setResetEmail('');
          setResetOtp('');
          setResetNewPassword('');
          setResetMsg('');
        }, 2000);
      } catch (error) {
        setResetMsg(error.status === undefined
          ? 'Unable to reach RoundRelay. Please try again.'
          : error.data?.message || 'Failed to reset password');
      }
    }
  };

  const departmentOptions = [
    "CSE", "ECE", "MECH", "CIVIL", "EEE", "IT", "CSB", "CSD", "CSM"
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-lg w-full rounded-2xl shadow-sm bg-white border border-slate-200">
        <div className="w-full p-6 sm:p-8 flex flex-col justify-center">
          <div className="text-center mb-8">
            <p className="text-2xl font-bold tracking-tight text-indigo-700">RoundRelay</p>
            <p className="mt-2 text-sm text-slate-600">Real interview experiences, passed forward.</p>
          </div>
          <div className="flex justify-center mb-6">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-full">
              <button
                className={`focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors w-1/2 rounded-xl py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  isSignIn
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-indigo-50'
                }`}
                onClick={() => setIsSignIn(true)}
                type="button"
                disabled={isSubmitting}
              >
                Sign In
              </button>
              <button
                className={`focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors w-1/2 rounded-xl py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  !isSignIn
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-indigo-50'
                }`}
                onClick={() => setIsSignIn(false)}
                type="button"
                disabled={isSubmitting}
              >
                Sign Up
              </button>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-slate-900 mb-6 tracking-tight">
            {isSignIn ? 'Welcome Back!' : 'Create Your Account'}
          </h2>

          {step === 'otp' ? (
            <form onSubmit={handleOtpSubmit} className="space-y-6">
              <InputField
                placeholder="Enter OTP"
                name="otp"
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
              >
                Verify OTP
              </button>
              <StatusMessage message={message} />
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" aria-busy={isSubmitting}>
              {!isSignIn && (
                <>
                  <InputField placeholder="Full Name" name="fullName" type="text" value={formData.fullName} onChange={handleChange} />
                  <InputField placeholder="Graduation Year" name="gradYear" type="text" value={formData.gradYear} onChange={handleChange} />
                  <div className="relative">
                    <select
                      aria-label="Department"
                      name="major"
                      value={formData.major}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none min-w-0 bg-white text-slate-900 placeholder:text-slate-500"
                      required // <-- This makes the department compulsory
                    >
                      <option value="" disabled>Select Department</option>
                      {departmentOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <InputField
                placeholder="you@mgit.ac.in"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />

              <InputField
                placeholder="••••••••"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                onRightIconClick={togglePasswordVisibility}
              />

              <StatusMessage message={message} />

              {isSignIn && (
                <div className="flex justify-end text-sm mt-2">
                  <button type="button" className="text-indigo-700 hover:underline font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5" onClick={() => setShowReset(true)}>
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
              >
                {isSubmitting
                  ? (isSignIn ? 'Signing In…' : 'Creating Account…')
                  : (isSignIn ? 'Sign In' : 'Create Account')}
              </button>
            </form>
          )}

          {showReset && (
            <div className="mt-10 p-6 bg-slate-50 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">
                {resetStep === 'email' ? 'Reset Password' : 'Verify OTP'}
              </h3>
              <form onSubmit={handleResetSubmit} className="space-y-4">
                {resetStep === 'email' ? (
                  <InputField
                    placeholder="you@mgit.ac.in"
                    name="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                  />
                ) : (
                  <>
                    <InputField
                      placeholder="Enter OTP"
                      name="resetOtp"
                      type="text"
                      value={resetOtp}
                      onChange={e => setResetOtp(e.target.value)}
                    />
                    <InputField
                      placeholder="New Password"
                      name="resetNewPassword"
                      type="password"
                      value={resetNewPassword}
                      onChange={e => setResetNewPassword(e.target.value)}
                    />
                  </>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
                >
                  {resetStep === 'email' ? 'Send OTP' : 'Reset Password'}
                </button>

                <StatusMessage message={resetMsg} />
              </form>
            </div>
          )}

          <p className="text-base text-center text-slate-600 mt-8">
            {isSignIn ? "Don't have an account?" : "Already have an account?"}{' '}
            <button type="button" className="text-indigo-700 hover:underline font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5" onClick={toggleForm}>
              {isSignIn ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function InputField({ placeholder, type, name, value, onChange, rightIcon, onRightIconClick }) {
  return (
    <div className="relative">
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full pl-4 pr-12 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none min-w-0 bg-white text-slate-900 placeholder:text-slate-500"
        aria-label={placeholder}
        placeholder={placeholder}
        required
      />
      {rightIcon && (
        <button
          type="button"
          aria-label={type === 'password' ? 'Show password' : 'Hide password'}
          className="absolute inset-y-1 right-1 px-3 flex items-center rounded-xl text-slate-500 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors py-1.5"
          onClick={onRightIconClick}
        >
          {rightIcon}
        </button>
      )}
    </div>
  );
}

export default AuthForm;
