import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import A from './components/A'; // login/signup component
import HomePage from './components/HomePage'; // home page
import LandingPage from './components/LandingPage';
import MessageComponent from './components/Message';
import ProfilePage from './components/ProfilePage'; // profile page
import PublicUserProfile from './components/PublicUserProfile';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<A />} />
        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/message" element={<ProtectedRoute><MessageComponent /></ProtectedRoute>} />
        <Route path="/user/:id" element={<ProtectedRoute><PublicUserProfile /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
