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
          borderLeft: level > 0 ? '2px solid #60a5fa' : 'none',
          background: isHighlighted
            ? '#fef9c3'
            : level > 0
            ? '#f9fafb'
            : '#fff',
          paddingLeft: level > 0 ? 8 : 0,
          marginTop: 8,
          borderRadius: 8,
          boxShadow: level === 0 ? '0 1px 6px rgba(0,0,0,0.03)' : 'none',
          fontSize: level > 0 ? '0.96em' : '1em',
          paddingTop: 8,
          paddingBottom: 8,
          transition: 'background 0.5s'
        }}
        className={`flex items-start gap-2 border border-gray-100 hover:shadow-md transition group ${isHighlighted ? 'ring-2 ring-yellow-300' : ''} sm:gap-3`}
      >
        <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-base overflow-hidden shadow-sm border border-blue-200">
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
            <span className="font-semibold text-gray-900 truncate max-w-[90px] sm:max-w-[160px]">{comment.user?.name || "Someone"}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">
              {comment.createdAt ? dayjs(comment.createdAt).fromNow() : ""}
            </span>
            {user && comment.user?._id === user._id && (
              <span className="ml-2 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                {editingCommentId === comment._id ? (
                  <>
                    <button
                      className="text-xs text-green-600 hover:underline focus:underline"
                      onClick={() => handleEditCommentSave(expId, comment._id)}
                      title="Save"
                    >
                      Save
                    </button>
                    <button
                      className="text-xs text-gray-500 hover:underline focus:underline"
                      onClick={() => setEditingCommentId(null)}
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="text-xs text-blue-600 hover:underline focus:underline"
                      onClick={() => handleEditComment(comment._id, comment.text)}
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      className="text-xs text-red-500 hover:underline focus:underline"
                      onClick={() => handleDeleteComment(expId, comment._id)}
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
            <div className="text-xs text-blue-400 mb-1">
              Replying to {comment.parentName}
            </div>
          )}
          <div className="text-gray-800 text-sm break-words">
            {editingCommentId === comment._id ? (
              <input
                type="text"
                value={editingCommentText}
                onChange={e => setEditingCommentText(e.target.value)}
                className="border px-2 py-1 rounded w-full text-sm focus:ring-2 focus:ring-blue-200"
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
            <button
              className="text-xs text-blue-500 hover:underline focus:underline"
              onClick={() => setReplyingTo(comment._id)}
            >
              Reply
            </button>
            {replyingTo === comment._id && (
              <div className="flex items-center gap-2 mt-2 w-full">
                <input
                  type="text"
                  value={replyInputs[comment._id] || ""}
                  onChange={e =>
                    setReplyInputs({ ...replyInputs, [comment._id]: e.target.value })
                  }
                  className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-200"
                  placeholder="Write a reply..."
                  onKeyDown={e => {
                    if (e.key === 'Enter' && replyInputs[comment._id]?.trim()) {
                      handlePostComment(expId, replyInputs[comment._id], comment._id);
                    }
                  }}
                />
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-semibold shadow hover:bg-blue-700 transition disabled:opacity-60"
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
                className="text-xs text-gray-500 hover:underline focus:underline ml-2"
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
            <div className="text-xs text-gray-400 mt-2 ml-2">
              Further replies are hidden to keep the thread readable.
            </div>
          )}
        </div>
      </div>
    );
  });
};

export default CommentThread;