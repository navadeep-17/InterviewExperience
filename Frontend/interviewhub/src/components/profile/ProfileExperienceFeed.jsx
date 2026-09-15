import { useEffect, useState } from 'react';
import ExperienceCard from '../ExperienceCard';

const MAX_NESTING = 3;

export default function ProfileExperienceFeed({ data, mode, viewer, onEditExperience, retainedState }) {
  const { experiences, postsLoading, allComments, commentCounts, commentLoading } = data;
  // --- ExperienceCard UI State ---
  const [expandedDescriptions, setExpandedDescriptions] = useState(() => retainedState?.current?.expandedDescriptions ?? {});
  const [expandedRounds, setExpandedRounds] = useState(() => retainedState?.current?.expandedRounds ?? {});

  // --- Comments State ---
  const [expandedComments, setExpandedComments] = useState(() => retainedState?.current?.expandedComments ?? {});
  const [commentInputs, setCommentInputs] = useState(() => retainedState?.current?.commentInputs ?? {});
  const [editingCommentId, setEditingCommentId] = useState(() => retainedState?.current?.editingCommentId ?? null);
  const [editingCommentText, setEditingCommentText] = useState(() => retainedState?.current?.editingCommentText ?? "");
  const [replyingTo, setReplyingTo] = useState(() => retainedState?.current?.replyingTo ?? null);
  const [replyInputs, setReplyInputs] = useState(() => retainedState?.current?.replyInputs ?? {});
  const [collapsedComments, setCollapsedComments] = useState(() => retainedState?.current?.collapsedComments ?? {});
  const highlightedCommentId = null;

  // Public page-level loading temporarily unmounts the feed on user-ID changes.
  // Retain its existing page-lifetime drafts/expansion without moving their ownership.
  useEffect(() => {
    if (retainedState) retainedState.current = {
      expandedDescriptions, expandedRounds, expandedComments, commentInputs,
      editingCommentId, editingCommentText, replyingTo, replyInputs, collapsedComments,
    };
  }, [retainedState, expandedDescriptions, expandedRounds, expandedComments, commentInputs,
    editingCommentId, editingCommentText, replyingTo, replyInputs, collapsedComments]);

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

  // Expand/collapse comments
  const toggleComments = (id) => {
    setExpandedComments((prev) => {
      const isNowExpanded = !prev[id];
      // If expanding and comments not loaded, fetch them
      if (mode === 'own' && isNowExpanded && !allComments[id]) {
        data.fetchComments(id);
      }
      return {
        ...prev,
        [id]: isNowExpanded,
      };
    });
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

  const handlePostComment = (postId, textArg, parentId) => {
    const draft = textArg !== undefined ? textArg : commentInputs[postId];
    return data.postComment(postId, draft, parentId, () => {
      if (parentId) {
        setReplyInputs(prev => ({ ...prev, [parentId]: '' }));
        setReplyingTo(null);
      } else setCommentInputs(prev => ({ ...prev, [postId]: '' }));
    });
  };
  const handlePostReply = (postId, parentId) => handlePostComment(postId, replyInputs[parentId] || '', parentId);
  const handleEditComment = (commentId, commentText) => {
    setEditingCommentId(commentId);
    setEditingCommentText(commentText);
  };
  const handleEditCommentSave = (postId, commentId) => data.editComment(postId, commentId, editingCommentText, () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  });

  if (mode === 'own' && postsLoading) return <div className="text-slate-500">Loading posts...</div>;
  if (experiences.length === 0) return mode === 'own'
    ? <div className="text-slate-500">You haven't posted anything yet.</div>
    : <div className="text-slate-500 py-8 text-center">No posts shared yet.</div>;

  return (
    <div className={mode === 'own' ? 'space-y-6' : 'space-y-8'}>
      {experiences.map(post => {
        const card = (
          <ExperienceCard
            key={post._id}
            exp={post}
            user={viewer}
            currentUser={mode === 'public' ? viewer : undefined}
            expandedDescriptions={expandedDescriptions}
            toggleDescription={toggleDescription}
            expandedRounds={expandedRounds}
            toggleRounds={toggleRounds}
            handleEditExperience={mode === 'own' ? onEditExperience : undefined}
            handleDeleteExperience={mode === 'own' ? data.deleteExperience : undefined}
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
            handleDeleteComment={data.deleteComment}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            replyInputs={replyInputs}
            setReplyInputs={setReplyInputs}
            collapsedComments={collapsedComments}
            setCollapsedComments={setCollapsedComments}
            highlightedCommentId={highlightedCommentId}
            MAX_NESTING={MAX_NESTING}
            handlePostReply={handlePostReply}
            handleUpvote={data.upvote}
            handleDownvote={data.downvote}
            voteLoading={mode === 'own' ? false : data.voteLoading[post._id]}
          />
        );
        return mode === 'public'
          ? <div key={post._id} className="min-w-0">{card}</div>
          : card;
      })}
    </div>
  );
}
