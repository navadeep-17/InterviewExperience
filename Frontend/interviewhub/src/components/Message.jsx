import debounce from 'lodash.debounce';
import { MessageSquare, Send, User2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const SingleTick = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
    <path d="M5 13l4 4L19 7" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DoubleTick = ({ seen }) => (
  <svg width="22" height="18" viewBox="0 0 28 18" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
    <path d="M5 10l4 4L19 4" stroke={seen ? "#4fc3f7" : "#888"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 10l4 4L25 2" stroke={seen ? "#4fc3f7" : "#888"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function getDateLabel(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return date.toLocaleDateString();
}

const MessageComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState({}); // { userId: [msg, ...] }
  const [groupMessages, setGroupMessages] = useState([]); // For selected group
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Add this at the top of your component

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef();
  const typingTimeout = useRef();

  // Debounced typing event
  const emitTyping = debounce(() => {
    if (selectedUser) {
      socket.emit('typing', { to: selectedUser._id, from: currentUser._id });
    }
  }, 400);

  // Fetch users from backend (excluding current user)
  useEffect(() => {
    if (!currentUser || !currentUser._id) {
      setUsers([]);
      return;
    }
    fetch('http://localhost:5000/api/auth/all', {
      headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data.filter(u => u._id !== currentUser._id));
        } else {
          setUsers([]);
        }
      })
      .catch(() => setUsers([]));
  }, [currentUser?._id]);

  // Fetch groups for the current user
  useEffect(() => {
    if (!currentUser || !currentUser._id) return;
    fetch('http://localhost:5000/api/groups', {
      headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
    })
      .then(res => res.json())
      .then(data => setGroups(data))
      .catch(() => setGroups([]));
  }, [currentUser?._id]);

  // Register current user with socket
  useEffect(() => {
    if (currentUser?._id) {
      socket.emit('register', currentUser._id);
    }
  }, [currentUser?._id]);

  // Receive personal messages
  useEffect(() => {
    socket.on('receive_message', (data) => {
      const userId = data.senderId === currentUser._id ? data.recipientId : data.senderId;
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
            { ...data, sender: data.senderId === currentUser._id ? 'me' : 'them' }
          ]
        };
      });
    });
    return () => socket.off('receive_message');
  }, [currentUser?._id]);

  // Receive group messages
  useEffect(() => {
    socket.on('receive_group_message', (data) => {
      setGroupMessages(prev => {
        if (data._id && prev.some(msg => msg._id === data._id)) return prev;
        if (!data._id && prev.some(msg =>
          msg.content === data.content &&
          msg.timestamp === data.timestamp &&
          msg.senderId === data.senderId
        )) return prev;
        return [...prev, data];
      });
    });
    return () => socket.off('receive_group_message');
  }, []);

  // Typing indicator
  useEffect(() => {
    socket.on('typing', (data) => {
      if (selectedUser && data.from === selectedUser._id) {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 1500);
      }
    });
    return () => socket.off('typing');
  }, [selectedUser]);

  const handleSend = () => {
    if (!newMessage.trim()) return;

    if (selectedUser) {
      const newMsg = {
        senderId: currentUser._id,
        recipientId: selectedUser._id,
        content: newMessage,
        senderName: currentUser.name,
        timestamp: new Date(),
      };
      socket.emit('send_message', newMsg);
      setNewMessage('');
      return;
    }

    if (selectedGroup) {
      const groupMsg = {
        groupId: selectedGroup._id,
        senderId: currentUser._id,
        senderName: currentUser.name,
        content: newMessage,
        timestamp: new Date(),
      };
      socket.emit('send_group_message', groupMsg);
      setNewMessage('');
    }
  };

  // Only messages between current user and selected user
  const currentMessages = selectedUser && messages[selectedUser._id]
    ? messages[selectedUser._id]
    : [];

  // Paginated fetch for messages
  useEffect(() => {
    if (selectedUser) {
      setLoadingMore(true);
      fetch(`http://localhost:5000/api/auth/messages/${selectedUser._id}?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      })
        .then(res => res.json())
        .then(data => {
          const newMsgs = Array.isArray(data.messages)
            ? data.messages
            : Array.isArray(data)
              ? data
              : [];
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
          setHasMore(data.hasMore !== undefined ? data.hasMore : false);
          setLoadingMore(false);
        });
    }
  }, [selectedUser, page]);

  // Fetch group messages when a group is selected
  useEffect(() => {
    if (selectedGroup) {
      setGroupMessages([]); // Clear messages when switching group
      setLoadingMore(true);
      fetch(`http://localhost:5000/api/groups/${selectedGroup._id}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      })
        .then(res => res.json())
        .then(data => {
          setGroupMessages(Array.isArray(data) ? data : []);
          setLoadingMore(false);
        })
        .catch(() => {
          setGroupMessages([]);
          setLoadingMore(false);
        });
    }
  }, [selectedGroup]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedUser, selectedGroup, currentMessages, groupMessages]);

  // Calculate unread counts
  useEffect(() => {
    if (!currentUser || !currentUser._id) return;
    const counts = {};
    Object.keys(messages).forEach(userId => {
      (messages[userId] || []).forEach(msg => {
        if (
          !msg.isRead &&
          msg.recipientId === currentUser._id &&
          msg.senderId
        ) {
          counts[msg.senderId] = (counts[msg.senderId] || 0) + 1;
        }
      });
    });
    setUnreadCounts(counts);
  }, [messages, currentUser?._id]);

  // Mark messages as read when a user is selected
  useEffect(() => {
    if (selectedUser) {
      fetch('http://localhost:5000/api/messages/markAsRead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: selectedUser._id, recipientId: currentUser._id })
      });
      setUnreadCounts(prev => ({ ...prev, [selectedUser._id]: 0 }));
    }
  }, [selectedUser]);

  const handleScroll = () => {
    if (
      messagesContainerRef.current &&
      messagesContainerRef.current.scrollTop === 0 &&
      hasMore &&
      !loadingMore
    ) {
      setPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    // No need to clear messages here, as they're stored per user
  }, [selectedUser]);

  const handleDeleteMessage = async (messageId) => {
    await fetch(`http://localhost:5000/api/auth/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    if (selectedUser) {
      setMessages(prev => ({
        ...prev,
        [selectedUser._id]: (prev[selectedUser._id] || []).filter(msg => msg._id !== messageId)
      }));
    }
  };

  const handleDeleteGroupMessage = async (messageId) => {
    await fetch(`http://localhost:5000/api/groups/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`
      }
    });
    setGroupMessages(prev => prev.filter(msg => msg._id !== messageId));
  };

  // Add this helper for avatar rendering
  const UserAvatar = ({ user, size = 32 }) => (
    user?.avatar ? (
      <img
        src={user.avatar}
        alt={user.name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    ) : (
      <div
        className="rounded-full bg-blue-200 flex items-center justify-center font-bold text-blue-800"
        style={{ width: size, height: size }}
      >
        {user?.name?.charAt(0) || "?"}
      </div>
    )
  );

  useEffect(() => {
    const handleClick = () => setDropdownOpen(null);
    if (dropdownOpen !== null) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [dropdownOpen]);

  // Only run if users are loaded and no user is selected yet
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('user');
    if (userId && users.length > 0 && !selectedUser) {
      const found = users.find(u => u._id === userId);
      if (found) {
        setSelectedUser(found);
        setSelectedGroup(null);
      }
    }
    // eslint-disable-next-line
  }, [location.search, users]);

  if (!currentUser || !currentUser._id) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Please log in to view your messages.
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 text-gray-800">
      {/* Mobile Top Bar */}
      <div className="flex md:hidden items-center justify-between bg-gradient-to-r from-blue-600 to-blue-400 text-white px-4 py-3 shadow z-20">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Open sidebar"
        >
          <MessageSquare className="w-7 h-7" />
        </button>
        <span className="text-lg font-bold">Chats</span>
        <div className="w-7" /> {/* Spacer */}
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 bg-white border-r shadow-lg flex flex-col w-72 max-w-full
          transform transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:static md:translate-x-0 md:w-80 md:max-w-xs
        `}
        style={{ height: '100vh' }}
      >
        
        <div className="p-4 flex justify-center md:justify-start">
          <button
            onClick={() => navigate('/home')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm font-semibold w-full md:w-auto"
          >
            Back to Dashboard
          </button>
        </div>
        {/* Sidebar Title */}
        <div className="p-6 text-2xl font-bold flex items-center gap-3 border-b bg-gradient-to-r from-blue-600 to-blue-400 text-white shadow">
          <MessageSquare className="w-7 h-7" />
          Chats
        </div>
        <div className="p-4 bg-blue-50 border-b">
          <input
            type="text"
            className="w-full px-4 py-2 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            placeholder="Search users..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul className="divide-y">
            {(Array.isArray(users) ? users : [])
              .filter(user => user.name.toLowerCase().includes(search.toLowerCase()))
              .map(user => (
                <li
                  key={user._id}
                  className={`p-4 flex items-center gap-3 cursor-pointer transition rounded-lg mx-2 my-1
                    ${selectedUser?._id === user._id ? 'bg-blue-100 font-semibold shadow' : 'hover:bg-blue-50'}
                  `}
                >
                  <div
                    className="flex items-center gap-3 flex-1"
                    onClick={() => {
                      setSelectedUser(user);
                      setSelectedGroup(null);
                    }}
                  >
                    <UserAvatar user={user} size={44} />
                    <span className="truncate">{user.name}</span>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      navigate(`/user/${user._id}`);
                    }}
                    className="ml-auto p-2 rounded-full hover:bg-blue-100 transition"
                    title="View Profile"
                  >
                    <User2 className="w-5 h-5 text-blue-600" />
                  </button>
                </li>
              ))}
          </ul>
          {/* Groups Section */}
          <div className="mt-6 font-bold text-blue-700 px-6">Groups</div>
          <ul className="divide-y">
            {groups.map(group => (
              <li
                key={group._id}
                onClick={() => {
                  setSelectedUser(null);
                  setSelectedGroup(group);
                }}
                className={`p-4 flex items-center gap-3 cursor-pointer transition rounded-lg mx-2 my-1
                  ${selectedGroup?._id === group._id ? 'bg-blue-100 font-semibold shadow' : 'hover:bg-blue-50'}
                `}
              >
                <UserAvatar user={group} size={44} />
                <span className="flex-1 truncate">{group.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat Window */}
      <main className="flex-1 flex flex-col bg-white rounded-tl-3xl shadow-lg overflow-hidden h-[100dvh] md:h-auto">
        {/* Desktop Chat Header */}
        <div className="hidden md:flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-100 to-blue-50 shadow-sm">
          <div className="flex items-center gap-4">
            {selectedUser && (
              <UserAvatar user={selectedUser} size={44} />
            )}
            <h3
              className={`text-xl font-bold text-blue-700 cursor-pointer hover:underline`}
              onClick={() => {
                if (selectedUser) navigate(`/user/${selectedUser._id}`);
              }}
              title={selectedUser ? "View Public Profile" : ""}
              style={{ userSelect: "text" }}
            >
              {selectedUser
                ? selectedUser.name
                : selectedGroup
                ? `Group: ${selectedGroup.name}`
                : 'Select a user or group to chat'}
            </h3>
          </div>
        </div>
        {/* Mobile Chat Header */}
        <div className="flex md:hidden items-center gap-3 p-4 border-b bg-gradient-to-r from-blue-100 to-blue-50 shadow-sm">
          {selectedUser && (
            <UserAvatar user={selectedUser} size={36} />
          )}
          <h3
            className="text-base font-bold text-blue-700 truncate cursor-pointer hover:underline"
            onClick={() => {
              if (selectedUser) navigate(`/user/${selectedUser._id}`);
            }}
            title={selectedUser ? "View Public Profile" : ""}
            style={{ userSelect: "text" }}
          >
            {selectedUser
              ? selectedUser.name
              : selectedGroup
              ? `Group: ${selectedGroup.name}`
              : 'Select a chat'}
          </h3>
        </div>

        <div
          className="flex-1 px-2 sm:px-4 py-4 sm:py-6 overflow-y-auto space-y-4 bg-gradient-to-br from-blue-50 via-white to-blue-100"
          ref={messagesContainerRef}
          onScroll={handleScroll}
          style={{ minHeight: 0 }}
        >
          {loadingMore && (
            <div className="flex justify-center my-2">
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          )}
          {/* Render group messages */}
          {selectedGroup &&
            groupMessages.map((msg, idx) => {
              const isMe = msg.senderId === currentUser._id;
              return (
                <div key={msg._id || idx} className={`flex items-end ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                  {!isMe && (
                    <div className="mr-2">
                      <UserAvatar user={{ name: msg.senderName, avatar: msg.senderAvatar }} size={36} />
                    </div>
                  )}
                  <div className={`max-w-[70%] px-5 py-3 rounded-2xl text-sm relative shadow
                    ${isMe ? 'ml-auto bg-blue-500 text-white' : 'mr-auto bg-white border'}
                  `}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold">{isMe ? "You" : msg.senderName}</span>
                      <span className="text-xs text-gray-300 ml-2">
                        {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <span className="pr-8">{msg.content}</span>
                      {isMe && msg._id && (
                        <div className="relative">
                          <button
                            aria-label="More options"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:text-blue-200"
                            onClick={e => {
                              e.stopPropagation();
                              setDropdownOpen(dropdownOpen === `group-${idx}` ? null : `group-${idx}`);
                            }}
                          >
                            ⋮
                          </button>
                          {dropdownOpen === `group-${idx}` && (
                            <div className="absolute right-0 mt-2 w-24 bg-white border rounded shadow z-10">
                              <button
                                className="block w-full text-left px-4 py-2 text-sm hover:bg-red-100 text-red-600"
                                onClick={() => {
                                  handleDeleteGroupMessage(msg._id);
                                  setDropdownOpen(null);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {isMe && (
                    <div className="ml-2">
                      <UserAvatar user={currentUser} size={36} />
                    </div>
                  )}
                </div>
              );
            })}
          {selectedUser &&
            currentMessages.map((msg, idx) => {
              const isMe = msg.senderId === currentUser._id;
              const senderLabel = isMe ? "You" : selectedUser.name;
              const time = msg.timestamp
                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : "";

              // Date separator logic
              const prevMsg = currentMessages[idx - 1];
              const showDateSeparator =
                idx === 0 ||
                (prevMsg && new Date(prevMsg.timestamp).toDateString() !== new Date(msg.timestamp).toDateString());

              // Grouping logic
              const isSameSenderAsPrev = prevMsg && prevMsg.senderId === msg.senderId &&
                new Date(prevMsg.timestamp).toDateString() === new Date(msg.timestamp).toDateString();

              // Get user info for avatar
              const senderUser = isMe ? currentUser : selectedUser;

              return (
                <div key={msg._id || idx}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-4">
                      <span className="bg-blue-200 text-blue-700 px-4 py-1 rounded-full text-xs font-medium shadow">
                        {getDateLabel(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`flex items-end ${isMe ? 'justify-end' : 'justify-start'} mb-2`}
                  >
                    {!isMe && (
                      <div className="mr-2">
                        <UserAvatar user={{ name: senderLabel, avatar: msg.senderAvatar }} size={36} />
                      </div>
                    )}
                    <div
                      className={`max-w-[70%] px-5 py-3 rounded-2xl text-sm relative shadow
                        ${isMe
                          ? 'ml-auto bg-blue-500 text-white'
                          : 'mr-auto bg-white border'}
                        ${isSameSenderAsPrev ? 'mt-1' : 'mt-4'}`}
                    >
                      {!isSameSenderAsPrev && (
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold">{senderLabel}</span>
                          <span className="text-xs text-gray-300 ml-2 flex items-center gap-1">
                            {time}
                            {isMe && (
                              msg.isRead
                                ? <DoubleTick seen={true} />
                                : <SingleTick />
                            )}
                          </span>
                        </div>
                      )}
                      {isSameSenderAsPrev && (
                        <div className="flex justify-end items-center mb-1">
                          <span className="text-xs text-gray-300 ml-2 flex items-center gap-1">
                            {time}
                            {isMe && (
                              msg.isRead
                                ? <DoubleTick seen={true} />
                                : <SingleTick />
                            )}
                          </span>
                        </div>
                      )}
                      <div className="relative flex items-center">
                        <span className="pr-8">{msg.content}</span>
                        {isMe && msg._id && (
                          <div className="relative">
                            <button
                              aria-label="More options"
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:text-blue-200"
                              onClick={e => {
                                e.stopPropagation();
                                setDropdownOpen(dropdownOpen === idx ? null : idx);
                              }}
                            >
                              ⋮
                            </button>
                            {dropdownOpen === idx && (
                              <div className="absolute right-0 mt-2 w-24 bg-white border rounded shadow z-10">
                                <button
                                  className="block w-full text-left px-4 py-2 text-sm hover:bg-red-100 text-red-600"
                                  onClick={() => {
                                    handleDeleteMessage(msg._id);
                                    setDropdownOpen(null);
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isMe && (
                      <div className="ml-2">
                        <UserAvatar user={currentUser} size={36} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          {isTyping && (
            <div className="text-xs text-blue-500 mb-2">{selectedUser?.name} is typing...</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {(selectedUser || selectedGroup) && (
          <div className="flex items-center p-3 sm:p-5 border-t bg-gradient-to-r from-blue-100 to-blue-50">
            <input
              type="text"
              className="flex-1 border border-blue-300 rounded-l-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-sm"
              placeholder="Type a message..."
              value={newMessage}
              onChange={e => {
                setNewMessage(e.target.value);
                if (selectedUser) emitTyping();
              }}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
            />
            <button
              onClick={handleSend}
              className="bg-blue-600 text-white px-4 py-2 rounded-r-full hover:bg-blue-700 flex items-center justify-center transition"
              disabled={!newMessage.trim()}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default MessageComponent;