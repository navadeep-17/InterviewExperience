import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import A from './components/A'; // login/signup component
import HomePage from './components/HomePage'; // home page

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<A />} />
        <Route path="/home" element={<HomePage />} />
      </Routes>
    </Router>
  );
}

export default App;
