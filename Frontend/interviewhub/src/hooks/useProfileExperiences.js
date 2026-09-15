import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/apiClient';

const experienceContent = data => ({
  company: data.company, role: data.role, difficulty: data.difficulty,
  roundDate: data.roundDate, description: data.description, tips: data.tips,
  rounds: data.rounds?.map(({ roundName, questions, duration }) => ({ roundName, questions, duration })),
});

export default function useProfileExperiences({ profileUser, mode, onAuthFailure, onFatalReadFailure }) {
  const [experiences, setExperiences] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [allComments, setAllComments] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [commentLoading, setCommentLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState({});
  const profileRef = useRef(profileUser);
  profileRef.current = profileUser;
  const profileId = profileUser?._id;

  const readContent = useCallback(async url => {
    try {
      return await apiRequest(url);
    } catch (error) {
      onAuthFailure(error.status);
      throw error;
    }
  }, [onAuthFailure]);

  const readComments = useCallback(async experienceId => {
    const comments = await readContent(`/api/comments/experience/${experienceId}`);
    if (!Array.isArray(comments)) throw new Error('Invalid comment response');
    return comments;
  }, [readContent]);

  const preloadComments = useCallback(async posts => {
    const all = {};
    const counts = {};
    for (const post of posts) {
      try {
        const comments = await readComments(post._id);
        all[post._id] = comments;
        counts[post._id] = comments.length;
      } catch (error) {
        if (mode === 'public') throw error;
        all[post._id] = [];
        counts[post._id] = 0;
      }
    }
    setAllComments(all);
    setCommentCounts(counts);
  }, [mode, readComments]);

  // Public pages await this after their user read to retain combined initial loading.
  const loadExperiences = useCallback(async user => {
    setPostsLoading(true);
    try {
      if (user?._id) {
        const response = await readContent(`/api/experiences/user/${user._id}`);
        if (!Array.isArray(response)) throw new Error('Invalid experience response');
        const posts = response.map(post => ({ ...post, user }));
        setExperiences(posts);
        if (mode === 'public') await preloadComments(posts);
      }
      return true;
    } catch {
      setExperiences([]);
      if (mode === 'public') onFatalReadFailure();
      return false;
    } finally {
      setPostsLoading(false);
    }
  }, [mode, readContent, preloadComments, onFatalReadFailure]);

  useEffect(() => {
    // As before, editing profile details without changing the ID does not reload posts.
    if (mode === 'own') loadExperiences(profileRef.current);
  }, [mode, profileId, loadExperiences]);

  useEffect(() => {
    // Own profiles also preload after local post changes; public profiles preload once per load.
    if (mode === 'own' && experiences.length > 0) preloadComments(experiences);
  }, [mode, experiences, preloadComments]);

  const fetchComments = async experienceId => {
    setCommentLoading(true);
    try {
      const comments = await readComments(experienceId);
      setAllComments(prev => ({ ...prev, [experienceId]: comments }));
      setCommentCounts(prev => ({ ...prev, [experienceId]: comments.length }));
    } catch { /* Keep loaded comments on a failed refresh. */ }
    setCommentLoading(false);
  };

  const postComment = async (experienceId, draft, parentCommentId, onPosted) => {
    const text = draft?.trim() || '';
    if (!text) return;
    setCommentLoading(true);
    try {
      const body = parentCommentId ? { text, experienceId, parentCommentId } : { text, experienceId };
      await apiRequest('/api/comments', { method: 'POST', data: body });
      onPosted();
      await fetchComments(experienceId);
    } catch { /* Failed writes preserve the draft. */ }
    setCommentLoading(false);
  };

  const editComment = async (experienceId, commentId, draft, onSaved) => {
    const text = draft.trim();
    if (!text) return;
    setCommentLoading(true);
    try {
      await apiRequest(`/api/comments/${commentId}`, { method: 'PUT', data: { text } });
      onSaved();
      fetchComments(experienceId);
    } catch { /* Failed writes preserve the editor. */ }
    setCommentLoading(false);
  };

  const deleteComment = async (experienceId, commentId) => {
    setCommentLoading(true);
    try {
      await apiRequest(`/api/comments/${commentId}`, { method: 'DELETE' });
      fetchComments(experienceId);
    } catch { /* Failed deletes preserve comments. */ }
    setCommentLoading(false);
  };

  const vote = async (experienceId, direction) => {
    if (mode === 'public') setVoteLoading(prev => ({ ...prev, [experienceId]: true }));
    try {
      const updated = await apiRequest(`/api/experiences/${experienceId}/${direction}`, { method: 'POST' });
      setExperiences(prev => prev.map(exp => exp._id === experienceId
        ? { ...exp, upvotes: updated.upvotes, downvotes: updated.downvotes } : exp));
    } catch (error) {
      if (mode === 'own' && error.status === undefined) alert(`Failed to ${direction}`);
    }
    if (mode === 'public') setVoteLoading(prev => ({ ...prev, [experienceId]: false }));
  };
  const upvote = id => vote(id, 'upvote');
  const downvote = id => vote(id, 'downvote');

  const deleteExperience = async id => {
    if (mode !== 'own' || !window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await apiRequest(`/api/experiences/${id}`, { method: 'DELETE' });
      setExperiences(prev => prev.filter(post => post._id !== id));
    } catch { /* Failed deletes preserve posts. */ }
  };

  const updateExperience = async (id, editFormData) => {
    if (mode !== 'own') return false;
    try {
      const updated = await apiRequest(`/api/experiences/${id}`, { method: 'PUT', data: experienceContent(editFormData) });
      setExperiences(prev => prev.map(post => post._id === updated._id ? { ...updated, user: profileUser } : post));
      return true;
    } catch (error) {
      alert('Failed to update experience');
      console.error(error);
      return false;
    }
  };

  return {
    experiences, postsLoading, allComments, commentCounts, commentLoading, voteLoading,
    loadExperiences, fetchComments, postComment, editComment, deleteComment,
    upvote, downvote, deleteExperience, updateExperience,
  };
}
