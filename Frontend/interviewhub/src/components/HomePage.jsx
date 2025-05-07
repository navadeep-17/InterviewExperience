import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  User,
  X,
  Home,
  BookOpen,
  Settings,
  Menu,
  LogOut,
  Send
} from "lucide-react";

const HomePage = () => {
  const [showChat, setShowChat] = useState(false);
  const [chatUser, setChatUser] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    department: '',
    difficulty: '',
    roundDate: '',
    description: ''
  });

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/experiences');
        setExperiences(response.data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load experiences.');
        setLoading(false);
      }
    };

    fetchExperiences();
  }, []);

  const openChat = (user) => {
    setChatUser(user);
    setShowChat(true);
  };

  const closeChat = () => {
    setShowChat(false);
    setChatUser('');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/experiences', formData);
      setShowForm(false);
      setFormData({ name: '', company: '', department: '', difficulty: '', roundDate: '', description: '' });
      const response = await axios.get('http://localhost:5000/api/experiences');
      setExperiences(response.data);
    } catch (error) {
      alert('Failed to post experience');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className={`bg-blue-800 text-white ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 ease-in-out flex flex-col`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h2 className="text-xl font-bold">InterviewHub</h2>}
          <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-blue-700">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        <nav className="flex-1 mt-6">
          <ul className="space-y-2 px-2">
            <li>
              <a href="#" className="flex items-center space-x-3 p-3 rounded-lg bg-blue-700 hover:bg-blue-600">
                <Home className="w-5 h-5" />
                {sidebarOpen && <span>Dashboard</span>}
              </a>
            </li>
            <li>
              <a href="Profile" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700">
                <User className="w-5 h-5" />
                {sidebarOpen && <span>Profile</span>}
              </a>
            </li>
            <li>
              <a href="Message" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700">
                <MessageCircle className="w-5 h-5" />
                {sidebarOpen && <span>Messages</span>}
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700">
                <BookOpen className="w-5 h-5" />
                {sidebarOpen && <span>Resources</span>}
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700">
                <Settings className="w-5 h-5" />
                {sidebarOpen && <span>Settings</span>}
              </a>
            </li>
          </ul>
        </nav>
        <div className="p-4 mt-auto">
          <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700 cursor-pointer">
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span>Logout</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="flex items-center justify-between bg-white p-4 shadow mb-6">
          <h1 className="text-2xl font-bold text-blue-700">Dashboard</h1>
          <div className="flex items-center gap-4">
            <MessageCircle className="w-6 h-6 text-blue-600 cursor-pointer" />
            <div className="text-right">
              <p className="font-semibold">Welcome, Omkar</p>
              <p className="text-sm text-gray-500">CSE, 3rd Year</p>
            </div>
            <div className="relative w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
              <img src="https://github.com/shadcn.png" alt="user" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-medium">
                OM
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">
          {/* Experience Feed */}
          <div className="flex flex-col gap-6 max-w-3xl mx-auto">
            {loading && <p>Loading experiences...</p>}
            {error && <p className="text-red-600">{error}</p>}
            {!loading && !error && experiences.map((exp) => (
              <div key={exp._id} className="bg-white shadow-sm rounded-xl p-5 border">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                    <img src="https://github.com/shadcn.png" alt="user" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{exp.name}</p>
                    <p className="text-xs text-gray-500">Posted on {new Date(exp.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-blue-700 mb-1">{exp.company}</h3>
                <p className="text-sm text-gray-600 mb-2">{exp.difficulty} | {exp.roundDate} | {exp.department}</p>
                <p className="text-gray-800 mb-4">{exp.description}</p>
                <div className="flex items-center gap-6 text-sm text-gray-600 border-t pt-3">
                  <button className="flex items-center gap-1 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M5 15l7-7 7 7"></path>
                    </svg>
                    <span>{exp.upvotes}</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-red-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M19 9l-7 7-7-7"></path>
                    </svg>
                    <span>{exp.downvotes}</span>
                  </button>
                  <button onClick={() => openChat(exp.name)} className="ml-auto text-blue-600 hover:underline">View Comments</button>
                </div>
              </div>
            ))}
          </div>

          {/* Floating CTA */}
          <div className="fixed bottom-6 right-6">
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white rounded-full px-6 py-3 shadow-xl hover:bg-blue-700">
              + Share Your Experience
            </button>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6 relative">
            <button className="absolute top-4 right-4 text-gray-500" onClick={closeChat}>
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold mb-4">Chat with {chatUser}</h3>
            <div className="h-40 bg-gray-100 rounded-lg p-2 mb-4 overflow-y-auto text-sm text-gray-600">
              <p className="italic">No messages yet...</p>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Type your message..." 
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xl relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4 text-blue-700">Share Your Interview Experience</h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <input type="text" name="name" placeholder="Your Name" value={formData.name} onChange={handleFormChange} className="w-full border px-4 py-2 rounded-md" required />
              <input type="text" name="company" placeholder="Company" value={formData.company} onChange={handleFormChange} className="w-full border px-4 py-2 rounded-md" required />
              <input type="text" name="department" placeholder="Department" value={formData.department} onChange={handleFormChange} className="w-full border px-4 py-2 rounded-md" required />
              <input type="text" name="difficulty" placeholder="Difficulty (Easy/Medium/Hard)" value={formData.difficulty} onChange={handleFormChange} className="w-full border px-4 py-2 rounded-md" required />
              <input type="date" name="roundDate" value={formData.roundDate} onChange={handleFormChange} className="w-full border px-4 py-2 rounded-md" required />
              <textarea name="description" placeholder="Describe your experience..." value={formData.description} onChange={handleFormChange} className="w-full border px-4 py-2 rounded-md" required rows={4} />
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">Submit</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
