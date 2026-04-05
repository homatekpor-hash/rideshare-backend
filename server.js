const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Rideshare API is running!' });
});

// Register a new user
app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  const query = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
  db.run(query, [name, email, password], function (err) {
    if (err) {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.json({ message: 'User registered!', userId: this.lastID });
    }
  });
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const query = `SELECT * FROM users WHERE email = ? AND password = ?`;
  db.get(query, [email, password], (err, user) => {
    if (err || !user) {
      res.status(400).json({ error: 'Invalid email or password' });
    } else {
      res.json({ message: 'Login successful!', userId: user.id, name: user.name });
    }
  });
});

// Post a ride
app.post('/rides', (req, res) => {
  const { driver_id, from_location, to_location, from_lat, from_lng, to_lat, to_lng, seats_available, departure_time } = req.body;
  const query = `INSERT INTO rides (driver_id, from_location, to_location, from_lat, from_lng, to_lat, to_lng, seats_available, departure_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(query, [driver_id, from_location, to_location, from_lat, from_lng, to_lat, to_lng, seats_available, departure_time], function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ message: 'Ride posted!', rideId: this.lastID });
    }
  });
});

// Find matching rides going same direction
app.get('/rides/match', (req, res) => {
  const { from_lat, from_lng, to_lat, to_lng } = req.query;

  // Calculate direction angle for the passenger
  const passengerAngle = Math.atan2(to_lat - from_lat, to_lng - from_lng);

  // Get all active rides
  const query = `SELECT * FROM rides WHERE status = 'active' AND seats_available > 0`;
  db.all(query, [], (err, rides) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      // Filter rides going in the same direction
      const matchedRides = rides.filter(ride => {
        const rideAngle = Math.atan2(ride.to_lat - ride.from_lat, ride.to_lng - ride.from_lng);
        const angleDiff = Math.abs(passengerAngle - rideAngle);
        return angleDiff < 0.5; // within ~30 degrees same direction
      });
      res.json({ matches: matchedRides });
    }
  });
});

// Get all rides
app.get('/rides', (req, res) => {
  const query = `SELECT rides.*, users.name as driver_name FROM rides JOIN users ON rides.driver_id = users.id WHERE rides.status = 'active'`;
  db.all(query, [], (err, rides) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ rides });
    }
  });
});

// Book a ride
app.post('/bookings', (req, res) => {
  const { ride_id, passenger_id } = req.body;
  const query = `INSERT INTO bookings (ride_id, passenger_id) VALUES (?, ?)`;
  db.run(query, [ride_id, passenger_id], function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      // Reduce available seats
      db.run(`UPDATE rides SET seats_available = seats_available - 1 WHERE id = ?`, [ride_id]);
      res.json({ message: 'Ride booked!', bookingId: this.lastID });
    }
  });
});
// Get rides posted by a specific driver
app.get('/my-rides/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT rides.*, COUNT(bookings.id) as booking_count 
    FROM rides 
    LEFT JOIN bookings ON rides.id = bookings.ride_id 
    WHERE rides.driver_id = ? 
    GROUP BY rides.id
  `;
  db.all(query, [userId], (err, rides) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ rides });
    }
  });
});

// Get bookings made by a specific passenger
app.get('/my-bookings/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT bookings.id, bookings.status as booking_status,
    rides.from_location, rides.to_location, rides.departure_time,
    users.name as driver_name
    FROM bookings
    JOIN rides ON bookings.ride_id = rides.id
    JOIN users ON rides.driver_id = users.id
    WHERE bookings.passenger_id = ?
  `;
  db.all(query, [userId], (err, bookings) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ bookings });
    }
  });
});
// Get notifications for a driver
app.get('/notifications/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT bookings.id, bookings.created_at,
    users.name as passenger_name,
    rides.from_location, rides.to_location
    FROM bookings
    JOIN rides ON bookings.ride_id = rides.id
    JOIN users ON bookings.passenger_id = users.id
    WHERE rides.driver_id = ?
    ORDER BY bookings.created_at DESC
  `;
  db.all(query, [userId], (err, notifications) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ notifications });
    }
  });
});
// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});