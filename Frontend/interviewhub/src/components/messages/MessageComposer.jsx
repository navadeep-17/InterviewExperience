import { useState } from 'react';
import { Send } from 'lucide-react';

export default function MessageComposer({ visible, personal, onTyping, onSend }) {
  const [newMessage, setNewMessage] = useState('');
  const handleSend = () => {
    if (onSend(newMessage)) setNewMessage('');
  };
  if (!visible) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 p-3 sm:p-4 border-t border-slate-200 bg-white">
      <input aria-label="Type a message..."
        type="text"
        className="flex-1 min-w-0 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-100 bg-white text-sm focus:border-indigo-500 text-slate-900 placeholder:text-slate-500"
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
        aria-label="Send message"
        className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-700 flex items-center justify-center transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
        disabled={!newMessage.trim()}
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}
