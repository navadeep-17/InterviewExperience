import { useState } from 'react';

export default function ExperienceFilters({ sortOrder, onFiltersChange, onSearch, onSortChange }) {
  const [filters, setFilters] = useState({ company: '', role: '', department: '', difficulty: '' });
  const handleChange = (name, value) => {
    const next = { ...filters, [name]: value };
    setFilters(next);
    onFiltersChange(next);
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSearch(filters);
      }}
      className="mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5"
    >
      <input
        type="text"
        aria-label="Company filter" placeholder="Company"
        value={filters.company}
        onChange={e => handleChange('company', e.target.value)}
        className="border px-3 py-2.5 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition w-full min-w-0 focus:outline-none border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
      />
      <input
        type="text"
        aria-label="Role filter" placeholder="Role"
        value={filters.role}
        onChange={e => handleChange('role', e.target.value)}
        className="border px-3 py-2.5 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition w-full min-w-0 focus:outline-none border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
      />
      <input
        type="text"
        aria-label="Department filter" placeholder="Department"
        value={filters.department}
        onChange={e => handleChange('department', e.target.value)}
        className="border px-3 py-2.5 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition w-full min-w-0 focus:outline-none border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
      />
      <select
        aria-label="Difficulty filter" value={filters.difficulty}
        onChange={e => handleChange('difficulty', e.target.value)}
        className="border px-3 py-2.5 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition w-full min-w-0 focus:outline-none border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
      >
        <option value="">All Difficulties</option>
        <option value="Easy">Easy</option>
        <option value="Medium">Medium</option>
        <option value="Hard">Hard</option>
      </select>
      <select
        aria-label="Sort experiences" value={sortOrder}
        onChange={e => onSortChange(e.target.value)}
        className="border px-3 py-2.5 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition w-full min-w-0 focus:outline-none border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
      >
        <option value="latest">Latest</option>
        <option value="oldest">Oldest</option>
      </select>
      <button
        type="submit"
        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-sm hover:bg-indigo-700 transition font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
      >
           Search
      </button>
    </form>
  );
}
