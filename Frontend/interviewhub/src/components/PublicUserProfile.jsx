import { MessageCircle, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom"; // <-- updated import
import ExperienceCard from "./ExperienceCard";

const PublicUserProfile = () => {
  const { id } = useParams();
  const [userInfo, setUserInfo] = useState(null);
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate(); // <-- add this

  // Comment-related state
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [expandedRounds, setExpandedRounds] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [allComments, setAllComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyInputs, setReplyInputs] = useState({});
  const [collapsedComments, setCollapsedComments] = useState({});
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  // Vote-related state
  const [voteLoading, setVoteLoading] = useState({});

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) setCurrentUser(JSON.parse(userStr));
  }, []);

  // Handlers
  const toggleDescription = (id) => {
    setExpandedDescriptions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleRounds = (id) => {
    setExpandedRounds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleComments = (id) => {
    setExpandedComments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Fetch user info, experiences, and comments
  useEffect(() => {
    const fetchUserAndExperiences = async () => {
      setLoading(true);
      try {
        // Fetch user info
        const userRes = await fetch(`http://localhost:5000/api/users/${id}`);
        const userData = await userRes.json();

        // Fetch user's experiences
        const expRes = await fetch(`http://localhost:5000/api/experiences/user/${id}`);
        let expData = await expRes.json();
        expData = expData.map(exp => ({ ...exp, user: userData }));

        setUserInfo(userData);
        setExperiences(expData);

        // Fetch comments for each experience
        const commentsObj = {};
        const countsObj = {};
        for (const exp of expData) {
          const res = await fetch(`http://localhost:5000/api/comments/experience/${exp._id}`);
          const comments = await res.json();
          commentsObj[exp._id] = comments;
          countsObj[exp._id] = comments.length;
        }
        setAllComments(commentsObj);
        setCommentCounts(countsObj);
      } catch (err) {
        setUserInfo(null);
        setExperiences([]);
      }
      setLoading(false);
    };
    fetchUserAndExperiences();
    // eslint-disable-next-line
  }, [id]);

  // Comment handlers (match ProfilePage signatures)
  const fetchComments = async (expId) => {
    setCommentLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/comments/experience/${expId}`);
      if (res.ok) {
        const comments = await res.json();
        setAllComments((prev) => ({
          ...prev,
          [expId]: comments,
        }));
        setCommentCounts((prev) => ({
          ...prev,
          [expId]: comments.length,
        }));
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  const handlePostComment = async (expId, textArg, parentId) => {
    const text = textArg !== undefined ? textArg.trim() : (commentInputs[expId]?.trim() || "");
    if (!text) return;
    setCommentLoading(true);
    const token = localStorage.getItem("authToken");
    try {
      const body = parentId
        ? { text, experienceId: expId, parentCommentId: parentId }
        : { text, experienceId: expId };
      const res = await fetch(`http://localhost:5000/api/comments`, {
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
          setCommentInputs((prev) => ({ ...prev, [expId]: "" }));
        }
        await fetchComments(expId);
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  const handleEditCommentSave = async (commentId, expId) => {
    const text = editingCommentText.trim();
    if (!text) return;
    setCommentLoading(true);
    const token = localStorage.getItem("authToken");
    try {
      const res = await fetch(`http://localhost:5000/api/comments/${commentId}`, {
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
        fetchComments(expId);
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  const handleDeleteComment = async (expId,commentId) => {
    // if (!window.confirm("Delete this comment?")) return;
    const token = localStorage.getItem("authToken");
    setCommentLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchComments(expId);
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  const handlePostReply = async (expId, parentId) => {
    const text = replyInputs[parentId]?.trim();
    if (!text) return;
    setCommentLoading(true);
    const token = localStorage.getItem("authToken");
    try {
      const res = await fetch(`http://localhost:5000/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, experienceId: expId, parentCommentId: parentId }),
      });
      if (res.ok) {
        setReplyInputs((prev) => ({ ...prev, [parentId]: "" }));
        setReplyingTo(null);
        await fetchComments(expId);
      }
    } catch (err) {}
    setCommentLoading(false);
  };

  const handleUpvote = async (expId) => {
    setVoteLoading(prev => ({ ...prev, [expId]: true }));
    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch(`http://localhost:5000/api/experiences/${expId}/upvote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setExperiences(prev =>
          prev.map(exp =>
            exp._id === expId
              ? { ...exp, upvotes: updated.upvotes, downvotes: updated.downvotes }
              : exp
          )
        );
      }
    } catch (err) {}
    setVoteLoading(prev => ({ ...prev, [expId]: false }));
  };

  const handleDownvote = async (expId) => {
    setVoteLoading(prev => ({ ...prev, [expId]: true }));
    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch(`http://localhost:5000/api/experiences/${expId}/downvote`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const updated = await res.json();
        setExperiences(prev =>
          prev.map(exp =>
            exp._id === expId
              ? { ...exp, upvotes: updated.upvotes, downvotes: updated.downvotes }
              : exp
          )
        );
      }
    } catch (err) {}
    setVoteLoading(prev => ({ ...prev, [expId]: false }));
  };

  // Build comment tree (for nested comments)
  const buildCommentTree = (comments) => {
    if (!Array.isArray(comments)) return [];
    const map = {};
    comments.forEach((c) => (map[c._id] = { ...c, replies: [] }));
    const tree = [];
    comments.forEach((c) => {
      if (c.parentCommentId) {
        map[c.parentCommentId]?.replies.push(map[c._id]);
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

  if (loading) return <div className="text-center mt-10">Loading...</div>;
  if (!userInfo) return <div className="text-center mt-10 text-red-500">User not found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-blue-50 to-white flex items-center justify-center py-8 px-2">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-0 sm:p-0 overflow-hidden">
        {/* Profile Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-500 p-8 flex items-center">
          <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl bg-gray-200 overflow-hidden flex items-center justify-center">
            {userInfo.avatar ? (
              <img src={userInfo.avatar} alt="User Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-16 h-16 text-gray-400" />
            )}
          </div>
          <div className="ml-8 flex-1">
            <h1 className="text-4xl font-extrabold text-white drop-shadow">{userInfo.name || "Unknown User"}</h1>
            <p className="text-indigo-100 text-lg">{userInfo.department || "Department not set"}</p>
            <p className="text-blue-200 text-sm">
              {userInfo.graduationYear && <>Graduation: {userInfo.graduationYear}</>}
            </p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => navigate(`/message?user=${userInfo._id}`)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition font-semibold"
              >
                <MessageCircle className="w-5 h-5" />
                Send Message
              </button>
            </div>
          </div>
          <div className="absolute top-6 right-6">
            <button
              onClick={() => navigate(-1)}
              className="bg-white text-blue-700 px-4 py-2 rounded-lg shadow hover:bg-blue-100 transition font-semibold"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-0 border-blue-100" />

        {/* Posts Section */}
        <div className="p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-white min-h-[300px]">
          <h2 className="text-2xl font-bold mb-6 text-blue-700 flex items-center gap-2">
            <span className="inline-block w-2 h-6 bg-blue-500 rounded-full mr-2"></span>
            Posts
          </h2>
          {experiences.length === 0 ? (
            <div className="text-gray-400 italic">No posts shared yet.</div>
          ) : (
            <div className="space-y-8">
              {experiences.map((exp) => (
                <div className="rounded-xl shadow-lg bg-white/90 border border-blue-100 p-4">
                  <ExperienceCard
                    key={exp._id}
                    exp={exp}
                    user={currentUser}
                    currentUser={currentUser}
                    expandedDescriptions={expandedDescriptions}
                    toggleDescription={toggleDescription}
                    expandedRounds={expandedRounds}
                    toggleRounds={toggleRounds}
                    expandedComments={expandedComments}
                    toggleComments={toggleComments}
                    commentCounts={commentCounts}
                    allComments={allComments}
                    commentInputs={commentInputs}
                    setCommentInputs={setCommentInputs}
                    commentLoading={commentLoading}
                    handlePostComment={(postId, text, parentId) => handlePostComment(postId, text, parentId)}
                    buildCommentTree={(comments) => buildCommentTree(comments)}
                    sortedComments={(commentsArr) => sortedComments(commentsArr)}
                    editingCommentId={editingCommentId}
                    editingCommentText={editingCommentText}
                    setEditingCommentId={setEditingCommentId}
                    setEditingCommentText={setEditingCommentText}
                    handleEditComment={(commentId, commentText) => {
                      setEditingCommentId(commentId);
                      setEditingCommentText(commentText);
                    }}
                    handleEditCommentSave={(commentId, postId) => handleEditCommentSave(commentId, postId)}
                    handleDeleteComment={(commentId, postId) => handleDeleteComment(commentId, postId)}
                    replyingTo={replyingTo}
                    setReplyingTo={setReplyingTo}
                    replyInputs={replyInputs}
                    setReplyInputs={setReplyInputs}
                    collapsedComments={collapsedComments}
                    setCollapsedComments={setCollapsedComments}
                    highlightedCommentId={highlightedCommentId}
                    MAX_NESTING={2}
                    handlePostReply={(postId, parentId) => handlePostReply(postId, parentId)}
                    handleUpvote={handleUpvote}
                    handleDownvote={handleDownvote}
                    voteLoading={voteLoading[exp._id]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicUserProfile;