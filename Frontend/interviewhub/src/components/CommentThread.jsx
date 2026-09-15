import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const CommentThread = ({
  comments,
  expId,
  level = 0,
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
  handlePostComment,
  collapsedComments,
  setCollapsedComments,
  highlightedCommentId,
  MAX_NESTING
}) => {
  return comments.map(comment => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isCollapsed = collapsedComments[comment._id];
    const isHighlighted = highlightedCommentId === comment._id;

    return (
      <div
        key={comment._id}
        style={{
          marginLeft: level === 0 ? 0 : 8,
          borderLeft: level > 0 ? '2px solid #c7d2fe' : 'none',
          background: isHighlighted
            ? '#fef3c7'
            : level > 0
            ? '#f8fafc'
            : '#fff',
          paddingLeft: level > 0 ? 8 : 0,
          marginTop: 8,
          borderRadius: 12,
          boxShadow: level === 0 ? '0 1px 2px rgba(15,23,42,0.04)' : 'none',
          fontSize: level > 0 ? '0.96em' : '1em',
          paddingTop: 8,
          paddingBottom: 8,
          transition: 'background 0.5s'
        }}
        className={`flex items-start gap-2 border border-slate-200 px-2 transition group ${isHighlighted ? 'ring-2 ring-amber-300' : ''} sm:gap-3`}
      >
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-base overflow-hidden shadow-sm border border-slate-200">
          {comment.user?.avatar ? (
            <img src={comment.user.avatar} alt="avatar" className="w-full h-full object-cover rounded-full" />
          ) : (
            comment.user?.name
              ? comment.user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2)
              : "U"
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
            <span className="font-semibold text-slate-900 truncate max-w-[90px] sm:max-w-[160px]">{comment.user?.name || "Someone"}</span>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {comment.createdAt ? dayjs(comment.createdAt).fromNow() : ""}
            </span>
            {user && comment.user?._id === user._id && (
              <span className="flex flex-wrap gap-2 sm:ml-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition">
                {editingCommentId === comment._id ? (
                  <>
                    <button
                      className="text-xs text-indigo-700 hover:underline focus:underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
                      onClick={() => handleEditCommentSave(expId, comment._id)}
                      title="Save"
                    >
                      Save
                    </button>
                    <button
                      className="text-xs text-slate-500 hover:underline focus:underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
                      onClick={() => setEditingCommentId(null)}
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="text-xs text-indigo-600 hover:underline focus:underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
                      onClick={() => handleEditComment(comment._id, comment.text)}
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs text-red-500 hover:underline focus:underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
                      onClick={() => {
                        if (!window.confirm('Delete this comment? Any replies under it will also be removed.')) return;
                        handleDeleteComment(expId, comment._id);
                      }}
                      title="Delete"
                    >
                      Delete
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
          {/* Replying to label */}
          {level > 0 && comment.parentName && (
            <div className="text-xs text-indigo-700 mb-1">
              Replying to {comment.parentName}
            </div>
          )}
          <div className="text-slate-900 text-sm break-words">
            {editingCommentId === comment._id ? (
              <input
                type="text"
                aria-label="Edit comment" value={editingCommentText}
                onChange={e => setEditingCommentText(e.target.value)}
                className="border px-2 py-2.5 rounded-xl w-full text-sm focus:ring-4 focus:ring-indigo-100 focus:outline-none focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleEditCommentSave(expId, comment._id);
                  if (e.key === 'Escape') setEditingCommentId(null);
                }}
                autoFocus
              />
            ) : (
              comment.text
            )}
          </div>
          {/* Reply Button and Input */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {level + 1 < MAX_NESTING && <button
              className="text-xs text-indigo-700 hover:underline focus:underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
              onClick={() => setReplyingTo(comment._id)}
            >
              Reply
            </button>}
            {level + 1 < MAX_NESTING && replyingTo === comment._id && (
              <div className="flex items-center gap-2 mt-2 w-full">
                <input aria-label="Write a reply..."
                  type="text"
                  value={replyInputs[comment._id] || ""}
                  onChange={e =>
                    setReplyInputs({ ...replyInputs, [comment._id]: e.target.value })
                  }
                  className="flex-1 min-w-0 px-2 py-2.5 border rounded-xl text-sm focus:ring-4 focus:ring-indigo-100 focus:outline-none focus:border-indigo-500 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                  placeholder="Write a reply..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && replyInputs[comment._id]?.trim()) {
                      handlePostComment(expId, replyInputs[comment._id], comment._id);
                    }
                  }}
                />
                <button
                  className="bg-indigo-600 text-white px-3 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 transition disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-colors"
                  onClick={() =>
                    handlePostComment(expId, replyInputs[comment._id], comment._id)
                  }
                  disabled={!replyInputs[comment._id]?.trim()}
                >
                  Post
                </button>
              </div>
            )}
            {/* Collapse/Expand Replies Button */}
            {hasReplies && (
              <button
                className="text-xs text-slate-500 hover:underline focus:underline ml-2 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
                onClick={() =>
                  setCollapsedComments(prev => ({
                    ...prev,
                    [comment._id]: !prev[comment._id]
                  }))
                }
              >
                {isCollapsed ? `Show Replies (${comment.replies.length})` : `Hide Replies`}
              </button>
            )}
          </div>
          {/* Render Replies, limit nesting */}
          {hasReplies && !isCollapsed && level + 1 < MAX_NESTING &&
            <CommentThread
              comments={comment.replies}
              expId={expId}
              level={level + 1}
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
          }
          {/* If max depth reached, show a message */}
          {hasReplies && !isCollapsed && level + 1 === MAX_NESTING && (
            <div className="text-xs text-slate-500 mt-2 ml-2">
              Further replies are hidden to keep the thread readable.
            </div>
          )}
        </div>
      </div>
    );
  });
};

export default CommentThread;