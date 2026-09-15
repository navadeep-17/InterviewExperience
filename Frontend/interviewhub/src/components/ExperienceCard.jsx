import { ArrowBigDown, ArrowBigUp, MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom"; // Add this import
import CommentSection from './CommentSection';
import { API_BASE_URL } from '../services/apiClient';
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
    <div className="bg-white shadow-sm rounded-2xl p-4 sm:p-6 border border-slate-200 w-full min-w-0 max-w-2xl mx-auto break-words">
      <div className="flex items-center gap-4 mb-3">
        <div className="shrink-0 w-11 h-11 rounded-full bg-slate-200 overflow-hidden">
          <img
            src={
              exp.user?.avatar
                ? exp.user.avatar.startsWith('http')
                  ? exp.user.avatar
                  : `${API_BASE_URL}/${exp.user.avatar}`
                : "https://ui-avatars.com/api/?name=" + encodeURIComponent(exp.user?.name || "U")
            }
            alt={exp.user?.name || "user"}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          {user && exp.user?._id !== user._id ? (
            <button type="button"
              className="font-semibold text-slate-900 text-left cursor-pointer transition-colors duration-200 hover:underline hover:text-indigo-600 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100"
              onClick={() => navigate(`/user/${exp.user?._id}`)}
              title="View Profile" style={{ userSelect: "text" }}
            >
              {exp.user?.name || 'Unknown'}
            </button>
          ) : (
            <p className="font-semibold text-slate-900" style={{ userSelect: "text" }}>{exp.user?.name || 'Unknown'}</p>
          )}
          <p className="text-xs text-slate-500">
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
      <h3 className="text-lg font-semibold text-indigo-700 mb-1">{exp.company}</h3>
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">{exp.role}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          exp.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700' :
          exp.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>{exp.difficulty}</span>
        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-medium">{exp.user?.department}</span>
        {exp.roundDate && (
          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
            {new Date(exp.roundDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
      <p className="text-slate-600 leading-relaxed mb-4">
        {exp.description.length > 200 && !expandedDescriptions[exp._id]
          ? (
            <>
              {exp.description.slice(0, 200)}...
              <button
                className="text-indigo-600 ml-2 text-xs underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
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
                  className="text-indigo-600 ml-2 text-xs underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
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
            className="font-semibold text-slate-700 mb-2 flex items-center gap-2 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl"
            onClick={() => toggleRounds(exp._id)}
          >
            Interview Rounds
            <span className="text-indigo-500">{expandedRounds[exp._id] ? '▲' : '▼'}</span>
          </button>
          {expandedRounds[exp._id] && (
            <ul className="space-y-2 text-sm text-slate-700 mt-2">
              {exp.rounds.map((round, idx) => (
                <li key={idx} className="border border-slate-200 p-3 rounded-xl bg-slate-50">
                  <p className="font-semibold text-indigo-600">{round.roundName}</p>
                  <p><span className="font-medium text-slate-600">Questions:</span> {round.questions}</p>
                  <p><span className="font-medium text-slate-600">Duration:</span> {round.duration}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {exp.tips && (
        <div className="mb-4">
          <h4 className="font-semibold text-slate-700 mb-1">Tips:</h4>
          <p className="text-sm text-slate-600">{exp.tips}</p>
        </div>
      )}
      {isProfilePage && user && exp.user?._id === user._id && (
        <div className="flex gap-4 mt-2">
          <button
            onClick={() => handleEditExperience(exp)}
            className="text-sm text-indigo-600 hover:underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
          >
            Edit
          </button>
          <button
            onClick={() => handleDeleteExperience(exp._id)}
            className="text-sm text-red-600 hover:underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
          >
            Delete
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
        {/* Votes */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hover:bg-indigo-50 rounded-xl p-2.5 transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
            aria-label="Upvote"
            onClick={() => handleUpvote(exp._id)}
            disabled={voteLoading}
          >
            <ArrowBigUp className="w-5 h-5" />
          </button>
          <span className="font-semibold text-slate-600 text-sm">{exp.upvotes || 0}</span>
          <button
            type="button"
            className="hover:bg-slate-100 rounded-xl p-2.5 transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
            aria-label="Downvote"
            onClick={() => handleDownvote(exp._id)}
            disabled={voteLoading}
          >
            <ArrowBigDown className="w-5 h-5" />
          </button>
          <span className="font-semibold text-slate-600 text-sm">{exp.downvotes || 0}</span>
        </div>
        {/* Comments */}
        <button
          className="flex items-center gap-1 text-indigo-700 font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl"
          onClick={() => toggleComments(exp._id)}
        >
          <MessageCircle className="w-5 h-5" />
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