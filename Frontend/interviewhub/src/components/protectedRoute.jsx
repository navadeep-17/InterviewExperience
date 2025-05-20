import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('authToken'); // ✅ match the key used in A.jsx
  return token ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;