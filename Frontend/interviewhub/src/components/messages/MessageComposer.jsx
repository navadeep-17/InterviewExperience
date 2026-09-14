import { useState } from 'react';
import { Send } from 'lucide-react';

export default function MessageComposer({ visible, personal, onTyping, onSend }) {
  const [newMessage, setNewMessage] = useState('');
  const handleSend = () => {
    if (onSend(newMessage)) setNewMessage('');
  };
  if (!visible) return null;
  return (
    <div className="flex items-center p-3 sm:p-5 border-t bg-gradient-to-r from-blue-100 to-blue-50">
      <input
        type="text"
        className="flex-1 border border-blue-300 rounded-l-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-sm"
        placeholder="Type a message..."
        value={newMessage}
        onChange={e => {
          setNewMessage(e.target.value);
          if (personal) onTyping();
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
  );
}
