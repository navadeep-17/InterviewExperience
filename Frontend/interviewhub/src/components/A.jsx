import React, { useState } from 'react';
import { Book, Calendar, Eye, EyeOff, Key, Mail, User } from 'react-feather';
import { useNavigate } from 'react-router-dom';

function A() {
  const [isSignIn, setIsSignIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate(); // Correct usage of useNavigate

  const [formData, setFormData] = useState({
    fullName: '',
    gradYear: '',
    major: '',
    email: '',
    password: ''
  });

  const toggleForm = () => setIsSignIn(!isSignIn);
  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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
        alert(result.msg || 'Failed!');
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert('Server error');
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

            <InputField icon={<Mail size={18} />} placeholder="you@college.edu" name="email" type="email" value={formData.email} onChange={handleChange} />
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
              {isSignIn ? 'Sign In' : 'Create Account'}
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

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * A form input field component with a left-side icon, optional right-side icon,
 * and support for password visibility toggling.
 *
 * @param {React.ReactElement} icon - The left-side icon to display.
 * @param {string} placeholder - The input field's placeholder text.
 * @param {string} type - The input field's type (e.g. "text", "password", etc.).
 * @param {string} name - The input field's name.
 * @param {string} value - The input field's current value.
 * @param {function} onChange - The function to call when the input field's value changes.
 * @param {React.ReactElement} [rightIcon] - The right-side icon to display. If provided,
 *                                          the icon will be clickable and will call the
 *                                          `onRightIconClick` function when clicked.
 * @param {function} [onRightIconClick] - The function to call when the right-side icon is clicked.
 *                                        Only called if `rightIcon` is provided.
 */
/*******  8c2a9532-8f41-4ab0-a3be-5998f5d0a63a  *******/

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
