import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Send, MessageSquare } from 'lucide-react';

const socket = io('http://localhost:5000'); // Replace with your server URL

const usersMock = [
  { id: 1, name: 'Aman Sharma' },
  { id: 2, name: 'Neha Verma' },
  { id: 3, name: 'Raj Patel' }
];

const MessageComponent = () => {
  const [selectedUser, setSelectedUser] = useState(usersMock[0]);
  const [messages, setMessages] = useState([
    { sender: 'me', content: 'Hey!', userId: 1 },
    { sender: 'them', content: 'Hi there!', userId: 1 }
  ]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => socket.off('receive_message');
  }, []);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    const newMsg = { sender: 'me', content: newMessage, userId: selectedUser.id };
    setMessages((prev) => [...prev, newMsg]);
    socket.emit('send_message', { ...newMsg, sender: 'them' });
    setNewMessage('');
  };

  const currentMessages = messages.filter(msg => msg.userId === selectedUser.id);

  return (
    <div className="flex h-screen bg-[#f8f9fa] text-gray-800">
      {/* User List Sidebar */}
      <aside className="w-72 bg-white border-r shadow-md overflow-y-auto">
        <div className="p-5 text-2xl font-bold flex items-center gap-2 border-b">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          Chats
        </div>
        <ul className="divide-y">
          {usersMock.map(user => (
            <li
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-blue-50 transition ${
                selectedUser.id === user.id ? 'bg-blue-100 font-semibold' : ''
              }`}
            >
              <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center font-bold text-blue-800">
                {user.name.charAt(0)}
              </div>
              <span>{user.name}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Chat Window */}
      <main className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-white shadow-sm">
          <h3 className="text-lg font-semibold">Chat with {selectedUser.name}</h3>
        </div>

        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50">
          {currentMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`max-w-[70%] px-5 py-3 rounded-xl text-sm ${
                msg.sender === 'me'
                  ? 'ml-auto bg-blue-500 text-white'
                  : 'mr-auto bg-white border'
              }`}
            >
              {msg.content}
            </div>
          ))}
        </div>

        <div className="flex items-center p-4 border-t bg-white">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-l-full px-5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            className="bg-blue-600 text-white px-4 py-2 rounded-r-full hover:bg-blue-700 flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </main>
    </div>
  );
};

export default MessageComponent;
