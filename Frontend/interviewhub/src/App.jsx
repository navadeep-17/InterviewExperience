import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import A from './components/A'; // login/signup component
import HomePage from './components/HomePage'; // home page
import MessageComponent from './components/Message';
import ProfilePage from './components/ProfilePage'; // profile page
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<A />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/message" element={<MessageComponent />} />
        
      </Routes>
    </Router>
  );
}

export default App;
