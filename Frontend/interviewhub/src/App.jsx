import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import A from './components/A'; // login/signup component
import HomePage from './components/HomePage'; // home page
import ProfilePage from './components/ProfilePage'; // profile page
import MessageComponent from './components/Message';  
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<A />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/messages" element={<MessageComponent />} />
        
      </Routes>
    </Router>
  );
}

export default App;
