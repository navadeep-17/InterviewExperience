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

  if (loading) return <div className="text-center mt-10">Loading...</div>;
  if (!userInfo) return <div className="text-center mt-10 text-red-500">User not found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-blue-50 to-white flex items-center justify-center py-8 px-2">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-0 sm:p-0 overflow-hidden">
        {/* Profile Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-500 p-8 flex items-center">
          <div className="w-28 h-28 rounded-full border-4 border-white shadow-xl bg-gray-200 overflow-hidden flex items-center justify-center">
            {userInfo.avatar ? (
              <img src={userInfo.avatar} alt="User Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-16 h-16 text-gray-400" />
            )}
          </div>
          <div className="ml-8 flex-1">
            <h1 className="text-4xl font-extrabold text-white drop-shadow">{userInfo.name || "Unknown User"}</h1>
            <p className="text-indigo-100 text-lg">{userInfo.department || "Department not set"}</p>
            <p className="text-blue-200 text-sm">
              {userInfo.graduationYear && <>Graduation: {userInfo.graduationYear}</>}
            </p>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => navigate(`/message?user=${userInfo._id}`)}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition font-semibold"
              >
                <MessageCircle className="w-5 h-5" />
                Send Message
              </button>
            </div>
          </div>
          <div className="absolute top-6 right-6">
            <button
              onClick={() => navigate(-1)}
              className="bg-white text-blue-700 px-4 py-2 rounded-lg shadow hover:bg-blue-100 transition font-semibold"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Divider */}
        <hr className="my-0 border-blue-100" />

        {/* Posts Section */}
        <div className="p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-white min-h-[300px]">
          <h2 className="text-2xl font-bold mb-6 text-blue-700 flex items-center gap-2">
            <span className="inline-block w-2 h-6 bg-blue-500 rounded-full mr-2"></span>
            Posts
          </h2>
          <ProfileExperienceFeed data={data} mode="public" viewer={currentUser} retainedState={feedState} />
        </div>
      </div>
    </div>
  );
};

export default PublicUserProfile;
