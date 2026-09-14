import { useState } from 'react';
import { MessageSquare, User2 } from 'lucide-react';
import ChatAvatar from './ChatAvatar';

export default function ChatSidebar({ open, users, groups, selectedUser, selectedGroup, onBack, onViewProfile, onSelectUser, onSelectGroup }) {
  const [search, setSearch] = useState('');
  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 bg-white border-r shadow-lg flex flex-col w-72 max-w-full
        transform transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'}
        md:static md:translate-x-0 md:w-80 md:max-w-xs
      `}
      style={{ height: '100vh' }}
    >

      <div className="p-4 flex justify-center md:justify-start">
        <button
          onClick={onBack}
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
                    onSelectUser(user);
                  }}
                >
                  <ChatAvatar user={user} size={44} />
                  <span className="truncate">{user.name}</span>
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onViewProfile(user._id);
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
                onSelectGroup(group);
              }}
              className={`p-4 flex items-center gap-3 cursor-pointer transition rounded-lg mx-2 my-1
                ${selectedGroup?._id === group._id ? 'bg-blue-100 font-semibold shadow' : 'hover:bg-blue-50'}
              `}
            >
              <ChatAvatar user={group} size={44} />
              <span className="flex-1 truncate">{group.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
