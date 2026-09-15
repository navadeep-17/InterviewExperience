import { Edit, Save, User, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- Add this import
import ProfileExperienceFeed from './profile/ProfileExperienceFeed';
import useProfileExperiences from '../hooks/useProfileExperiences';

import { apiRequest } from '../services/apiClient';

// Helper components
const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
    <input
      {...props}
      aria-label={label}
      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-4 focus:border-indigo-500 focus:ring-indigo-100 min-w-0 bg-white text-slate-900 placeholder:text-slate-500"
    />
  </div>
);

const ProfileDetail = ({ label, value }) => (
  <div className="min-w-0 break-words text-slate-900 text-sm">
    <span className="block text-xs font-semibold text-slate-500 mb-1">{label}:</span>{" "}
    {value ? value : <span className="text-slate-500">Not set</span>}
  </div>
);

const ProfilePage = () => {
  const navigate = useNavigate();
  const handleContentAuthFailure = useCallback(status => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const [userData, setUserData] = useState({
    name: "",
    rollNumber: "",
    department: "",
    graduationYear: "",
    currentlyStudying: "",
    email: "",
    phoneNumber: "",
    avatar: "",
    _id: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [formData, setFormData] = useState(userData);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const avatarOptions = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Alex",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Taylor",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jordan",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Skyler",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Casey",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Riley",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jamie",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Quinn",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Harper",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Morgan",
  // extra male‑leaning seeds
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Liam",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Ethan",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Noah",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Lucas",
];


  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      const token = localStorage.getItem("authToken");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const user = await apiRequest('/api/auth/me');
        setUserData(user);
        setFormData(user);
      } catch (error) {
        if (error.status === 401 || error.status === 403) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          navigate('/login', { replace: true });
        }
        // A network failure must not discard the stored session.
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  const data = useProfileExperiences({ profileUser: userData, mode: 'own', onAuthFailure: handleContentAuthFailure });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    setSubmitting(true);
    try {
      const profileUpdate = {
        name: formData.name ?? "",
        graduationYear: formData.graduationYear ?? "",
        rollNumber: formData.rollNumber ?? "",
        currentlyStudying: formData.currentlyStudying ?? "",
        phoneNumber: formData.phoneNumber ?? "",
        avatar: formData.avatar ?? "",
      };
      const updatedUser = await apiRequest('/api/auth/me', { method: 'PUT', data: profileUpdate });
      setUserData(updatedUser);
      setIsEditing(false);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setMsg("Profile updated!");
    } catch (error) {
      setError(error.status === undefined
        ? "Failed to update profile. Please try again."
        : "Failed to update profile.");
    }
    setSubmitting(false);
  };

  // Edit experience
  const handleEditExperience = (exp) => {
    setEditFormData(exp);
    setIsEditing(true);
  };

  if (loading) return <div className="text-center py-10 text-slate-500">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 px-4 sm:px-6 bg-slate-50">
      {/* Go to Home Button */}
      <div className="flex justify-start mb-4">
        <button
          onClick={() => navigate("/home")}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-indigo-700 transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
        >
          Go to Home
        </button>
      </div>
      {/* Profile Header */}
      <div className="relative flex flex-wrap items-center gap-4 mb-6 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-indigo-50 bg-indigo-100 overflow-hidden flex items-center justify-center">
          {userData.avatar ? (
            <img src={userData.avatar} alt="User Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-16 h-16 text-slate-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">{userData.name || "Your Name"}</h1>
          <p className="text-slate-600">{userData.department || "Department"}</p>
        </div>
        <button
          onClick={() => setIsEditing((edit) => !edit)}
          className="shrink-0 p-3 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
          title="Edit Profile" aria-label="Edit profile"
        >
          <Edit className="w-5 h-5" />
        </button>
      </div>

      {/* Suggestion Box */}
      <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-sm leading-relaxed">
        <strong>Tip:</strong> Keep your profile updated and share detailed interview experiences to help others!
      </div>

      {/* Edit/Profile Details */}
      <div className="mb-6">
        {msg && <div className="text-emerald-600 mb-2">{msg}</div>}
        {error && <div className="text-red-600 mb-2">{error}</div>}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6">
            <section aria-labelledby="account-details-heading" className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h2 id="account-details-heading" className="text-sm font-semibold text-slate-900">Account details</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileDetail label="Department" value={userData.department} />
                <ProfileDetail label="College Email" value={userData.email} />
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Email and department are tied to your verified college account and cannot be changed from your profile.
              </p>
            </section>
            <Input label="Name" name="name" value={formData.name || ""} onChange={handleInputChange} />
            <Input label="Graduation Year" name="graduationYear" value={formData.graduationYear || ""} onChange={handleInputChange} />
            <Input label="Roll Number" name="rollNumber" value={formData.rollNumber || ""} onChange={handleInputChange} />
            <Input label="Currently Studying" name="currentlyStudying" value={formData.currentlyStudying || ""} onChange={handleInputChange} />
            <Input label="Phone Number" name="phoneNumber" value={formData.phoneNumber || ""} onChange={handleInputChange} />
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Choose an Avatar</label>
              <div className="flex gap-3 flex-wrap">
                {avatarOptions.map((url) => (
                  <button
                    type="button"
                    key={url}
                    aria-label="Select avatar"
                    aria-pressed={formData.avatar === url}
                    className={`focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-full border-2 p-1 transition  ${
                      formData.avatar === url ? "border-indigo-500 ring-2 ring-indigo-300" : "border-transparent"
                    }`}
                    onClick={() => setFormData((prev) => ({ ...prev, avatar: url }))}
                  >
                    <img src={url} alt="avatar" className="w-14 h-14 rounded-full" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 flex items-center gap-2 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
                disabled={submitting}
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
              <button
                type="button"
                className="bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-300 flex items-center gap-2 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
                onClick={() => {
                  setIsEditing(false);
                  setFormData(userData); // Reset changes
                  setError("");
                  setMsg("");
                }}
                disabled={submitting}
              >
                <XCircle className="w-4 h-4" /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-6">
            <ProfileDetail label="Roll Number" value={userData.rollNumber} />
            <ProfileDetail label="Department" value={userData.department} />
            <ProfileDetail label="Graduation Year" value={userData.graduationYear} />
            <ProfileDetail label="Currently Studying" value={userData.currentlyStudying} />
            <ProfileDetail label="Email" value={userData.email} />
            <ProfileDetail label="Phone Number" value={userData.phoneNumber} />
          </div>
        )}
      </div>

      <hr className="my-8" />

      {/* User Posts Section */}
      <div className="min-w-0">
        <h2 className="text-xl font-bold mb-5 pr-10 text-slate-900">Your Posts</h2>
        <ProfileExperienceFeed data={data} mode="own" viewer={userData} onEditExperience={handleEditExperience} />
      </div>

      {/* Edit Experience Modal */}
      {isEditing && editFormData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center z-50">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl relative overflow-y-auto max-h-[90dvh]">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditFormData(null);
              }}
              aria-label="Close experience editor" className="absolute top-3 right-3 p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-5 pr-10 text-slate-900">Edit Your Interview Experience</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await data.updateExperience(editFormData._id, editFormData)) {
                  setIsEditing(false);
                  setEditFormData(null);
                }
              }}
              className="space-y-4"
            >
              <input aria-label="Company"
                type="text"
                name="company"
                placeholder="Company"
                value={editFormData.company}
                onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                required
              />
              <input aria-label="Role"
                type="text"
                name="role"
                placeholder="Role"
                value={editFormData.role}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                required
              />
              {/* Department field removed */}
              <select aria-label="difficulty"
                name="difficulty"
                value={editFormData.difficulty}
                onChange={(e) => setEditFormData({ ...editFormData, difficulty: e.target.value })}
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
                value={editFormData.roundDate ? new Date(editFormData.roundDate).toISOString().slice(0, 10) : "" }
                onChange={(e) => setEditFormData({ ...editFormData, roundDate: e.target.value })}
                className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                required
              />
              <textarea aria-label="Overall experience description..."
                name="description"
                placeholder="Overall experience description..."
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                rows={3}
              />
              <textarea aria-label="Any tips for others..."
                name="tips"
                placeholder="Any tips for others..."
                value={editFormData.tips}
                onChange={(e) => setEditFormData({ ...editFormData, tips: e.target.value })}
                className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                rows={2}
              />

              {/* Edit Interview Rounds */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-700">Interview Rounds</h4>
                {editFormData.rounds.map((round, index) => (
                  <div key={index} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
                    <input aria-label="Round Name"
                      type="text"
                      name="roundName"
                      placeholder="Round Name"
                      value={round.roundName}
                      onChange={(e) => {
                        const newRounds = [...editFormData.rounds];
                        newRounds[index].roundName = e.target.value;
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                      required
                    />
                    <textarea aria-label="Questions asked"
                      name="questions"
                      placeholder="Questions asked"
                      value={round.questions}
                      onChange={(e) => {
                        const newRounds = [...editFormData.rounds];
                        newRounds[index].questions = e.target.value;
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                      required
                    />
                    <input aria-label="Duration"
                      type="text"
                      name="duration"
                      placeholder="Duration"
                      value={round.duration}
                      onChange={(e) => {
                        const newRounds = [...editFormData.rounds];
                        newRounds[index].duration = e.target.value;
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="w-full border px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 min-w-0 border-slate-200 bg-white text-slate-900 placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newRounds = [...editFormData.rounds];
                        newRounds.splice(index, 1);
                        setEditFormData({ ...editFormData, rounds: newRounds });
                      }}
                      className="text-red-500 text-sm underline focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
                    >
                      Remove Round
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const newRounds = [...editFormData.rounds, { roundName: '', questions: '', duration: '' }];
                  setEditFormData({ ...editFormData, rounds: newRounds });
                }}
                className="text-indigo-600 text-sm underline mt-2 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors rounded-xl py-1.5"
              >
                + Add Another Round
              </button>

              {/* Move the Update Experience button to the bottom with margin */}
              <div className="flex justify-center mt-6">
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
                >
                  Update Experience
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
