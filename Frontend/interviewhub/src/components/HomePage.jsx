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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white flex">
      {/* Sidebar */}
      <aside className={`bg-blue-800 text-white ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h2 className="text-xl font-bold">RoundRelay</h2>}
          <button onClick={toggleSidebar} className="p-2 rounded-lg hover:bg-blue-700">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        <nav className="flex-1 mt-6">
          <ul className="space-y-2 px-2">
            <li>
              <Link to="/home" className="flex items-center space-x-3 p-3 rounded-lg bg-blue-700 hover:bg-blue-600">
                <Home className="w-5 h-5" />
                {sidebarOpen && <span>Dashboard</span>}
              </Link>
            </li>
            <li>
              <Link to="/profile" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700">
                <User className="w-5 h-5" />
                {sidebarOpen && <span>Profile</span>}
              </Link>
            </li>
            <li>
              <Link to="/message" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700">
                <MessageCircle className="w-5 h-5" />
                {sidebarOpen && <span>Messages</span>}
              </Link>
            </li>
            {/* Logout moved here */}
            <li>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-700 cursor-pointer w-full text-left"
              >
                <LogOut className="w-5 h-5" />
                {sidebarOpen && <span>Logout</span>}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <header className="flex items-center justify-between bg-white p-4 shadow rounded-xl">
          <h1 className="text-2xl font-bold text-blue-700">Dashboard</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="font-semibold">
                Welcome, {user?.name || "User"}
              </p>
              <p className="text-sm text-gray-500">
                {user?.department || ""}{user?.graduationYear ? `, ${user.graduationYear}` : ""}
              </p>
            </div>
            <div className="relative w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
              <img src={user?.avatar || "https://github.com/shadcn.png"} alt="user" className="w-full h-full object-cover" />
              {!user?.avatar && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-medium">
                  {user?.name ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) : "U"}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6">
          <ExperienceFilters sortOrder={data.sortOrder} onFiltersChange={data.setFilters}
            onSearch={data.search} onSortChange={data.setSortOrder} />
          <ExperienceFeed data={data} user={user} onEditExperience={setEditExperience} />

          {/* Floating CTA */}
          <div className="fixed bottom-6 right-6">
            <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white rounded-full px-6 py-3 shadow-xl hover:bg-blue-700">
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

      {data.page < data.totalPages && (
        <div className="text-center mt-4">
          <button
            onClick={data.loadMore}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
