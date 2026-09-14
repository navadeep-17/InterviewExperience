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
      className="mb-8 flex flex-wrap gap-3 items-center bg-white/80 shadow-lg rounded-xl px-6 py-4"
    >
      <input
        type="text"
        placeholder="Company"
        value={filters.company}
        onChange={e => handleChange('company', e.target.value)}
        className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-40"
      />
      <input
        type="text"
        placeholder="Role"
        value={filters.role}
        onChange={e => handleChange('role', e.target.value)}
        className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-40"
      />
      <input
        type="text"
        placeholder="Department"
        value={filters.department}
        onChange={e => handleChange('department', e.target.value)}
        className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-40"
      />
      <select
        value={filters.difficulty}
        onChange={e => handleChange('difficulty', e.target.value)}
        className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-44"
      >
        <option value="">All Difficulties</option>
        <option value="Easy">Easy</option>
        <option value="Medium">Medium</option>
        <option value="Hard">Hard</option>
      </select>
      <select
        value={sortOrder}
        onChange={e => onSortChange(e.target.value)}
        className="border px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition w-36"
      >
        <option value="latest">Latest</option>
        <option value="oldest">Oldest</option>
      </select>
      <button
        type="submit"
        className="bg-blue-600 text-white px-5 py-2 rounded-lg shadow hover:bg-blue-700 transition font-semibold"
      >
           Search
      </button>
    </form>
  );
}
