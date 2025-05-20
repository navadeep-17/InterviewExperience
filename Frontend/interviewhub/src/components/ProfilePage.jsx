import { Edit, Save, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- Add this import
import ExperienceCard from "./ExperienceCard";

const API_URL = import.meta.env.VITE_API_URL;

// Helper components
const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      {...props}
      className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-400"
    />
  </div>
);

const ProfileDetail = ({ label, value }) => (
  <div>
    <span className="font-semibold">{label}:</span>{" "}
    {value ? value : <span className="text-gray-400">Not set</span>}
  </div>
);

const ProfilePage = () => {
  const [userData, setUserData] = useState({
    name: "",
    rollNumber: "",
    department: "",
    graduationYear: "",
    currentlyStudying: "",
    email: "",
    phoneNumber: "",
    avatar: "",
    _id: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [formData, setFormData] = useState(userData);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [userPosts, setUserPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // --- ExperienceCard UI State ---
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [expandedRounds, setExpandedRounds] = useState({});
  const [editingExperienceId, setEditingExperienceId] = useState(null);

  // --- Comments State ---
  const [expandedComments, setExpandedComments] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [allComments, setAllComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState(false);
  // const [sortedComments, setSortedComments] = useState([]);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyInputs, setReplyInputs] = useState({});
  const [collapsedComments, setCollapsedComments] = useState({});
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  
  const avatarOptions = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Alex",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Taylor",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jordan",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Skyler",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Casey",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Riley",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jamie",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Quinn",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Harper",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Morgan",
  // extra male‑leaning seeds
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Liam",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Ethan",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Noah",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Lucas",
];


  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const user = await res.json();
          setUserData(user);
          setFormData(user);
        }
      } catch (err) {}
      setLoading(false);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      setPostsLoading(true);
      try {
        if (userData._id) {
          const res = await fetch(`${API_URL}/api/experiences/user/${userData._id}`);
          if (res.ok) {
            let posts = await res.json();
            // Ensure each post has user info
            posts = posts.map((post) => ({
              ...post,
              user: userData,
            }));
            setUserPosts(posts);
          }
        }
      } catch (err) {
        setUserPosts([]);
      }
      setPostsLoading(false);
    };
    fetchPosts();
  }, [userData._id]);

  useEffect(() => {
    if (userPosts.length === 0) return;
    const fetchAllComments = async () => {
      const all = {};
      const counts = {};
      for (const post of userPosts) {
        try {
          const res = await fetch(`${API_URL}/api/comments/experience/${post._id}`);
          if (res.ok) {
            const comments = await res.json();
            all[post._id] = comments;
            counts[post._id] = comments.length;
          }
        } catch (err) {
          all[post._id] = [];
          counts[post._id] = 0;
        }
      }
      setAllComments(all);
      setCommentCounts(counts);
    };
    fetchAllComments();
  }, [userPosts]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setSubmitting(true);
    const token = localStorage.getItem("authToken");
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setUserData(updatedUser);
        setIsEditing(false);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setMsg("Profile updated!");
      } else {
        setError("Failed to update profile.");
      }
    } catch (err) {
      setError("Failed to update profile. Please try again.");
    }
    setSubmitting(false);
  };

  // Expand/collapse description
  const toggleDescription = (id) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Expand/collapse rounds
  const toggleRounds = (id) => {
    setExpandedRounds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Edit experience
  const handleEditExperience = (exp) => {
    setEditFormData(exp);
    setIsEditing(true);
  };

  // Delete experience
  const handleDeleteExperience = async (id) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    const token = localStorage.getItem("authToken");
    try {
      const res = await fetch(`${API_URL}/api/experiences/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUserPosts((prev) => prev.filter((post) => post._id !== id));
      }
    } catch (err) {
      // Optionally set an error state
    }
  };

  // Expand/collapse comments
  const toggleComments = (id) => {
    setExpandedComments((prev) => {
      const isNowExpanded = !prev[id];
      // If expanding and comments not loaded, fetch them
      if (isNowExpanded && !allComments[id]) {
        fetchComments(id);
      }
      return {
        ...prev,
        [id]: isNowExpanded,
      };
    });
  };

  // Fetch comments for a post
  const fetchComments = async (postId) => {
    setCommentLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/comments/experience/${postId}`);
      if (res.ok) {
        const comments = await res.json();
        setAllComments((prev) => ({
          ...prev,
          [postId]: comments,
        }));
        setCommentCounts((prev) => ({
          ...prev,
          [postId]: comments.length,
        }));
      }
    } catch (err) {
      // Optionally handle error
    }
    setCommentLoading(false);
  };

  // Post a new comment
  const handlePostComment = async (postId, textArg, parentId) => {
    // If called from reply input, textArg and parentId will be set.
    // If called from top-level input, use commentInputs[postId].
    const text = textArg !== undefined ? textArg.trim() : (commentInputs[postId]?.trim() || "");
    if (!text) return;
    setCommentLoading(true);
    const token = localStorage.getItem("authToken");
    try {
      const body = parentId
        ? { text, experienceId: postId, parentCommentId: parentId }
        : { text, experienceId: postId };
      const res = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        if (parentId) {
          setReplyInputs((prev) => ({ ...prev, [parentId]: "" }));
          setReplyingTo(null);
        } else {
          setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
        }
        await fetchComments(postId);
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  // Edit a comment
  const handleEditCommentSave = async (commentId, postId) => {
    const text = editingCommentText.trim();
    if (!text) return;
    setCommentLoading(true);
    const token = localStorage.getItem("authToken");
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setEditingCommentId(null);
        setEditingCommentText("");
        fetchComments(postId);
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  // Delete a comment
  const handleDeleteComment = async (commentId, postId) => {
    // if (!window.confirm("Delete this comment?")) return;
    const token = localStorage.getItem("authToken");
    setCommentLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchComments(postId);
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  // Post a reply to a comment
  const handlePostReply = async (postId, parentId) => {
    const text = replyInputs[parentId]?.trim();
    if (!text) return;
    setCommentLoading(true);
    const token = localStorage.getItem("authToken");
    try {
      const res = await fetch(`${API_URL}/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, experienceId: postId, parentCommentId: parentId }),
      });
      if (res.ok) {
        setReplyInputs((prev) => ({ ...prev, [parentId]: "" }));
        setReplyingTo(null);
        await fetchComments(postId);
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  // Build comment tree (for nested comments)
  const buildCommentTree = (comments) => {
    if (!Array.isArray(comments)) return [];
    const map = {};
    comments.forEach((c) => (map[c._id] = { ...c, replies: [] })); // <-- use replies
    const tree = [];
    comments.forEach((c) => {
      if (c.parentCommentId) {
        map[c.parentCommentId]?.replies.push(map[c._id]); // <-- use replies
      } else {
        tree.push(map[c._id]);
      }
    });
    return tree;
  };

  const sortedComments = (commentsArr) => {
    if (!Array.isArray(commentsArr)) return [];
    return commentsArr.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const handleUpvote = async (expId) => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(
        `${API_URL}/api/experiences/${expId}/upvote`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setUserPosts(prev =>
          prev.map(exp =>
            exp._id === expId
              ? { ...exp, upvotes: updated.upvotes, downvotes: updated.downvotes }
              : exp
          )
        );
      }
    } catch (err) {
      alert('Failed to upvote');
    }
  };

  const handleDownvote = async (expId) => {
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(
        `${API_URL}/api/experiences/${expId}/downvote`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setUserPosts(prev =>
          prev.map(exp =>
            exp._id === expId
              ? { ...exp, upvotes: updated.upvotes, downvotes: updated.downvotes }
              : exp
          )
        );
      }
    } catch (err) {
      alert('Failed to downvote');
    }
  };

  const navigate = useNavigate(); // <-- Add this hook

  if (loading) return <div className="text-center mt-10">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto mt-10 p-0 sm:p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-white rounded-2xl shadow-lg">
      {/* Go to Home Button */}
      <div className="flex justify-start mb-4">
        <button
          onClick={() => navigate("/home")}
          className="bg-blue-600 text-white px-4 py-2 rounded-md shadow hover:bg-blue-700 transition"
        >
          Go to Home
        </button>
      </div>
      {/* Profile Header */}
      <div className="flex items-center mb-8 p-6 rounded-t-2xl bg-gradient-to-r from-blue-600 to-indigo-500 shadow">
        <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg bg-gray-300 overflow-hidden flex items-center justify-center transition-transform hover:scale-105">
          {userData.avatar ? (
            <img src={userData.avatar} alt="User Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-16 h-16 text-gray-400" />
          )}
        </div>
        <div className="ml-8 flex-1">
          <h1 className="text-3xl font-bold text-white drop-shadow">{userData.name || "Your Name"}</h1>
          <p className="text-indigo-100">{userData.department || "Department"}</p>
        </div>
        <button
          onClick={() => setIsEditing((edit) => !edit)}
          className="p-2 rounded-lg text-white bg-blue-500 hover:bg-blue-700 transition"
          title="Edit Profile"
        >
          <Edit className="w-5 h-5" />
        </button>
      </div>

      {/* Suggestion Box */}
      <div className="mb-6 mx-4 p-4 bg-blue-100 border-l-4 border-blue-400 rounded shadow-sm text-blue-800">
        <strong>Tip:</strong> Keep your profile updated and share detailed interview experiences to help others!
      </div>

      {/* Edit/Profile Details */}
      <div className="mx-4 mb-8">
        {msg && <div className="text-green-600 mb-2">{msg}</div>}
        {error && <div className="text-red-600 mb-2">{error}</div>}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow p-6">
            <Input label="Name" name="name" value={formData.name || ""} onChange={handleInputChange} />
            <Input label="Department" name="department" value={formData.department || ""} onChange={handleInputChange} />
            <Input label="Graduation Year" name="graduationYear" value={formData.graduationYear || ""} onChange={handleInputChange} />
            <Input label="Email" name="email" value={formData.email || ""} onChange={handleInputChange} />
            <Input label="Roll Number" name="rollNumber" value={formData.rollNumber || ""} onChange={handleInputChange} />
            <Input label="Currently Studying" name="currentlyStudying" value={formData.currentlyStudying || ""} onChange={handleInputChange} />
            <Input label="Phone Number" name="phoneNumber" value={formData.phoneNumber || ""} onChange={handleInputChange} />
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Choose an Avatar</label>
              <div className="flex gap-3 flex-wrap">
                {avatarOptions.map((url) => (
                  <button
                    type="button"
                    key={url}
                    className={`rounded-full border-2 p-1 transition hover:scale-110 ${
                      formData.avatar === url ? "border-blue-500 ring-2 ring-blue-300" : "border-transparent"
                    }`}
                    onClick={() => setFormData((prev) => ({ ...prev, avatar: url }))}
                  >
                    <img src={url} alt="avatar" className="w-14 h-14 rounded-full" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2 shadow"
                disabled={submitting}
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
              <button
                type="button"
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 flex items-center gap-2"
                onClick={() => {
                  setIsEditing(false);
                  setFormData(userData); // Reset changes
                  setError("");
                  setMsg("");
                }}
                disabled={submitting}
              >
                <XCircle className="w-4 h-4" /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 bg-white rounded-xl shadow p-6">
            <ProfileDetail label="Roll Number" value={userData.rollNumber} />
            <ProfileDetail label="Department" value={userData.department} />
            <ProfileDetail label="Graduation Year" value={userData.graduationYear} />
            <ProfileDetail label="Currently Studying" value={userData.currentlyStudying} />
            <ProfileDetail label="Email" value={userData.email} />
            <ProfileDetail label="Phone Number" value={userData.phoneNumber} />
          </div>
        )}
      </div>

      <hr className="my-8" />

      {/* User Posts Section */}
      <div className="mx-4">
        <h2 className="text-xl font-bold mb-4 text-blue-700">Your Posts</h2>
        {postsLoading ? (
          <div className="text-gray-400">Loading posts...</div>
        ) : userPosts.length === 0 ? (
          <div className="text-gray-500">You haven't posted anything yet.</div>
        ) : (
          <div className="space-y-6">
            {userPosts.map((post) => (
              <ExperienceCard
                key={post._id}
                exp={post}
                user={userData}
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
                handleEditComment={() => {}}
                handleEditCommentSave={(postId, commentId) => handleEditCommentSave(commentId, postId)}
                handleDeleteComment={(postId, commentId) => handleDeleteComment(commentId, postId)}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                replyInputs={replyInputs}
                setReplyInputs={setReplyInputs}
                collapsedComments={collapsedComments}
                setCollapsedComments={setCollapsedComments}
                highlightedCommentId={highlightedCommentId}
                MAX_NESTING={2}
                handlePostReply={handlePostReply}
                handleUpvote={handleUpvote} 
                handleDownvote={handleDownvote} 
                voteLoading={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Experience Modal */}
      {isEditing && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditFormData(null);
              }}
              className="absolute top-4 right-4 text-gray-500"
            >
              <XCircle className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4 text-blue-700">Edit Your Interview Experience</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const token = localStorage.getItem('authToken');
                  const res = await fetch(
                    `${API_URL}/api/experiences/${editFormData._id}`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify(editFormData),
                    }
                  );
                  if (res.ok) {
                    const updated = await res.json();
                    setUserPosts((prev) =>
                      prev.map((p) => (p._id === updated._id ? { ...updated, user: userData } : p))
                    );
                    setIsEditing(false);
                    setEditFormData(null);
                  } else {
                    alert('Failed to update experience');
                  }
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
              {/* Department field removed */}
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
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const newRounds = [...editFormData.rounds, { roundName: '', questions: '', duration: '' }];
                  setEditFormData({ ...editFormData, rounds: newRounds });
                }}
                className="text-blue-600 text-sm underline mt-2"
              >
                + Add Another Round
              </button>

              {/* Move the Update Experience button to the bottom with margin */}
              <div className="flex justify-center mt-6">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                  Update Experience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
