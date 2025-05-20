import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (authToken && location.pathname !== '/home') {
      navigate('/home');
    }
  }, [navigate, location.pathname]);

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

    if (isSignIn) {
      // Direct login (no OTP)
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const result = await response.json();
      console.log(result);
      if (response.ok && result.token && result.user) {
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        navigate('/home');
      } else {
        setMessage(result.message || 'Authentication failed!');
      }
    } else {
      // Registration with OTP
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
          graduationYear: formData.gradYear,
          department: formData.major,
          context: 'welcome'
        })
      });
      const result = await response.json();
      if (response.ok) {
        setStep('otp');
        setMessage('OTP sent to your email. Please verify.');
      } else {
        setMessage(result.msg || result.message || 'Registration failed!');
      }
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: formData.email, otp,context: 'reset' }),
    });
    const result = await response.json();
    if (response.ok && result.token && result.user) {
      localStorage.setItem('authToken', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      alert('Login successful!');
      navigate('/home');
    } else {
      setMessage(result.message || 'OTP verification failed!');
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetStep === 'email') {
      // Step 1: Send OTP
      const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetStep('otp');
        setResetMsg('OTP sent to your email.');
      } else {
        setResetMsg(data.message || 'Failed to send OTP');
      }
    } else {
      // Step 2: Verify OTP and set new password
      const res = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, otp: resetOtp, newPassword: resetNewPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetMsg('Password reset successful! You can now log in.');
        setTimeout(() => {
          setShowReset(false);
          setResetStep('email');
          setResetEmail('');
          setResetOtp('');
          setResetNewPassword('');
          setResetMsg('');
        }, 2000);
      } else {
        setResetMsg(data.message || 'Failed to reset password');
      }
    }
  };

  const departmentOptions = [
    "CSE", "ECE", "MECH", "CIVIL", "EEE", "IT", "CSB", "CSD", "CSM"
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200 px-4 py-12">
      <div className="max-w-4xl w-full flex flex-col md:flex-row rounded-3xl shadow-2xl overflow-hidden bg-white border border-gray-100">
        <div className="md:w-1/2 p-10 flex flex-col justify-center">
          <div className="flex justify-center mb-10">
            <div className="flex bg-gray-100 rounded-full overflow-hidden w-full max-w-xs shadow">
              <button
                className={`w-1/2 py-2 text-base font-bold transition-all duration-200 ${
                  isSignIn
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
                onClick={() => setIsSignIn(true)}
                type="button"
              >
                Sign In
              </button>
              <button
                className={`w-1/2 py-2 text-base font-bold transition-all duration-200 ${
                  !isSignIn
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-700 hover:bg-blue-50'
                }`}
                onClick={() => setIsSignIn(false)}
                type="button"
              >
                Sign Up
              </button>
            </div>
          </div>

          <h2 className="text-3xl font-extrabold text-center text-gray-800 mb-8 tracking-tight">
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition"
              >
                Verify OTP
              </button>
              {message && (
                <div className="text-center text-base font-medium text-red-600 mt-2">{message}</div>
              )}
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isSignIn && (
                <>
                  <InputField placeholder="Full Name" name="fullName" type="text" value={formData.fullName} onChange={handleChange} />
                  <InputField placeholder="Graduation Year" name="gradYear" type="text" value={formData.gradYear} onChange={handleChange} />
                  <div className="relative">
                    <select
                      name="major"
                      value={formData.major}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

              {message && (
                <div className={`text-center text-base font-medium mt-2 ${message.toLowerCase().includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {message}
                </div>
              )}

              {isSignIn && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <label className="flex items-center gap-2 text-gray-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                    Remember me
                  </label>
                  <span className="text-blue-600 hover:underline cursor-pointer font-semibold" onClick={() => setShowReset(true)}>
                    Forgot password?
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition"
              >
                {isSignIn ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          )}

          {showReset && (
            <div className="mt-10 p-6 bg-gray-50 rounded-2xl shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow transition"
                >
                  {resetStep === 'email' ? 'Send OTP' : 'Reset Password'}
                </button>

                {resetMsg && (
                  <div className="text-center text-base font-medium text-red-600 mt-2">{resetMsg}</div>
                )}
              </form>
            </div>
          )}

          <p className="text-base text-center text-gray-600 mt-8">
            {isSignIn ? "Don't have an account?" : "Already have an account?"}{' '}
            <span className="text-blue-600 cursor-pointer hover:underline font-semibold" onClick={toggleForm}>
              {isSignIn ? 'Sign Up' : 'Sign In'}
            </span>
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
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder={placeholder}
        required
      />
      {rightIcon && (
        <div
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 cursor-pointer"
          onClick={onRightIconClick}
        >
          {rightIcon}
        </div>
      )}
    </div>
  );
}

export default AuthForm;
