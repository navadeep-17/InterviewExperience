import CommentThread from './CommentThread';

const CommentSection = ({
  exp,
  allComments,
  commentInputs,
  setCommentInputs,
  commentLoading,
  handlePostComment,
  buildCommentTree,
  sortedComments,
  user,
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
}) => (
  <div className="relative mt-5 border-t border-slate-200 pt-4 w-full min-w-0 max-w-2xl mx-auto">
    {/* Fixed comment input at the top */}
    <div
      className="sticky top-0 z-10 bg-white border-b border-slate-200 py-2 flex items-center gap-2"
      style={{ minHeight: 56 }}
    >
      <input
        type="text"
        placeholder="Add a comment..."
        value={commentInputs[exp._id] || ""}
        onChange={e =>
          setCommentInputs({ ...commentInputs, [exp._id]: e.target.value })
        }
        className="flex-1 min-w-0 px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none text-sm transition focus:outline-none focus:border-indigo-500 bg-white text-slate-900 placeholder:text-slate-500"
        disabled={commentLoading[exp._id]}
        onKeyDown={e => {
          if (e.key === 'Enter' && commentInputs[exp._id]?.trim()) {
            handlePostComment(exp._id);
          }
        }}
        aria-label="Add a comment"
      />
      <button
        className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-colors"
        disabled={commentLoading[exp._id] || !(commentInputs[exp._id] && commentInputs[exp._id].trim())}
        onClick={() => handlePostComment(exp._id)}
        aria-label="Post comment"
      >
        Post
      </button>
    </div>
    {/* Comments list, scrollable if too long */}
    <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1 py-4">
      {allComments[exp._id] && allComments[exp._id].length > 0 ? (
        <CommentThread
          comments={buildCommentTree(sortedComments(allComments[exp._id]))}
          expId={exp._id}
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
          handlePostComment={handlePostComment}
          collapsedComments={collapsedComments}
          setCollapsedComments={setCollapsedComments}
          highlightedCommentId={highlightedCommentId}
          MAX_NESTING={MAX_NESTING}
        />
      ) : (
        <div className="text-xs text-slate-500 italic text-center">No comments yet.</div>
      )}
    </div>
  </div>
);

export default CommentSection;