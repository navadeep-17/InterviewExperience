import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import A from './components/A'; // login/signup component
import HomePage from './components/HomePage'; // home page
import LandingPage from './components/LandingPage';
import MessageComponent from './components/Message';
import ProfilePage from './components/ProfilePage'; // profile page
import PublicUserProfile from './components/PublicUserProfile';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<A />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/message" element={<MessageComponent />} />
        <Route path="/user/:id" element={<PublicUserProfile />} />
      </Routes>
    </Router>
  );
}

export default App;
