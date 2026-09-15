import { useEffect, useRef, useState } from 'react';
import ChatAvatar from './ChatAvatar';

const SingleTick = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
    <path d="M5 13l4 4L19 7" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DoubleTick = ({ seen }) => (
  <svg width="22" height="18" viewBox="0 0 28 18" fill="none" style={{ display: 'inline', verticalAlign: 'middle' }}>
    <path d="M5 10l4 4L19 4" stroke={seen ? "#c7d2fe" : "#e2e8f0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 10l4 4L25 2" stroke={seen ? "#c7d2fe" : "#e2e8f0"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
      className="flex-1 px-2 sm:px-4 py-4 sm:py-6 overflow-y-auto space-y-4 bg-slate-50"
      ref={messagesContainerRef}
      onScroll={handleScroll}
      style={{ minHeight: 0 }}
    >
      {loadingMore && (
        <div className="flex justify-center my-2">
          <span className="text-xs text-slate-500">Loading...</span>
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
              <div className={`max-w-[78%] sm:max-w-[70%] min-w-0 break-words px-3 sm:px-4 py-3 rounded-2xl text-sm relative shadow-sm
                ${isMe ? 'ml-auto bg-indigo-600 text-white' : 'mr-auto bg-slate-100 text-slate-900 border border-slate-200'}
              `}>
                <div className="flex flex-wrap gap-1 justify-between items-center mb-1">
                  <span className="font-semibold">{isMe ? "You" : msg.senderName}</span>
                  <span className="text-xs opacity-80 ml-2">
                    {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="relative flex items-center">
                  <span className="pr-6 min-w-0 [overflow-wrap:anywhere]">{msg.content}</span>
                  {isMe && msg._id && (
                    <div className="relative">
                      <button
                        aria-label="More options"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:text-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl"
                        onClick={e => {
                          e.stopPropagation();
                          setDropdownOpen(dropdownOpen === `group-${idx}` ? null : `group-${idx}`);
                        }}
                      >
                        ⋮
                      </button>
                      {dropdownOpen === `group-${idx}` && (
                        <div className="absolute right-0 mt-2 w-24 bg-white border rounded-xl shadow-sm z-10">
                          <button
                            className="block w-full text-left px-4 py-2.5 text-sm hover:bg-red-100 text-red-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl"
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
                  <span className="bg-white border border-slate-200 text-slate-500 px-4 py-1 rounded-full text-xs font-medium shadow-sm">
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
                  className={`max-w-[78%] sm:max-w-[70%] min-w-0 break-words px-3 sm:px-4 py-3 rounded-2xl text-sm relative shadow-sm
                    ${isMe
                      ? 'ml-auto bg-indigo-600 text-white'
                      : 'mr-auto bg-slate-100 text-slate-900 border border-slate-200'}
                    ${isSameSenderAsPrev ? 'mt-1' : 'mt-4'}`}
                >
                  {!isSameSenderAsPrev && (
                    <div className="flex flex-wrap gap-1 justify-between items-center mb-1">
                      <span className="font-semibold">{senderLabel}</span>
                      <span className="text-xs opacity-80 ml-2 flex items-center gap-1">
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
                      <span className="text-xs opacity-80 ml-2 flex items-center gap-1">
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
                    <span className="pr-6 min-w-0 [overflow-wrap:anywhere]">{msg.content}</span>
                    {isMe && msg._id && (
                      <div className="relative">
                        <button
                          aria-label="More options"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:text-indigo-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl"
                          onClick={e => {
                            e.stopPropagation();
                            setDropdownOpen(dropdownOpen === idx ? null : idx);
                          }}
                        >
                          ⋮
                        </button>
                        {dropdownOpen === idx && (
                          <div className="absolute right-0 mt-2 w-24 bg-white border rounded-xl shadow-sm z-10">
                            <button
                              className="block w-full text-left px-4 py-2.5 text-sm hover:bg-red-100 text-red-600 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl"
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
        <div className="text-xs text-indigo-500 mb-2">{selectedUser?.name} is typing...</div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
