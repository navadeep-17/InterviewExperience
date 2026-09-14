import { useEffect, useRef, useState } from 'react';
import ChatAvatar from './ChatAvatar';

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

export default function MessageList({ currentUser, selectedUser, selectedGroup, currentMessages, groupMessages,
  page, hasMore, loadingMore, isTyping, onLoadMore, handleDeleteMessage, handleDeleteGroupMessage }) {
  const [dropdownOpen, setDropdownOpen] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef();
  // Page controls whether a message change scrolls; pagination alone is not a scroll trigger.
  const pageRef = useRef(page);
  pageRef.current = page;
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && (!selectedUser || pageRef.current === 1)) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedUser, selectedGroup, currentMessages, groupMessages]);

  const handleScroll = () => {
    if (
      messagesContainerRef.current &&
      messagesContainerRef.current.scrollTop === 0 &&
      hasMore &&
      !loadingMore
    ) {
      onLoadMore();
    }
  };

  useEffect(() => {
    const handleClick = () => setDropdownOpen(null);
    if (dropdownOpen !== null) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [dropdownOpen]);

  return (
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
                  <ChatAvatar user={{ name: msg.senderName, avatar: msg.senderAvatar }} size={36} />
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
                  <ChatAvatar user={currentUser} size={36} />
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
                    <ChatAvatar user={{ name: senderLabel, avatar: msg.senderAvatar }} size={36} />
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
                    <ChatAvatar user={currentUser} size={36} />
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
  );
}
