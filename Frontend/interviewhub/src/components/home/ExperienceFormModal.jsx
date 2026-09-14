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
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-2xl relative overflow-y-auto max-h-[90vh]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500">
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold mb-4 text-blue-700">{mode === 'edit' ? 'Edit Your Interview Experience' : 'Share Your Interview Experience'}</h2>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <input
            type="text"
            name="company"
            placeholder="Company"
            value={formData.company}
            onChange={handleFormChange}
            className="w-full border px-4 py-2 rounded-md"
            required
          />
          <input
            type="text"
            name="role"
            placeholder="Role"
            value={formData.role}
            onChange={handleFormChange}
            className="w-full border px-4 py-2 rounded-md"
            required
          />
          <select
            name="difficulty"
            value={formData.difficulty}
            onChange={handleFormChange}
            className="w-full border px-4 py-2 rounded-md"
            required
          >
            <option value="">Select Difficulty</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <input
            type="date"
            name="roundDate"
            value={mode === 'edit' ? (formData.roundDate ? new Date(formData.roundDate).toISOString().slice(0, 10) : '') : formData.roundDate}
            onChange={handleFormChange}
            className="w-full border px-4 py-2 rounded-md"
            required
          />
          <textarea
            name="description"
            placeholder="Overall experience description..."
            value={formData.description}
            onChange={handleFormChange}
            className="w-full border px-4 py-2 rounded-md"
            rows={3}
            required={mode === 'create'}
          />

          {/* Tips */}
          <textarea
            name="tips"
            placeholder="Any tips for others..."
            value={formData.tips}
            onChange={handleFormChange}
            className="w-full border px-4 py-2 rounded-md"
            rows={2}
          />

          {/* Rounds */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-700">Interview Rounds</h4>
            {formData.rounds.map((round, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2 bg-gray-50">
                <input
                  type="text"
                  name="roundName"
                  placeholder="Round Name"
                  value={round.roundName}
                  onChange={(e) => handleFormChange(e, index)}
                  className="w-full border px-4 py-2 rounded-md"
                  required
                />
                <textarea
                  name="questions"
                  placeholder="Questions asked"
                  value={round.questions}
                  onChange={(e) => handleFormChange(e, index)}
                  className="w-full border px-4 py-2 rounded-md"
                  required
                />
                <input
                  type="text"
                  name="duration"
                  placeholder="Duration"
                  value={round.duration}
                  onChange={(e) => handleFormChange(e, index)}
                  className="w-full border px-4 py-2 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newRounds = [...formData.rounds];
                    newRounds.splice(index, 1);
                    setFormData({ ...formData, rounds: newRounds });
                  }}
                  className="text-red-500 text-sm underline"
                >
                  Remove Round
                </button>
                {mode === 'edit' && (
                  <button type="button" onClick={addRound} className="text-blue-600 text-sm underline">
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
                className="text-blue-600 font-medium text-sm underline"
              >
                + Add Another Round
              </button>
            )}
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {mode === 'edit' ? 'Update Experience' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
