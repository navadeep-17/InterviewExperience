import { MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMessaging from '../hooks/useMessaging';
import ChatSidebar from './messages/ChatSidebar';
import MessageList from './messages/MessageList';
import MessageComposer from './messages/MessageComposer';
import ChatAvatar from './messages/ChatAvatar';

const MessageComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = JSON.parse(localStorage.getItem('user'));
  const authToken = localStorage.getItem('authToken');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleSocketAuthFailure = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  }, [navigate]);
  useEffect(() => {
    if (!authToken) navigate('/login', { replace: true });
  }, [authToken, navigate]);

  const data = useMessaging({ currentUser, authToken, onSocketAuthFailure: handleSocketAuthFailure });
  const { users, groups, selectedUser, selectedGroup, selectUser, selectGroup } = data;
  const handleSelectUser = user => {
    selectUser(user);
    setSidebarOpen(false);
  };
  const handleSelectGroup = group => {
    selectGroup(group);
    setSidebarOpen(false);
  };
  // Preserve query/directory-triggered preselection without reselecting after a group click.
  const selectedUserRef = useRef(selectedUser);
  selectedUserRef.current = selectedUser;
  // Only run if users are loaded and no user is selected yet
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('user');
    if (userId && users.length > 0 && !selectedUserRef.current) {
      const found = users.find(u => u._id === userId);
      if (found) {
        selectUser(found);
      }
    }
  }, [location.search, users, selectUser]);

  if (!currentUser || !currentUser._id) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500">
        Please log in to view your messages.
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-slate-50 text-slate-900 overflow-hidden">
      {/* Mobile Top Bar */}
      <div className="flex shrink-0 md:hidden items-center justify-between bg-white border-b border-slate-200 text-indigo-700 px-4 py-2 z-20">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
          aria-label="Open sidebar" aria-controls="chat-navigation" aria-expanded={sidebarOpen}
        >
          <MessageSquare className="w-7 h-7" />
        </button>
        <span className="text-lg font-bold">Chats</span>
        <div className="w-7" /> {/* Spacer */}
      </div>

      <ChatSidebar open={sidebarOpen} users={users} groups={groups}
        selectedUser={selectedUser} selectedGroup={selectedGroup}
        onBack={() => navigate('/home')} onViewProfile={id => navigate(`/user/${id}`)}
        onClose={() => setSidebarOpen(false)}
        onSelectUser={handleSelectUser} onSelectGroup={handleSelectGroup} />

      {/* Backdrop for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Chat Window */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
        {/* Desktop Chat Header */}
        <div className="hidden md:flex shrink-0 items-center justify-between p-5 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4">
            {selectedUser && (
              <ChatAvatar user={selectedUser} size={44} />
            )}
            <h3 className="text-xl font-bold text-indigo-700" style={{ userSelect: "text" }}>
              {selectedUser ? (
                <button type="button" onClick={() => navigate(`/user/${selectedUser._id}`)}
                  className="text-left hover:underline rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100" title="View Public Profile">
                  {selectedUser.name}
                </button>
              ) : selectedGroup ? `Group: ${selectedGroup.name}` : 'Select a user or group to chat'}
            </h3>
          </div>
        </div>
        {/* Mobile Chat Header */}
        <div className="flex shrink-0 md:hidden items-center gap-3 p-4 border-b border-slate-200 bg-slate-50">
          {selectedUser && (
            <ChatAvatar user={selectedUser} size={36} />
          )}
          <h3 className="text-base truncate font-bold text-indigo-700" style={{ userSelect: "text" }}>
            {selectedUser ? (
              <button type="button" onClick={() => navigate(`/user/${selectedUser._id}`)}
                className="text-left hover:underline rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 max-w-full truncate" title="View Public Profile">
                {selectedUser.name}
              </button>
            ) : selectedGroup ? `Group: ${selectedGroup.name}` : 'Select a chat'}
          </h3>
        </div>

        <MessageList currentUser={currentUser} selectedUser={selectedUser} selectedGroup={selectedGroup}
          currentMessages={data.currentMessages} groupMessages={data.groupMessages}
          page={data.page} hasMore={data.hasMore} loadingMore={data.loadingMore} isTyping={data.isTyping}
          onLoadMore={data.loadMore} handleDeleteMessage={data.handleDeleteMessage}
          handleDeleteGroupMessage={data.handleDeleteGroupMessage} />
        <MessageComposer visible={Boolean(selectedUser || selectedGroup)} personal={Boolean(selectedUser)}
          onTyping={data.emitTyping} onSend={data.sendMessage} />
      </main>
    </div>
  );
};

export default MessageComponent;
