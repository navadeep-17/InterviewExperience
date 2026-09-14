import debounce from 'lodash.debounce';
import { useCallback, useEffect, useMemo, useState } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL, apiRequest } from '../services/apiClient';

export default function useMessaging({ currentUser, authToken, onSocketAuthFailure }) {
  const currentUserId = currentUser?._id;
  const [socket] = useState(() => io(API_BASE_URL, { autoConnect: false }));
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({}); // { userId: [msg, ...] }
  const [groupMessages, setGroupMessages] = useState([]); // For selected group
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Debounced typing event
  const emitTyping = useMemo(() => debounce(() => {
    if (selectedUser && socket.connected) {
      socket.emit('typing', { to: selectedUser._id });
    }
  }, 400), [socket, selectedUser]);
  useEffect(() => () => emitTyping.cancel(), [emitTyping]);

  // Fetch users from backend (excluding current user)
  useEffect(() => {
    if (!currentUserId) {
      setUsers([]);
      return;
    }
    apiRequest(`/api/auth/all`)
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data.filter(u => u._id !== currentUserId));
        } else {
          setUsers([]);
        }
      })
      .catch(() => setUsers([]));
  }, [currentUserId]);

  // Fetch groups for the current user
  useEffect(() => {
    if (!currentUserId) return;
    apiRequest(`/api/groups`)
      .then(data => { if (Array.isArray(data)) setGroups(data); })
      .catch(() => setGroups([]));
  }, [currentUserId]);

  // Identity is established by the authenticated handshake, never a register event.
  useEffect(() => {
    if (!authToken) return;
    const onConnectError = error => {
      if (error.data?.code === 'UNAUTHORIZED' || error.data?.code === 'FORBIDDEN') {
        socket.disconnect();
        socket.auth = {};
        onSocketAuthFailure();
      }
    };
    socket.on('connect_error', onConnectError);
    socket.auth = { token: authToken };
    socket.connect();
    return () => {
      socket.off('connect_error', onConnectError);
      socket.disconnect();
      socket.auth = {};
    };
  }, [socket, authToken, onSocketAuthFailure]);

  // Receive personal messages
  useEffect(() => {
    const onPersonalMessage = (data) => {
      const userId = data.senderId === currentUserId ? data.recipientId : data.senderId;
      setMessages(prev => {
        const userMsgs = prev[userId] || [];
        if (data._id && userMsgs.some(msg => msg._id === data._id)) return prev;
        if (!data._id && userMsgs.some(msg =>
          msg.content === data.content &&
          msg.timestamp === data.timestamp &&
          msg.senderId === data.senderId
        )) return prev;
        return {
          ...prev,
          [userId]: [
            ...userMsgs,
            { ...data, sender: data.senderId === currentUserId ? 'me' : 'them' }
          ]
        };
      });
    };
    socket.on('receive_message', onPersonalMessage);
    return () => socket.off('receive_message', onPersonalMessage);
  }, [socket, currentUserId]);

  // Receive group messages
  useEffect(() => {
    const onGroupMessage = (data) => {
      setGroupMessages(prev => {
        if (data._id && prev.some(msg => msg._id === data._id)) return prev;
        if (!data._id && prev.some(msg =>
          msg.content === data.content &&
          msg.timestamp === data.timestamp &&
          msg.senderId === data.senderId
        )) return prev;
        return [...prev, data];
      });
    };
    socket.on('receive_group_message', onGroupMessage);
    return () => socket.off('receive_group_message', onGroupMessage);
  }, [socket]);

  // Typing indicator
  useEffect(() => {
    const onTyping = (data) => {
      if (selectedUser && data.from === selectedUser._id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 1500);
      }
    };
    socket.on('typing', onTyping);
    return () => socket.off('typing', onTyping);
  }, [socket, selectedUser]);

  const sendMessage = (newMessage) => {
    if (!newMessage.trim() || !socket.connected) return false;

    if (selectedUser) {
      const newMsg = {
        recipientId: selectedUser._id,
        content: newMessage,
      };
      socket.emit('send_message', newMsg);
      return true;
    }

    if (selectedGroup) {
      const groupMsg = {
        groupId: selectedGroup._id,
        content: newMessage,
      };
      socket.emit('send_group_message', groupMsg);
      return true;
    }
    return false;
  };

  // Only messages between current user and selected user
  const currentMessages = selectedUser && messages[selectedUser._id]
    ? messages[selectedUser._id]
    : [];

  // Paginated fetch for messages
  useEffect(() => {
    let cancelled = false;
    if (selectedUser) {
      setLoadingMore(true);
      apiRequest(`/api/messages/${selectedUser._id}?page=${page}&limit=20`)
        .then(data => {
          if (cancelled) return;
          if (!Array.isArray(data?.messages) || typeof data.hasMore !== 'boolean') {
            throw new Error('Invalid conversation response');
          }
          const newMsgs = data.messages;
          setMessages(prev => {
            const prevMsgs = prev[selectedUser._id] || [];
            const allMsgs = page === 1 ? newMsgs : [...newMsgs, ...prevMsgs];
            // Remove duplicates by _id
            const uniqueMsgs = Array.from(new Map(allMsgs.map(m => [m._id, m])).values());
            return {
              ...prev,
              [selectedUser._id]: uniqueMsgs
            };
          });
          setHasMore(data.hasMore);
        })
        .catch(() => { /* Preserve already loaded messages on failed requests. */ })
        .finally(() => { if (!cancelled) setLoadingMore(false); });
    }
    return () => { cancelled = true; };
  }, [selectedUser, page]);

  // Fetch group messages when a group is selected
  useEffect(() => {
    let cancelled = false;
    if (selectedGroup) {
      setGroupMessages([]); // Clear messages when switching group
      setLoadingMore(true);
      apiRequest(`/api/groups/${selectedGroup._id}/messages`)
        .then(data => {
          if (!cancelled && Array.isArray(data)) setGroupMessages(data);
        })
        .catch(() => { /* Failed responses must not replace message data. */ })
        .finally(() => { if (!cancelled) setLoadingMore(false); });
    }
    return () => { cancelled = true; };
  }, [selectedGroup]);

  // Calculate unread counts
  useEffect(() => {
    if (!currentUserId) return;
    const counts = {};
    Object.keys(messages).forEach(userId => {
      (messages[userId] || []).forEach(msg => {
        if (
          !msg.isRead &&
          msg.recipientId === currentUserId &&
          msg.senderId
        ) {
          counts[msg.senderId] = (counts[msg.senderId] || 0) + 1;
        }
      });
    });
    setUnreadCounts(counts);
  }, [messages, currentUserId]);

  // Mark messages as read when a user is selected
  useEffect(() => {
    if (selectedUser) {
      apiRequest(`/api/messages/markAsRead`, { method: 'POST', data: { senderId: selectedUser._id } })
        .then(() => {
          setUnreadCounts(prev => ({ ...prev, [selectedUser._id]: 0 }));
        })
        .catch(() => { /* Keep unread state when the request fails. */ });
    }
  }, [selectedUser]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    // No need to clear messages here, as they're stored per user
  }, [selectedUser]);

  const handleDeleteMessage = async (messageId) => {
    try {
      await apiRequest(`/api/messages/${messageId}`, { method: 'DELETE' });
      if (selectedUser) {
        setMessages(prev => ({
          ...prev,
          [selectedUser._id]: (prev[selectedUser._id] || []).filter(msg => msg._id !== messageId)
        }));
      }
    } catch {
      // Keep messages when deletion fails.
    }
  };

  const handleDeleteGroupMessage = async (messageId) => {
    try {
      await apiRequest(`/api/groups/messages/${messageId}`, { method: 'DELETE' });
      setGroupMessages(prev => prev.filter(msg => msg._id !== messageId));
    } catch {
      // Keep messages when deletion fails.
    }
  };

  const selectUser = useCallback(user => { setSelectedUser(user); setSelectedGroup(null); }, []);
  const selectGroup = useCallback(group => { setSelectedUser(null); setSelectedGroup(group); }, []);
  const loadMore = () => setPage(prev => prev + 1);

  return {
    users, groups, selectedUser, selectedGroup, currentMessages, groupMessages, unreadCounts,
    page, hasMore, loadingMore, isTyping, selectUser, selectGroup, loadMore, sendMessage,
    emitTyping, handleDeleteMessage, handleDeleteGroupMessage,
  };
}
