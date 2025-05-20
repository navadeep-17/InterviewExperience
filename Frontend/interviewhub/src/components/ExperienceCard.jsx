import { ArrowBigDown, ArrowBigUp, MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom"; // Add this import
import CommentSection from './CommentSection';
const API_URL = import.meta.env.VITE_API_URL;
const ExperienceCard = ({
  exp,
  user,
  expandedDescriptions,
  toggleDescription,
  expandedRounds,
  toggleRounds,
  handleEditExperience,
  handleDeleteExperience,
  expandedComments,
  toggleComments,
  commentCounts,
  allComments,
  commentInputs,
  setCommentInputs,
  commentLoading,
  handlePostComment,
  buildCommentTree,
  sortedComments,
  editingCommentId,
  editingCommentText,
  setEditingCommentId,
  setEditingCommentText,
  handleEditComment,
  handleEditCommentSave,
  handleDeleteComment,
  replyingTo,
  setReplyingTo,
  replyInputs,
  setReplyInputs,
  collapsedComments,
  setCollapsedComments,
  highlightedCommentId,
  MAX_NESTING,
  handleUpvote,
  handleDownvote,
  voteLoading,
}) => {
  const navigate = useNavigate(); // Add this hook
  const location = useLocation(); // Add this

  // Only show Edit/Delete if on /profile and it's the user's own post
  const isProfilePage = location.pathname === "/profile";

  return (
    <div className="bg-white shadow-md rounded-xl p-5 border border-slate-200 mb-2
                    w-full max-w-2xl mx-auto
                    sm:p-6 sm:mb-4">
      <div className="flex items-center gap-4 mb-3">
        <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
          <img
            src={
              exp.user?.avatar
                ? exp.user.avatar.startsWith('http')
                  ? exp.user.avatar
                  : `${API_URL}/${exp.user.avatar}`
                : "https://ui-avatars.com/api/?name=" + encodeURIComponent(exp.user?.name || "U")
            }
            alt={exp.user?.name || "user"}
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <p
            className={`font-semibold text-gray-800 cursor-pointer transition-colors duration-200
              ${user && exp.user?._id !== user._id ? "hover:underline hover:text-indigo-600" : ""}
            `}
            onClick={() => {
              if (user && exp.user?._id !== user._id) {
                navigate(`/user/${exp.user?._id}`);
              }
            }}
            title={user && exp.user?._id !== user._id ? "View Profile" : ""}
            style={{ userSelect: "text" }}
          >
            {exp.user?.name || 'Unknown'}
          </p>
          <p className="text-xs text-gray-500">
            Posted on {new Date(exp.date || exp.createdAt).toLocaleString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-blue-700 mb-1">{exp.company}</h3>
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{exp.role}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          exp.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
          exp.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>{exp.difficulty}</span>
        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-medium">{exp.user?.department}</span>
        {exp.roundDate && (
          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
            {new Date(exp.roundDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
      <p className="text-gray-800 mb-4">
        {exp.description.length > 200 && !expandedDescriptions[exp._id]
          ? (
            <>
              {exp.description.slice(0, 200)}...
              <button
                className="text-blue-600 ml-2 text-xs underline"
                onClick={() => toggleDescription(exp._id)}
              >
                Read more
              </button>
            </>
          )
          : (
            <>
              {exp.description}
              {exp.description.length > 200 && (
                <button
                  className="text-blue-600 ml-2 text-xs underline"
                  onClick={() => toggleDescription(exp._id)}
                >
                  Show less
                </button>
              )}
            </>
          )
        }
      </p>
      {exp.rounds && exp.rounds.length > 0 && (
        <div className="mb-4">
          <button
            className="font-semibold text-gray-700 mb-2 flex items-center gap-2 text-sm"
            onClick={() => toggleRounds(exp._id)}
          >
            Interview Rounds
            <span className="text-blue-500">{expandedRounds[exp._id] ? '▲' : '▼'}</span>
          </button>
          {expandedRounds[exp._id] && (
            <ul className="space-y-2 text-sm text-gray-700 mt-2">
              {exp.rounds.map((round, idx) => (
                <li key={idx} className="border border-gray-200 p-3 rounded-lg bg-gray-50">
                  <p className="font-semibold text-blue-600">{round.roundName}</p>
                  <p><span className="font-medium text-gray-600">Questions:</span> {round.questions}</p>
                  <p><span className="font-medium text-gray-600">Duration:</span> {round.duration}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {exp.tips && (
        <div className="mb-4">
          <h4 className="font-semibold text-gray-700 mb-1">Tips:</h4>
          <p className="text-sm text-gray-600">{exp.tips}</p>
        </div>
      )}
      {isProfilePage && user && exp.user?._id === user._id && (
        <div className="flex gap-4 mt-2">
          <button
            onClick={() => handleEditExperience(exp)}
            className="text-sm text-blue-600 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => handleDeleteExperience(exp._id)}
            className="text-sm text-red-600 hover:underline"
          >
            Delete
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
        {/* Votes */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hover:bg-blue-50 rounded-full p-2 transition"
            aria-label="Upvote"
            onClick={() => handleUpvote(exp._id)}
            disabled={voteLoading}
          >
            <ArrowBigUp className="w-7 h-7 sm:w-9 sm:h-9" />
          </button>
          <span className="font-semibold text-green-700 text-base sm:text-lg">{exp.upvotes || 0}</span>
          <button
            type="button"
            className="hover:bg-red-50 rounded-full p-2 transition"
            aria-label="Downvote"
            onClick={() => handleDownvote(exp._id)}
            disabled={voteLoading}
          >
            <ArrowBigDown className="w-7 h-7 sm:w-9 sm:h-9" />
          </button>
          <span className="font-semibold text-red-700 text-base sm:text-lg">{exp.downvotes || 0}</span>
        </div>
        {/* Comments */}
        <button
          className="flex items-center gap-1 text-blue-700 font-semibold"
          onClick={() => toggleComments(exp._id)}
        >
          <MessageCircle className="w-6 h-6" />
          {commentCounts[exp._id] > 0 ? (
            <span>
              {commentCounts[exp._id]} Comment{commentCounts[exp._id] !== 1 ? 's' : ''}
            </span>
          ) : (
            <span>No comments yet</span>
          )}
        </button>
      </div>

      {expandedComments[exp._id] && (
        <CommentSection
          exp={exp}
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
          user={user}
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
        />
      )}
    </div>
  );
};

export default ExperienceCard;