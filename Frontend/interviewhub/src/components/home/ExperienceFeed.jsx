import { useState } from 'react';
import ExperienceCard from '../ExperienceCard';

const MAX_NESTING = 3;

export default function ExperienceFeed({ data, user, onEditExperience }) {
  const { experiences, loading, error, commentCounts, allComments, commentLoading, voteLoading,
    deleteExperience, postComment, editComment, deleteComment, upvote, downvote } = data;
  const [commentInputs, setCommentInputs] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [expandedComments, setExpandedComments] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyInputs, setReplyInputs] = useState({});
  const [collapsedComments, setCollapsedComments] = useState({});
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [expandedRounds, setExpandedRounds] = useState({});

  const handleEditComment = (commentId, commentText) => {
    setEditingCommentId(commentId);
    setEditingCommentText(commentText);
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

  const handlePostComment = async (expId, text, parentCommentId = null) => {
    const created = await postComment(expId, text || commentInputs[expId], parentCommentId, () => {
      if (parentCommentId) {
        setReplyInputs(prev => ({ ...prev, [parentCommentId]: '' }));
        setReplyingTo(null);
      } else {
        setCommentInputs(prev => ({ ...prev, [expId]: '' }));
      }
    });
    if (created) {
      setHighlightedCommentId(created._id);
      setTimeout(() => setHighlightedCommentId(null), 1500);
    }
  };
  const handleEditCommentSave = (expId, commentId) => editComment(expId, commentId, editingCommentText, () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  });

  return (
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
          handleEditExperience={onEditExperience}
          handleDeleteExperience={deleteExperience}
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
          handleDeleteComment={deleteComment}
          replyingTo={replyingTo}
          setReplyingTo={setReplyingTo}
          replyInputs={replyInputs}
          setReplyInputs={setReplyInputs}
          collapsedComments={collapsedComments}
          setCollapsedComments={setCollapsedComments}
          highlightedCommentId={highlightedCommentId}
          MAX_NESTING={MAX_NESTING}
          handleUpvote={upvote}
          handleDownvote={downvote}
          voteLoading={voteLoading[exp._id]}
        />
      ))}
    </div>
  );
}
