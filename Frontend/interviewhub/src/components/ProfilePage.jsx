import React, { useState, useEffect } from 'react';
import { Edit, User, Mail, Phone } from 'lucide-react';

const ProfilePage = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: '',
    rollNumber: '',
    department: '',
    graduationYear: '',
    currentlyStudying: '',
    email: '',
    phoneNumber: '',
    avatar: '',
  });

  // Simulate fetching user data from an API
  useEffect(() => {
    const fetchUserData = async () => {
      // Simulate API call
      const response = {
        name: 'Omkar Sharma',
        rollNumber: 'CS2023001',
        department: 'Computer Science and Engineering',
        graduationYear: '2027',
        currentlyStudying: 'Yes',
        email: 'omkar@example.com',
        phoneNumber: '9876543210',
        avatar: 'https://github.com/shadcn.png',
      };
      setUserData(response);
    };
    
    fetchUserData();
  }, []);

  const ProfileHeader = ({ userData, isEditing, setIsEditing }) => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <div className="w-20 h-20 rounded-full bg-gray-300 overflow-hidden">
          {userData.avatar ? (
            <img src={userData.avatar} alt="User Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-full h-full text-gray-500" />
          )}
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">{userData.name}</h1>
          <p className="text-lg text-gray-600">{userData.department}</p>
        </div>
      </div>
      <button
        onClick={() => setIsEditing(!isEditing)}
        className="p-2 rounded-lg text-blue-600 hover:bg-blue-100"
      >
        <Edit className="w-5 h-5" />
      </button>
    </div>
  );

  const ProfileForm = ({ userData, setUserData, setIsEditing }) => {
    const [formData, setFormData] = useState({ ...userData });

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      // Simulate saving data to the server
      setUserData(formData);
      setIsEditing(false);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 rounded-full bg-gray-300 overflow-hidden">
            <img src={formData.avatar} alt="User Avatar" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full text-3xl font-semibold text-gray-800 bg-transparent border-b border-gray-300 focus:outline-none"
            />
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              className="w-full text-lg text-gray-600 bg-transparent border-b border-gray-300 focus:outline-none"
            />
            <input
              type="text"
              name="rollNumber"
              value={formData.rollNumber}
              onChange={handleInputChange}
              className="w-full text-lg text-gray-600 bg-transparent border-b border-gray-300 focus:outline-none"
            />
            <input
              type="text"
              name="graduationYear"
              value={formData.graduationYear}
              onChange={handleInputChange}
              className="w-full text-lg text-gray-600 bg-transparent border-b border-gray-300 focus:outline-none"
            />
            <input
              type="text"
              name="currentlyStudying"
              value={formData.currentlyStudying}
              onChange={handleInputChange}
              className="w-full text-lg text-gray-600 bg-transparent border-b border-gray-300 focus:outline-none"
            />
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full text-lg text-gray-600 bg-transparent border-b border-gray-300 focus:outline-none"
            />
            <input
              type="text"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              className="w-full text-lg text-gray-600 bg-transparent border-b border-gray-300 focus:outline-none"
            />
          </div>
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          Save Changes
        </button>
      </form>
    );
  };

  const ProfileSection = ({ title, data }) => (
    <div className="my-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="space-y-4">
        {data.map((item, index) => (
          <p key={index} className="text-gray-600">{item}</p>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white shadow-xl rounded-lg">
      <ProfileHeader userData={userData} isEditing={isEditing} setIsEditing={setIsEditing} />
      {isEditing ? <ProfileForm userData={userData} setUserData={setUserData} setIsEditing={setIsEditing} /> : null}

      <div className="space-y-8">
        <ProfileSection
          title="Profile Details"
          data={[
            `Roll Number: ${userData.rollNumber}`,
            `Department: ${userData.department}`,
            `Graduation Year: ${userData.graduationYear}`,
            `Currently Studying: ${userData.currentlyStudying}`,
            `Email: ${userData.email}`,
            `Phone Number: ${userData.phoneNumber}`,
          ]}
        />
      </div>
    </div>
  );
};

export default ProfilePage;
