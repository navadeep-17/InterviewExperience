import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/apiClient';

const experienceContent = data => ({
  company: data.company, role: data.role, difficulty: data.difficulty,
  roundDate: data.roundDate, description: data.description, tips: data.tips,
  rounds: data.rounds?.map(({ roundName, questions, duration }) => ({ roundName, questions, duration })),
});

export default function useHomeExperiences({ onAuthFailure }) {
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState('latest');
  const [commentCounts, setCommentCounts] = useState({});
  const [allComments, setAllComments] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [voteLoading, setVoteLoading] = useState({});
  // Input changes do not fetch, but the next page/sort request uses the latest inputs.
  const filtersRef = useRef({ company: '', role: '', department: '', difficulty: '' });

  const setFilters = filters => { filtersRef.current = filters; };

  const fetchCommentCounts = useCallback(async exps => {
    const counts = {};
    await Promise.all(exps.map(async exp => {
      try {
        const res = await apiRequest(`/api/comments/experience/${exp._id}/count`);
        if (!Number.isSafeInteger(res.count) || res.count < 0) throw new Error('Invalid count response');
        counts[exp._id] = res.count;
      } catch (err) {
        onAuthFailure(err.status);
        counts[exp._id] = 0;
      }
    }));
    setCommentCounts(prev => ({ ...prev, ...counts }));
  }, [onAuthFailure]);

  const fetchAllComments = useCallback(async expId => {
    try {
      const res = await apiRequest(`/api/comments/experience/${expId}`);
      if (!Array.isArray(res)) throw new Error('Invalid comment response');
      setAllComments(prev => ({ ...prev, [expId]: res }));
    } catch (err) {
      onAuthFailure(err.status);
      setAllComments(prev => ({ ...prev, [expId]: [] }));
    }
  }, [onAuthFailure]);

  const fetchExperiences = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      const { company, role, department, difficulty } = filtersRef.current;
      const params = { page: pageNum, limit: 10, company, role, department, difficulty, sortOrder };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      const response = await apiRequest('/api/experiences', { params });
      const exps = response.experiences;
      if (!Array.isArray(exps)) throw new Error('Invalid experience response');
      if (pageNum === 1) setExperiences(exps);
      else setExperiences(prev => [...prev, ...exps]);
      setTotalPages(response.totalPages);
      setLoading(false);
      await fetchCommentCounts(exps);
    } catch (err) {
      onAuthFailure(err.status);
      setError('Failed to load experiences.');
      setLoading(false);
    }
  }, [sortOrder, fetchCommentCounts, onAuthFailure]);

  useEffect(() => { fetchExperiences(page); }, [page, fetchExperiences]);
  useEffect(() => {
    if (experiences.length > 0) experiences.forEach(exp => fetchAllComments(exp._id));
  }, [experiences, fetchAllComments]);

  const refreshFromStart = () => {
    setPage(1);
    setLoading(true);
    return fetchExperiences(1);
  };
  const search = filters => {
    setFilters(filters);
    return refreshFromStart();
  };
  const loadMore = () => setPage(page + 1);

  const createExperience = async formData => {
    try {
      await apiRequest('/api/experiences', { method: 'POST', data: experienceContent(formData) });
      refreshFromStart();
      return true;
    } catch (error) {
      alert('Failed to post experience');
      console.error(error.data || error.message);
      return false;
    }
  };

  const updateExperience = async (id, formData) => {
    try {
      await apiRequest(`/api/experiences/${id}`, { method: 'PUT', data: experienceContent(formData) });
      refreshFromStart();
      return true;
    } catch (error) {
      alert('Failed to update experience');
      console.error(error);
      return false;
    }
  };

  const deleteExperience = async id => {
    if (!window.confirm('Are you sure you want to delete this experience?')) return;
    try {
      await apiRequest(`/api/experiences/${id}`, { method: 'DELETE' });
      refreshFromStart();
    } catch (error) {
      alert('Failed to delete experience');
      console.error(error);
    }
  };

  const postComment = async (expId, text, parentCommentId = null, onPosted) => {
    setCommentLoading(prev => ({ ...prev, [expId]: true }));
    try {
      const res = await apiRequest('/api/comments', {
        method: 'POST', data: { experienceId: expId, text, parentCommentId: parentCommentId || null },
      });
      onPosted();
      await fetchAllComments(expId);
      await fetchCommentCounts([{ _id: expId }]);
      return res;
    } catch {
      alert('Failed to post comment');
      return null;
    } finally {
      setCommentLoading(prev => ({ ...prev, [expId]: false }));
    }
  };

  const editComment = async (expId, commentId, text, onSaved) => {
    try {
      await apiRequest(`/api/comments/${commentId}`, { method: 'PUT', data: { text } });
      onSaved();
      await fetchAllComments(expId);
      await fetchCommentCounts([{ _id: expId }]);
    } catch {
      alert('Failed to update comment');
    }
  };

  const deleteComment = async (expId, commentId) => {
    try {
      await apiRequest(`/api/comments/${commentId}`, { method: 'DELETE' });
      await fetchAllComments(expId);
      await fetchCommentCounts([{ _id: expId }]);
    } catch {
      alert('Failed to delete comment');
    }
  };

  const upvote = async expId => {
    setVoteLoading(prev => ({ ...prev, [expId]: true }));
    try {
      const res = await apiRequest(`/api/experiences/${expId}/upvote`, { method: 'POST', data: {} });
      setExperiences(prev => prev.map(exp => exp._id === expId
        ? { ...exp, upvotes: res.upvotes, downvotes: res.downvotes } : exp));
    } catch {
      alert('Failed to upvote');
    }
    setVoteLoading(prev => ({ ...prev, [expId]: false }));
  };

  const downvote = async expId => {
    setVoteLoading(prev => ({ ...prev, [expId]: true }));
    try {
      const res = await apiRequest(`/api/experiences/${expId}/downvote`, { method: 'POST', data: {} });
      setExperiences(prev => prev.map(exp => exp._id === expId
        ? { ...exp, upvotes: res.upvotes, downvotes: res.downvotes } : exp));
    } catch {
      alert('Failed to downvote');
    }
    setVoteLoading(prev => ({ ...prev, [expId]: false }));
  };

  return {
    experiences, loading, error, page, totalPages, sortOrder, commentCounts, allComments,
    commentLoading, voteLoading, setFilters, search, setSortOrder, loadMore,
    createExperience, updateExperience, deleteExperience, postComment, editComment, deleteComment,
    upvote, downvote,
  };
}
