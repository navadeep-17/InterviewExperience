import React, { useState } from 'react';
import { Book, Calendar, Check, Eye, EyeOff, Key, Mail, User } from 'react-feather';
import { useNavigate } from 'react-router-dom';

function A() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpField, setShowOtpField] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    gradYear: '',
    major: '',
    email: '',
    password: '',
    otp: ''
  });

  // College domain validation
  const isCollegeEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@mgit\.ac\.in$/;
    return emailRegex.test(email);
  };

  const toggleForm = () => {
    setIsSignIn(!isSignIn);
    setShowOtpField(false);
    setOtpSent(false);
    setVerificationMessage('');
  };
  
  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    
    // Clear verification message when email is changed
    if (e.target.name === 'email') {
      setVerificationMessage('');
      setShowOtpField(false);
      setOtpSent(false);
    }
  };

  const sendOtp = async (e) => {
    e.preventDefault();
    
    // First validate if it's a college email
    if (!isCollegeEmail(formData.email)) {
      setVerificationMessage('Please use your college email (@mgit.ac.in)');
      return;
    }

    try {
      // Send OTP to the email
      const response = await fetch('http://localhost:5000/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });

      const result = await response.json();
      
      if (response.ok) {
        setOtpSent(true);
        setShowOtpField(true);
        setVerificationMessage('OTP sent to your email. Please verify.');
      } else {
        setVerificationMessage(result.msg || 'Failed to send OTP');
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      setVerificationMessage('Server error. Please try again.');
    }
  };

  const verifyOtp = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: formData.email,
          otp: formData.otp 
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setVerificationMessage('Email verified successfully!');
        return true;
      } else {
        setVerificationMessage(result.msg || 'Invalid OTP');
        return false;
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setVerificationMessage('Server error. Please try again.');
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate email format
    if (!isCollegeEmail(formData.email)) {
      setVerificationMessage('Please use your college email (@mgit.ac.in)');
      return;
    }

    // For sign up, verify OTP first
    if (!isSignIn) {
      if (!otpSent) {
        await sendOtp(e);
        return;
      }
      
      if (formData.otp.length === 0) {
        setVerificationMessage('Please enter the OTP sent to your email');
        return;
      }
      
      const isVerified = await verifyOtp();
      if (!isVerified) return;
    }

    const endpoint = isSignIn ? "/api/auth/login" : "/api/auth/register";

    // Prepare payload based on form mode
    const payload = isSignIn
      ? {
          email: formData.email,
          password: formData.password
        }
      : {
          name: formData.fullName,
          email: formData.email,
          password: formData.password,
          graduationYear: formData.gradYear,
          department: formData.major
        };

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      console.log("Server response:", result);

      if (response.ok) {
        alert('Login successful!');
        navigate('/home');  // Navigate to home page after successful login
      } else {
        setVerificationMessage(result.msg || 'Authentication failed!');
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setVerificationMessage('Server error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-12">
      <div className="max-w-4xl w-full flex flex-col md:flex-row rounded-2xl shadow-xl overflow-hidden bg-white">

        {/* Auth form */}
        <div className="md:w-1/2 p-8">
          <div className="flex justify-center mb-8">
            <div className="flex bg-gray-100 rounded-full overflow-hidden w-full max-w-xs">
              <button
                className={`w-1/2 py-2 text-sm font-semibold ${!isSignIn ? 'text-gray-700' : 'bg-blue-600 text-white'}`}
                onClick={() => setIsSignIn(true)}
              >
                Sign In
              </button>
              <button
                className={`w-1/2 py-2 text-sm font-semibold ${isSignIn ? 'text-gray-700' : 'bg-blue-600 text-white'}`}
                onClick={() => setIsSignIn(false)}
              >
                Sign Up
              </button>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
            {isSignIn ? 'Welcome back!' : 'Create your account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isSignIn && (
              <>
                <InputField icon={<User size={18} />} placeholder="Full Name" name="fullName" type="text" value={formData.fullName} onChange={handleChange} />
                <InputField icon={<Calendar size={18} />} placeholder="Graduation Year" name="gradYear" type="text" value={formData.gradYear} onChange={handleChange} />
                <InputField icon={<Book size={18} />} placeholder="Major/Department" name="major" type="text" value={formData.major} onChange={handleChange} />
              </>
            )}

            <div className="space-y-1">
              <InputField 
                icon={<Mail size={18} />} 
                placeholder="you@mgit.ac.in" 
                name="email" 
                type="email" 
                value={formData.email} 
                onChange={handleChange} 
              />
              {!isSignIn && (
                <div className="flex justify-end">
                 <button
  type="button"
  onClick={sendOtp}
  className="text-sm text-blue-600 hover:underline"
>
  {otpSent ? 'Resend OTP' : 'Send OTP'}
</button>
                  
                </div>
                
              )}
            </div>

            {showOtpField && !isSignIn && (
              <InputField
                icon={<Check size={18} />}
                placeholder="Enter OTP"
                name="otp"
                type="text"
                value={formData.otp}
                onChange={handleChange}
              />
            )}

            {verificationMessage && (
              <div className={`text-sm ${verificationMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {verificationMessage}
              </div>
            )}

            <InputField
              icon={<Key size={18} />}
              placeholder="••••••••"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              rightIcon={showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              onRightIconClick={togglePasswordVisibility}
            />

            {isSignIn && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-700">
                  <input type="checkbox" className="h-4 w-4" />
                  Remember me
                </label>
                <span className="text-blue-600 hover:underline cursor-pointer">Forgot password?</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition"
            >
              {isSignIn ? 'Sign In' : (otpSent ? 'Create Account' : 'Send OTP & Continue')}
            </button>
          </form>

          <p className="text-sm text-center text-gray-600 mt-6">
            {isSignIn ? "Don't have an account?" : "Already have an account?"}{' '}
            <span className="text-blue-600 cursor-pointer hover:underline" onClick={toggleForm}>
              {isSignIn ? 'Sign Up' : 'Sign In'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

function InputField({ icon, placeholder, type, name, value, onChange, rightIcon, onRightIconClick }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
        {icon}
      </div>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="pl-10 pr-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

export default A;