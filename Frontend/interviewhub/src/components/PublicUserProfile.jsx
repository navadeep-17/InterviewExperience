import { MessageCircle, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProfileExperienceFeed from './profile/ProfileExperienceFeed';
import useProfileExperiences from '../hooks/useProfileExperiences';
import { apiRequest } from '../services/apiClient';

const PublicUserProfile = () => {
  const { id } = useParams();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const feedState = useRef(null);
  const handleContentAuthFailure = useCallback(status => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      navigate('/login', { replace: true });
    }
  }, [navigate]);
  const handleFatalReadFailure = useCallback(() => setUserInfo(null), []);
  const data = useProfileExperiences({ profileUser: userInfo, mode: 'public',
    onAuthFailure: handleContentAuthFailure, onFatalReadFailure: handleFatalReadFailure });
  const { loadExperiences } = data;

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (userStr) setCurrentUser(JSON.parse(userStr));
  }, []);

  // Fetch user info, experiences, and comments
  useEffect(() => {
    const fetchUserAndExperiences = async () => {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/login');
        setLoading(false);
        return;
      }
      try {
        // Fetch user info
        let userData;
        try {
          userData = await apiRequest(`/api/users/${id}`);
        } catch (error) {
          if (error.status === 401 || error.status === 403) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            navigate('/login', { replace: true });
            setLoading(false);
            return;
          }
          throw error;
        }

        setUserInfo(userData);
        await loadExperiences(userData);
      } catch {
        setUserInfo(null);
      }
      setLoading(false);
    };
    fetchUserAndExperiences();
  }, [id, navigate, loadExperiences]);

  if (loading) return <div className="text-center py-10 text-slate-500">Loading...</div>;
  if (!userInfo) return <div className="text-center mt-10 text-red-500">User not found.</div>;

  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-10 px-4 sm:px-6">
      <div className="w-full max-w-3xl mx-auto">
        {/* Profile Header */}
        <div className="relative bg-white border border-slate-200 rounded-2xl shadow-sm p-5 pt-20 sm:p-6 sm:pt-20 flex flex-col sm:flex-row items-start gap-5">
          <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-indigo-50 bg-indigo-100 overflow-hidden flex items-center justify-center">
            {userInfo.avatar ? (
              <img src={userInfo.avatar} alt="User Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-16 h-16 text-slate-500" />
            )}
          </div>
          <div className="min-w-0 w-full flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">{userInfo.name || "Unknown User"}</h1>
            <p className="text-slate-600 text-base">{userInfo.department || "Department not set"}</p>
            <p className="text-slate-500 text-sm">
              {userInfo.graduationYear && <>Graduation: {userInfo.graduationYear}</>}
            </p>
            <div className="flex mt-4">
              <button
                onClick={() => navigate(`/message?user=${userInfo._id}`)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-sm hover:bg-indigo-700 transition font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Send Message
              </button>
            </div>
          </div>
          <div className="absolute top-4 right-4">
            <button
              onClick={() => navigate(-1)}
              className="bg-white text-indigo-700 px-4 py-2.5 rounded-xl shadow-sm hover:bg-indigo-100 transition font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:opacity-50 transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-6 border-slate-200" />

        {/* Posts Section */}
        <div className="min-h-[300px]">
          <h2 className="text-xl font-bold mb-4 text-slate-900 flex items-center gap-2">
            <span className="inline-block w-2 h-6 bg-indigo-500 rounded-full mr-2"></span>
            Posts
          </h2>
          <ProfileExperienceFeed data={data} mode="public" viewer={currentUser} retainedState={feedState} />
        </div>
      </div>
    </div>
  );
};

export default PublicUserProfile;
