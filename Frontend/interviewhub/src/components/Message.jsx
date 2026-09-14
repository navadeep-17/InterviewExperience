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

      <ChatSidebar open={sidebarOpen} users={users} groups={groups}
        selectedUser={selectedUser} selectedGroup={selectedGroup}
        onBack={() => navigate('/home')} onViewProfile={id => navigate(`/user/${id}`)}
        onSelectUser={selectUser} onSelectGroup={selectGroup} />

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
              <ChatAvatar user={selectedUser} size={44} />
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
            <ChatAvatar user={selectedUser} size={36} />
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
