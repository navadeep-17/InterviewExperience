import { useState } from 'react';
import { X } from 'lucide-react';

const blankDraft = () => ({
  company: '', role: '', difficulty: '', roundDate: '', description: '', tips: '',
  rounds: [{ roundName: '', questions: '', duration: '' }],
});
const editDraft = experience => ({
  company: experience.company, role: experience.role, difficulty: experience.difficulty,
  roundDate: experience.roundDate, description: experience.description, tips: experience.tips,
  rounds: experience.rounds.map(({ roundName, questions, duration }) => ({ roundName, questions, duration })),
});

export default function ExperienceFormModal({ mode, experience, open = true, onSubmit, onClose }) {
  const [formData, setFormData] = useState(() => mode === 'edit' ? editDraft(experience) : blankDraft());
  const handleFormChange = (e, roundIndex = null) => {
    const { name, value } = e.target;
    setFormData(prev => roundIndex === null ? { ...prev, [name]: value } : {
      ...prev, rounds: prev.rounds.map((round, index) => index === roundIndex ? { ...round, [name]: value } : round),
    });
  };
  const addRound = () => setFormData(prev => ({
    ...prev, rounds: [...prev.rounds, { roundName: '', questions: '', duration: '' }],
  }));
  const handleFormSubmit = async e => {
    e.preventDefault();
    if (await onSubmit(formData)) {
      if (mode === 'create') setFormData(blankDraft());
    }
  };
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center z-50">
      <div role="dialog" aria-modal="true" aria-labelledby={`experience-${mode}-title`} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl relative overflow-y-auto max-h-[90dvh]">
        <button onClick={onClose} aria-label="Close experience editor" className="absolute top-3 right-3 p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h2 id={`experience-${mode}-title`} className="text-xl font-bold mb-5 pr-10 text-slate-900">{mode === 'edit' ? 'Edit Your Interview Experience' : 'Share Your Interview Experience'}</h2>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <input aria-label="Company"
            type="text"
            name="company"
            placeholder="Company"
            value={formData.company}
            onChange={handleFormChange}
            className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
            required
          />
          <input aria-label="Role"
            type="text"
            name="role"
            placeholder="Role"
            value={formData.role}
            onChange={handleFormChange}
            className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
            required
          />
          <select aria-label="difficulty"
            name="difficulty"
            value={formData.difficulty}
            onChange={handleFormChange}
            className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
            required
          >
            <option value="">Select Difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <input aria-label="roundDate"
            type="date"
            name="roundDate"
            value={mode === 'edit' ? (formData.roundDate ? new Date(formData.roundDate).toISOString().slice(0, 10) : '') : formData.roundDate}
            onChange={handleFormChange}
            className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
            required
          />
          <textarea aria-label="Overall experience description..."
            name="description"
            placeholder="Overall experience description..."
            value={formData.description}
            onChange={handleFormChange}
            className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
            rows={3}
            required={mode === 'create'}
          />

          {/* Tips */}
          <textarea aria-label="Any tips for others..."
            name="tips"
            placeholder="Any tips for others..."
            value={formData.tips}
            onChange={handleFormChange}
            className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
            rows={2}
          />

          {/* Rounds */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-700">Interview Rounds</h4>
            {formData.rounds.map((round, index) => (
              <div key={index} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                <input aria-label="Round Name"
                  type="text"
                  name="roundName"
                  placeholder="Round Name"
                  value={round.roundName}
                  onChange={(e) => handleFormChange(e, index)}
                  className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                  required
                />
                <textarea aria-label="Questions asked"
                  name="questions"
                  placeholder="Questions asked"
                  value={round.questions}
                  onChange={(e) => handleFormChange(e, index)}
                  className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                  required
                />
                <input aria-label="Duration"
                  type="text"
                  name="duration"
                  placeholder="Duration"
                  value={round.duration}
                  onChange={(e) => handleFormChange(e, index)}
                  className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newRounds = [...formData.rounds];
                    newRounds.splice(index, 1);
                    setFormData({ ...formData, rounds: newRounds });
                  }}
                  className="text-red-500 text-sm underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
                >
                  Remove Round
                </button>
                {mode === 'edit' && (
                  <button type="button" onClick={addRound} className="text-indigo-600 text-sm underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5">
                    + Add Round
                  </button>
                )}
              </div>
            ))}

            {mode === 'create' && (
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    rounds: [...formData.rounds, { roundName: '', questions: '', duration: '' }],
                  })
                }
                className="text-indigo-600 font-medium text-sm underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
              >
                + Add Another Round
              </button>
            )}
          </div>

          <button
            type="submit"
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
          >
            {mode === 'edit' ? 'Update Experience' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
