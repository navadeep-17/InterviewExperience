import { useState } from 'react';
import { MessageSquare, User2 } from 'lucide-react';
import ChatAvatar from './ChatAvatar';

export default function ChatSidebar({ open, users, groups, selectedUser, selectedGroup, onBack, onViewProfile, onSelectUser, onSelectGroup }) {
  const [search, setSearch] = useState('');
  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-30 bg-white border-r border-slate-200 flex flex-col w-72 max-w-[85vw] shrink-0
        transform transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full invisible'}
        md:visible md:static md:translate-x-0 md:w-80 md:max-w-xs
      `}
      style={{ height: '100dvh' }}
    >

      <div className="p-4 flex justify-center md:justify-start">
        <button
          onClick={onBack}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition text-sm font-semibold w-full md:w-auto focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
      {/* Sidebar Title */}
      <div className="px-5 py-4 text-xl font-bold flex items-center gap-3 border-b border-slate-200 bg-white text-indigo-700">
        <MessageSquare className="w-7 h-7" />
        Chats
      </div>
      <div className="p-4 bg-slate-50 border-b border-slate-200">
        <input aria-label="Search users..."
          type="text"
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition focus:border-indigo-500 min-w-0 bg-white text-slate-900 placeholder:text-slate-500"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-slate-100">
          {(Array.isArray(users) ? users : [])
            .filter(user => user.name.toLowerCase().includes(search.toLowerCase()))
            .map(user => (
              <li
                key={user._id}
                className={`p-4 flex items-center gap-3 cursor-pointer transition rounded-xl mx-2 my-1
                  ${selectedUser?._id === user._id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-indigo-50'}
                `}
              >
                <div
                  className="flex items-center gap-3 flex-1 min-w-0"
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
                  className="ml-auto p-2 rounded-full hover:bg-indigo-100 transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
                  title="View Profile"
                >
                  <User2 className="w-5 h-5 text-indigo-600" />
                </button>
              </li>
            ))}
        </ul>
        {/* Groups Section */}
        <div className="mt-6 mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500 px-6">Groups</div>
        <ul className="divide-y divide-slate-100">
          {groups.map(group => (
            <li
              key={group._id}
              onClick={() => {
                onSelectGroup(group);
              }}
              className={`p-4 flex items-center gap-3 cursor-pointer transition rounded-xl mx-2 my-1
                ${selectedGroup?._id === group._id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-indigo-50'}
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
