import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  Home,
  LogOut,
  Menu,
  MessageCircle,
  User,
  X
} from "lucide-react";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ExperienceCard from './ExperienceCard';


dayjs.extend(relativeTime);

const MAX_NESTING = 3;

const HomePage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState(null);

  const [formData, setFormData] = useState({
    company: '',
    role: '',
    department: '',
    difficulty: '',
    roundDate: '',
    description: '',
    tips: '',
    rounds: [
      { roundName: '', questions: '', duration: '' }
    ]
  });

  const [searchCompany, setSearchCompany] = useState('');
  const [searchRole, setSearchRole] = useState('');
  const [searchDepartment, setSearchDepartment] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');

  const [commentCounts, setCommentCounts] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [allComments, setAllComments] = useState({});

  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [expandedComments, setExpandedComments] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyInputs, setReplyInputs] = useState({});
  const [collapsedComments, setCollapsedComments] = useState({});
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [expandedRounds, setExpandedRounds] = useState({});

  const [voteLoading, setVoteLoading] = useState({});

  const [showChat, setShowChat] = useState(false);
  const [chatUser, setChatUser] = useState('');

  const [user, setUser] = useState(null);

  const navigate = useNavigate();

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
        const res = await axios.get('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(res.data);
      } catch (err) {
        // handle error, maybe redirect to login
      }
    };
    fetchUser();
  }, []);

  // Fetch comment counts for all experiences
  const fetchCommentCounts = async (exps) => {
    const token = localStorage.getItem('authToken');
    const counts = {};
    await Promise.all(
      exps.map(async (exp) => {
        try {
          const res = await axios.get(
            `http://localhost:5000/api/comments/experience/${exp._id}/count`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          counts[exp._id] = res.data.count;
        } catch {
          counts[exp._id] = 0;
        }
      })
    );
    setCommentCounts(prev => ({ ...prev, ...counts }));
  };

  // Fetch experiences
  const fetchExperiences = async (pageNum = 1) => {
    try {
      setLoading(true);
      const params = {
        page: pageNum,
        limit: 10,
        company: searchCompany,
        role: searchRole,
        department: searchDepartment,
        difficulty: filterDifficulty,
        sortOrder
      };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const response = await axios.get('http://localhost:5000/api/experiences', { params });
      const exps = response.data.experiences;
      if (pageNum === 1) {
        setExperiences(exps);
      } else {
        setExperiences(prev => [...prev, ...exps]);
      }
      setTotalPages(response.data.totalPages);
      setLoading(false);
      await fetchCommentCounts(exps);
    } catch (err) {
      setError('Failed to load experiences.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiences(page);
    // eslint-disable-next-line
  }, [page, sortOrder]);

  // Sidebar toggle
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/');
  };

  const openChat = (user) => {
    setChatUser(user);
    setShowChat(true);
  };

  const closeChat = () => {
    setShowChat(false);
    setChatUser('');
  };

  const handleFormChange = (e, roundIndex = null) => {
    const { name, value } = e.target;

    if (roundIndex !== null) {
      const updatedRounds = [...formData.rounds];
      updatedRounds[roundIndex][name] = value;
      setFormData({ ...formData, rounds: updatedRounds });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('authToken');
      await axios.post(
        'http://localhost:5000/api/experiences',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowForm(false);
      setFormData({
        company: '',
        role: '',
        department: '',
        difficulty: '',
        roundDate: '',
        description: '',
        tips: '',
        rounds: [
          { roundName: '', questions: '', duration: '' }
        ]
      });
      setPage(1);
      setLoading(true);
      fetchExperiences(1);
    } catch (error) {
      alert('Failed to post experience');
      console.error(error.response?.data || error.message);
    }
  };

  const handleDeleteExperience = async (id) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this experience?');
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem('authToken');
      await axios.delete(`http://localhost:5000/api/experiences/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setPage(1);
      setLoading(true);
      fetchExperiences(1);
    } catch (error) {
      alert('Failed to delete experience');
      console.error(error);
    }
  };

  const handleEditExperience = (exp) => {
    setEditFormData(exp);
    setIsEditing(true);
  };

  const handlePostComment = async (expId, text, parentCommentId = null) => {
    setCommentLoading(prev => ({ ...prev, [expId]: true }));
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.post(
        'http://localhost:5000/api/comments',
        {
          experienceId: expId,
          text: text || commentInputs[expId],
          parentCommentId: parentCommentId || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (parentCommentId) {
        setReplyInputs(prev => ({ ...prev, [parentCommentId]: "" }));
        setReplyingTo(null);
      } else {
        setCommentInputs(prev => ({ ...prev, [expId]: "" }));
      }
      await fetchAllComments(expId);
      await fetchCommentCounts([{ _id: expId }]);
      setHighlightedCommentId(res.data._id);
      setTimeout(() => setHighlightedCommentId(null), 1500);
    } catch (err) {
      alert('Failed to post comment');
    }
    setCommentLoading(prev => ({ ...prev, [expId]: false }));
  };

  const fetchAllComments = async (expId) => {
    const token = localStorage.getItem('authToken');
    try {
      const res = await axios.get(
        `http://localhost:5000/api/comments/experience/${expId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAllComments(prev => ({ ...prev, [expId]: res.data }));
    } catch {
      setAllComments(prev => ({ ...prev, [expId]: [] }));
    }
  };

  useEffect(() => {
    if (experiences.length > 0) {
      experiences.forEach(exp => fetchAllComments(exp._id));
    }
    // eslint-disable-next-line
  }, [experiences]);

  const handleEditComment = (comment) => {
    setEditingCommentId(comment._id);
    setEditingCommentText(comment.text);
  };

  const handleEditCommentSave = async (expId, commentId) => {
    try {
      const token = localStorage.getItem('authToken');
      await axios.put(
        `http://localhost:5000/api/comments/${commentId}`,
        { text: editingCommentText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingCommentId(null);
      setEditingCommentText('');
      await fetchAllComments(expId);
      await fetchCommentCounts([{ _id: expId }]);
    } catch (err) {
      alert('Failed to update comment');
    }
  };

  const handleDeleteComment = async (expId, commentId) => {
    // if (!window.confirm('Delete this comment?')) return;
    try {
      const token = localStorage.getItem('authToken');
      await axios.delete(
        `http://localhost:5000/api/comments/${commentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchAllComments(expId);
      await fetchCommentCounts([{ _id: expId }]);
    } catch (err) {
      alert('Failed to delete comment');
    }
  };

  const toggleComments = (expId) => {
    setExpandedComments(prev => ({
      ...prev,
      [expId]: !prev[expId]
    }));
  };

  const toggleRounds = (expId) => {
    setExpandedRounds(prev => ({
      ...prev,
      [expId]: !prev[expId]
    }));
  };

  const toggleDescription = (expId) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [expId]: !prev[expId]
    }));
  };

  const sortedComments = (commentsArr) =>
    [...commentsArr].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function buildCommentTree(comments) {
    const map = {};
    const roots = [];
    comments.forEach(comment => {
      map[comment._id] = { ...comment, replies: [], parentName: null };
    });
    comments.forEach(comment => {
      if (comment.parentCommentId) {
        map[comment._id].parentName = map[comment.parentCommentId]?.user?.name || null;
        map[comment.parentCommentId]?.replies.push(map[comment._id]);
      } else {
        roots.push(map[comment._id]);
      }
    });
    return roots;
  }

  const handleUpvote = async (expId) => {
    setVoteLoading(prev => ({ ...prev, [expId]: true }));
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.post(
        `http://localhost:5000/api/experiences/${expId}/upvote`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update only the voted experience in state
      setExperiences(prev =>
        prev.map(exp =>
          exp._id === expId ? { ...exp, upvotes: res.data.upvotes, downvotes: res.data.downvotes } : exp
        )
      );
    } catch (err) {
      alert('Failed to upvote');
    }
    setVoteLoading(prev => ({ ...prev, [expId]: false }));
  };

  const handleDownvote = async (expId) => {
    setVoteLoading(prev => ({ ...prev, [expId]: true }));
    try {
      const token = localStorage.getItem('authToken');
      const res = await axios.post(
        `http://localhost:5000/api/experiences/${expId}/downvote`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setExperiences(prev =>
        prev.map(exp =>
          exp._id === expId ? { ...exp, upvotes: res.data.upvotes, downvotes: res.data.downvotes } : exp
        )
      );
    } catch (err) {
      alert('Failed to downvote');
    }
    setVoteLoading(prev => ({ ...prev, [expId]: false }));
  };

  // --- UI ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white flex">
      {/* Sidebar */}
      <aside className={`bg-blue-800 text-white ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 flex flex-col`}>
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h2 className="text-xl font-bold">InterviewHub</h2>}
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
          {/* Search and Filter Form */}
          <form
            onSubmit={e => {
              e.preventDefault();
              setPage(1);
              setLoading(true);
              fetchExperiences(1);
            }}
            className="mb-8 flex flex-wrap gap-3 items-center bg-white/80 shadow-lg rounded-xl px-6 py-4"
          >
            <input
              type="text"
              placeholder="Company"
              value={searchCompany}
              onChange={e => setSearchCompany(e.target.value)}
              className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-40"
            />
            <input
              type="text"
              placeholder="Role"
              value={searchRole}
              onChange={e => setSearchRole(e.target.value)}
              className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-40"
            />
            <input
              type="text"
              placeholder="Department"
              value={searchDepartment}
              onChange={e => setSearchDepartment(e.target.value)}
              className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-40"
            />
            <select
              value={filterDifficulty}
              onChange={e => setFilterDifficulty(e.target.value)}
              className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-44"
            >
              <option value="">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-36"
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
            </select>
            <button
              type="submit"
              className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition font-semibold"
            >
                 Search
            </button>
          </form>

          {/* Experience Feed */}
          <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full px-2 sm:px-0">
            {loading && <div className="text-center py-10 text-gray-500">Loading experiences...</div>}
            {error && <div className="text-center py-10 text-red-500">{error}</div>}
            {!loading && !error && experiences.length === 0 && (
              <div className="text-center py-10 text-gray-500">
                No experiences found matching your criteria.
              </div>
            )}
            {!loading && !error && experiences.map((exp) => (
              <ExperienceCard
                key={exp._id}
                exp={exp}
                user={user}
                expandedDescriptions={expandedDescriptions}
                toggleDescription={toggleDescription}
                expandedRounds={expandedRounds}
                toggleRounds={toggleRounds}
                handleEditExperience={handleEditExperience}
                handleDeleteExperience={handleDeleteExperience}
                expandedComments={expandedComments}
                toggleComments={toggleComments}
                commentCounts={commentCounts}
                allComments={allComments}
                commentInputs={commentInputs}
                setCommentInputs={setCommentInputs}
                commentLoading={commentLoading}
                handlePostComment={handlePostComment}
                buildCommentTree={buildCommentTree}
                sortedComments={sortedComments}
                editingCommentId={editingCommentId}
                editingCommentText={editingCommentText}
                setEditingCommentId={setEditingCommentId}
                setEditingCommentText={setEditingCommentText}
                handleEditComment={handleEditComment}
                handleEditCommentSave={handleEditCommentSave}
                handleDeleteComment={handleDeleteComment}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                replyInputs={replyInputs}
                setReplyInputs={setReplyInputs}
                collapsedComments={collapsedComments}
                setCollapsedComments={setCollapsedComments}
                highlightedCommentId={highlightedCommentId}
                MAX_NESTING={MAX_NESTING}
                handleUpvote={handleUpvote}
                handleDownvote={handleDownvote}
                voteLoading={voteLoading[exp._id]}
                
              />
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

      
      {/* {showChat && (
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
      )} */}

      {/* Post Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4 text-blue-700">Share Your Interview Experience</h2>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <input
                type="text"
                name="company"
                placeholder="Company"
                value={formData.company}
                onChange={handleFormChange}
                className="w-full border px-4 py-2 rounded-md"
                required
              />
              <input
                type="text"
                name="role"
                placeholder="Role"
                value={formData.role}
                onChange={handleFormChange}
                className="w-full border px-4 py-2 rounded-md"
                required
              />
              <select
                name="difficulty"
                value={formData.difficulty}
                onChange={handleFormChange}
                className="w-full border px-4 py-2 rounded-md"
                required
              >
                <option value="">Select Difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              <input
                type="date"
                name="roundDate"
                value={formData.roundDate}
                onChange={handleFormChange}
                className="w-full border px-4 py-2 rounded-md"
                required
              />
              <textarea
                name="description"
                placeholder="Overall experience description..."
                value={formData.description}
                onChange={handleFormChange}
                className="w-full border px-4 py-2 rounded-md"
                rows={3}
                required 
              />

              {/* Tips */}
              <textarea
                name="tips"
                placeholder="Any tips for others..."
                value={formData.tips}
                onChange={handleFormChange}
                className="w-full border px-4 py-2 rounded-md"
                rows={2}
              />

              {/* Rounds */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Interview Rounds</h4>
                {formData.rounds.map((round, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2 bg-gray-50">
                    <input
                      type="text"
                      name="roundName"
                      placeholder="Round Name"
                      value={round.roundName}
                      onChange={(e) => handleFormChange(e, index)}
                      className="w-full border px-4 py-2 rounded-md"
                      required
                    />
                    <textarea
                      name="questions"
                      placeholder="Questions asked"
                      value={round.questions}
                      onChange={(e) => handleFormChange(e, index)}
                      className="w-full border px-4 py-2 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      name="duration"
                      placeholder="Duration"
                      value={round.duration}
                      onChange={(e) => handleFormChange(e, index)}
                      className="w-full border px-4 py-2 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newRounds = [...formData.rounds];
                        newRounds.splice(index, 1);
                        setFormData({ ...formData, rounds: newRounds });
                      }}
                      className="text-red-500 text-sm underline"
                    >
                      Remove Round
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      rounds: [...formData.rounds, { roundName: '', questions: '', duration: '' }],
                    })
                  }
                  className="text-blue-600 font-medium text-sm underline"
                >
                  + Add Another Round
                </button>
              </div>

              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      )}

      
      {isEditing && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsEditing(false)} className="absolute top-4 right-4 text-gray-500">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4 text-blue-700">Edit Your Interview Experience</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const token = localStorage.getItem('authToken');
                  await axios.put(
                    `http://localhost:5000/api/experiences/${editFormData._id}`,
                    editFormData,
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  );
                  setIsEditing(false);
                  setPage(1);
                  setLoading(true);
                  fetchExperiences(1);
                } catch (error) {
                  alert('Failed to update experience');
                  console.error(error);
                }
              }}
              className="space-y-4"
            >
              <input
                type="text"
                name="company"
                placeholder="Company"
                value={editFormData.company}
                onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                className="w-full border px-4 py-2 rounded-md"
                required
              />
              <input
                type="text"
                name="role"
                placeholder="Role"
                value={editFormData.role}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                className="w-full border px-4 py-2 rounded-md"
                required
              />
              <select
                name="difficulty"
                value={editFormData.difficulty}
                onChange={(e) => setEditFormData({ ...editFormData, difficulty: e.target.value })}
                className="w-full border px-4 py-2 rounded-md"
                required
              >
                <option value="">Select Difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              <input
                type="date"
                name="roundDate"
                value={editFormData.roundDate ? new Date(editFormData.roundDate).toISOString().slice(0, 10) : "" }
                onChange={(e) => setEditFormData({ ...editFormData, roundDate: e.target.value })}
                className="w-full border px-4 py-2 rounded-md"
                required
              />
              <textarea
                name="description"
                placeholder="Overall experience description..."
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="w-full border px-4 py-2 rounded-md"
                rows={3}
              />
              <textarea
                name="tips"
                placeholder="Any tips for others..."
                value={editFormData.tips}
                onChange={(e) => setEditFormData({ ...editFormData, tips: e.target.value })}
                className="w-full border px-4 py-2 rounded-md"
                rows={2}
              />

              {/* Edit Interview Rounds */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Interview Rounds</h4>
                {editFormData.rounds.map((round, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2 bg-gray-50">
                    <input
                      type="text"
                      name="roundName"
                      placeholder="Round Name"
                      value={round.roundName}
                      onChange={(e) => {
                        const newRounds = [...editFormData.rounds];
                        newRounds[index].roundName = e.target.value;
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="w-full border px-4 py-2 rounded-md"
                      required
                    />
                    <textarea
                      name="questions"
                      placeholder="Questions asked"
                      value={round.questions}
                      onChange={(e) => {
                        const newRounds = [...editFormData.rounds];
                        newRounds[index].questions = e.target.value;
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="w-full border px-4 py-2 rounded-md"
                      required
                    />
                    <input
                      type="text"
                      name="duration"
                      placeholder="Duration"
                      value={round.duration}
                      onChange={(e) => {
                        const newRounds = [...editFormData.rounds];
                        newRounds[index].duration = e.target.value;
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="w-full border px-4 py-2 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newRounds = [...editFormData.rounds];
                        newRounds.splice(index, 1);
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="text-red-500 text-sm underline"
                    >
                      Remove Round
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newRounds = [...editFormData.rounds, { roundName: '', questions: '', duration: '' }];
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="text-blue-600 text-sm underline"
                    >
                      + Add Round
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                Update Experience
              </button>
            </form>
          </div>
        </div>
      )}

      {page < totalPages && (
        <div className="text-center mt-4">
          <button
            onClick={() => setPage(page + 1)}
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

