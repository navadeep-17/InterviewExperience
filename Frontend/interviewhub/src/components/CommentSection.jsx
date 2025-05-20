import CommentThread from './CommentThread';

const CommentSection = ({
  exp,
  expandedComments,
  toggleComments,
  commentCounts,
  allComments,
  commentInputs,
  setCommentInputs,
  commentLoading,
  handlePostComment,
  renderComments,
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
  <div className="relative mt-8 border-t pt-6 w-full max-w-2xl mx-auto">
    {/* Fixed comment input at the top */}
    <div
      className="sticky top-0 z-10 bg-white border-b rounded-t-lg px-3 py-2 shadow-sm flex items-center gap-2"
      style={{ minHeight: 56 }}
    >
      <input
        type="text"
        placeholder="Add a comment..."
        value={commentInputs[exp._id] || ""}
        onChange={e =>
          setCommentInputs({ ...commentInputs, [exp._id]: e.target.value })
        }
        className="flex-1 px-3 py-2 border border-gray-200 rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm bg-transparent transition"
        disabled={commentLoading[exp._id]}
        onKeyDown={e => {
          if (e.key === 'Enter' && commentInputs[exp._id]?.trim()) {
            handlePostComment(exp._id);
          }
        }}
        aria-label="Add a comment"
      />
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow hover:bg-blue-700 transition disabled:opacity-60"
        disabled={commentLoading[exp._id] || !(commentInputs[exp._id] && commentInputs[exp._id].trim())}
        onClick={() => handlePostComment(exp._id)}
        aria-label="Post comment"
      >
        Post
      </button>
    </div>
    {/* Comments list, scrollable if too long */}
    <div className="space-y-3 max-h-[60vh] overflow-y-auto px-1 py-4 sm:px-2">
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
        <div className="text-xs text-gray-400 italic text-center">No comments yet.</div>
      )}
    </div>
  </div>
);

export default CommentSection;