const token = localStorage.getItem('authToken');

const response = await fetch('http://localhost:5000/api/protected/route', {
     method: 'GET',
     headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` // ✅ Important
     }
});