import { apiRequest } from '../services/apiClient';
import { Home, LogOut, Menu, MessageCircle, User, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ExperienceFilters from './home/ExperienceFilters';
import ExperienceFeed from './home/ExperienceFeed';
import ExperienceFormModal from './home/ExperienceFormModal';
import useHomeExperiences from '../hooks/useHomeExperiences';

const HomePage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [showForm, setShowForm] = useState(false);
  const [editExperience, setEditExperience] = useState(null);
  const [user, setUser] = useState(null);

  const navigate = useNavigate();
  const handleContentAuthFailure = useCallback(status => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Responsive sidebar
  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Redirect to login if no token
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token && window.location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Fetch user info from backend
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      try {
        const res = await apiRequest(`/api/auth/me`);
        setUser(res);
      } catch (error) {
        handleContentAuthFailure(error.status);
      }
    };
    fetchUser();
  }, [handleContentAuthFailure]);

  const data = useHomeExperiences({ onAuthFailure: handleContentAuthFailure });

  // Sidebar toggle
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  // --- UI ---
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 text-slate-600 ${sidebarOpen ? 'translate-x-0 md:w-64' : '-translate-x-full invisible md:visible md:translate-x-0 md:w-20'} transition-all duration-300 flex flex-col md:sticky md:top-0 md:h-screen md:shrink-0`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h2 className="text-xl font-bold text-indigo-700">RoundRelay</h2>}
          <button onClick={toggleSidebar} aria-label="Toggle navigation" className="p-2.5 rounded-xl hover:bg-indigo-50 text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        <nav className="flex-1 mt-6">
          <ul className="space-y-2 px-2">
            <li>
              <Link to="/home" aria-label="Dashboard" className="flex items-center space-x-3 p-3 rounded-xl bg-indigo-50 text-indigo-700 font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors">
                <Home className="w-5 h-5" />
                {sidebarOpen && <span>Dashboard</span>}
              </Link>
            </li>
            <li>
              <Link to="/profile" aria-label="Profile" className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors">
                <User className="w-5 h-5" />
                {sidebarOpen && <span>Profile</span>}
              </Link>
            </li>
            <li>
              <Link to="/message" aria-label="Messages" className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors">
                <MessageCircle className="w-5 h-5" />
                {sidebarOpen && <span>Messages</span>}
              </Link>
            </li>
            {/* Logout moved here */}
            <li>
              <button
                onClick={handleLogout}
                aria-label="Logout"
                className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-100 cursor-pointer w-full text-left focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                {sidebarOpen && <span>Logout</span>}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 sm:px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <button onClick={toggleSidebar} aria-label="Open navigation" className="md:hidden p-2.5 rounded-xl text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-right min-w-0">
              <p className="font-semibold break-words">
                Welcome, {user?.name || "User"}
              </p>
              <p className="text-sm text-slate-500">
                {user?.department || ""}{user?.graduationYear ? `, ${user.graduationYear}` : ""}
              </p>
            </div>
            <div className="relative shrink-0 w-10 h-10 rounded-full bg-indigo-100 overflow-hidden">
              {user?.avatar && <img src={user.avatar} alt="user" className="w-full h-full object-cover" />}
              {!user?.avatar && (
                <div className="absolute inset-0 flex items-center justify-center text-indigo-700 font-semibold">
                  {user?.name ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) : "U"}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4 md:p-6 pb-28">
          <ExperienceFilters sortOrder={data.sortOrder} onFiltersChange={data.setFilters}
            onSearch={data.search} onSortChange={data.setSortOrder} />
          <ExperienceFeed data={data} user={user} onEditExperience={setEditExperience} />

          {data.page < data.totalPages && (
            <div className="text-center mt-4">
              <button
                onClick={data.loadMore}
                className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
              >
                Load More
              </button>
            </div>
          )}

          {/* Floating CTA */}
          <div className="fixed bottom-5 right-4 sm:right-6 z-20">
            <button onClick={() => setShowForm(true)} className="bg-indigo-600 text-white rounded-xl px-5 py-3 shadow-xl hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors">
              + Share Your Experience
            </button>
          </div>
        </div>
      </div>

      <ExperienceFormModal mode="create" open={showForm} onClose={() => setShowForm(false)}
        onSubmit={async draft => {
          const saved = await data.createExperience(draft);
          if (saved) setShowForm(false);
          return saved;
        }} />
      {editExperience && <ExperienceFormModal key={editExperience._id} mode="edit" experience={editExperience}
        onClose={() => setEditExperience(null)} onSubmit={async draft => {
          const saved = await data.updateExperience(editExperience._id, draft);
          if (saved) setEditExperience(null);
          return saved;
        }} />}
    </div>
  );
};

export default HomePage;
