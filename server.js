const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

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
  const { from_lat, from_lng, to_lat, to_lng, from_city, to_city } = req.query;

  if (from_city || to_city) {
    let query = `SELECT rides.*, users.name as driver_name FROM rides 
    JOIN users ON rides.driver_id = users.id 
    WHERE rides.status = 'active' AND rides.seats_available > 0`;
    const params = [];

    if (from_city) {
      query += ` AND LOWER(rides.from_location) LIKE LOWER(?)`;
      params.push(`%${from_city}%`);
    }
    if (to_city) {
      query += ` AND LOWER(rides.to_location) LIKE LOWER(?)`;
      params.push(`%${to_city}%`);
    }

    db.all(query, params, (err, rides) => {
      if (err) {
        res.status(400).json({ error: err.message });
      } else {
        res.json({ matches: rides });
      }
    });
    return;
  }

  const passengerAngle = Math.atan2(to_lat - from_lat, to_lng - from_lng);
  const query = `SELECT rides.*, users.name as driver_name FROM rides 
  JOIN users ON rides.driver_id = users.id 
  WHERE rides.status = 'active' AND rides.seats_available > 0`;
  db.all(query, [], (err, rides) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      const matchedRides = rides.filter(ride => {
        const rideAngle = Math.atan2(ride.to_lat - ride.from_lat, ride.to_lng - ride.from_lng);
        const angleDiff = Math.abs(passengerAngle - rideAngle);
        return angleDiff < 0.5;
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
    rides.driver_id, users.name as driver_name
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

// Send a message
app.post('/messages', (req, res) => {
  const { sender_id, receiver_id, message } = req.body;
  const query = `INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`;
  db.run(query, [sender_id, receiver_id, message], function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ message: 'Message sent!', messageId: this.lastID });
    }
  });
});

// Get messages between two users
app.get('/messages/:userId/:otherUserId', (req, res) => {
  const { userId, otherUserId } = req.params;
  const query = `
    SELECT messages.*, users.name as sender_name
    FROM messages
    JOIN users ON messages.sender_id = users.id
    WHERE (sender_id = ? AND receiver_id = ?)
    OR (sender_id = ? AND receiver_id = ?)
    ORDER BY messages.created_at ASC
  `;
  db.all(query, [userId, otherUserId, otherUserId, userId], (err, messages) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ messages });
    }
  });
});

// Get all conversations for a user
app.get('/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT DISTINCT
    CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user_id,
    users.name as other_user_name,
    messages.message as last_message,
    messages.created_at
    FROM messages
    JOIN users ON users.id = CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
    WHERE sender_id = ? OR receiver_id = ?
    GROUP BY other_user_id
    ORDER BY messages.created_at DESC
  `;
  db.all(query, [userId, userId, userId, userId], (err, conversations) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ conversations });
    }
  });
});

// Submit a rating
app.post('/ratings', (req, res) => {
  const { ride_id, passenger_id, driver_id, rating, comment } = req.body;
  const query = `INSERT INTO ratings (ride_id, passenger_id, driver_id, rating, comment) VALUES (?, ?, ?, ?, ?)`;
  db.run(query, [ride_id, passenger_id, driver_id, rating, comment], function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ message: 'Rating submitted!', ratingId: this.lastID });
    }
  });
});

// Get ratings for a driver
app.get('/ratings/:driverId', (req, res) => {
  const { driverId } = req.params;
  const query = `
    SELECT ratings.*, users.name as passenger_name
    FROM ratings
    JOIN users ON ratings.passenger_id = users.id
    WHERE ratings.driver_id = ?
    ORDER BY ratings.created_at DESC
  `;
  db.all(query, [driverId], (err, ratings) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      const avgRating = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
        : 0;
      res.json({ ratings, avgRating });
    }
  });
});

// Cancel a ride
app.put('/rides/:rideId/cancel', (req, res) => {
  const { rideId } = req.params;
  const query = `UPDATE rides SET status = 'cancelled' WHERE id = ?`;
  db.run(query, [rideId], function (err) {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ message: 'Ride cancelled!' });
    }
  });
});

// Cancel a booking
app.put('/bookings/:bookingId/cancel', (req, res) => {
  const { bookingId } = req.params;
  db.get(`SELECT ride_id FROM bookings WHERE id = ?`, [bookingId], (err, booking) => {
    if (err || !booking) {
      res.status(400).json({ error: 'Booking not found' });
    } else {
      db.run(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [bookingId]);
      db.run(`UPDATE rides SET seats_available = seats_available + 1 WHERE id = ?`, [booking.ride_id]);
      res.json({ message: 'Booking cancelled!' });
    }
  });
});

// Get driver profile
app.get('/profile/:userId', (req, res) => {
  const { userId } = req.params;
  const query = `SELECT id, name, email, created_at FROM users WHERE id = ?`;
  db.get(query, [userId], (err, user) => {
    if (err || !user) {
      res.status(400).json({ error: 'User not found' });
    } else {
      res.json({ user });
    }
  });
});

// Admin - get all rides
app.get('/admin/rides', (req, res) => {
  const query = `
    SELECT rides.*, users.name as driver_name
    FROM rides
    JOIN users ON rides.driver_id = users.id
    ORDER BY rides.created_at DESC
  `;
  db.all(query, [], (err, rides) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ rides });
    }
  });
});

// Admin - get all users
app.get('/admin/users', (req, res) => {
  const query = `SELECT id, name, email, created_at FROM users ORDER BY created_at DESC`;
  db.all(query, [], (err, users) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ users });
    }
  });
});

// Admin - get all bookings
app.get('/admin/bookings', (req, res) => {
  const query = `
    SELECT bookings.*, 
    rides.from_location, rides.to_location,
    users.name as passenger_name
    FROM bookings
    JOIN rides ON bookings.ride_id = rides.id
    JOIN users ON bookings.passenger_id = users.id
    ORDER BY bookings.created_at DESC
  `;
  db.all(query, [], (err, bookings) => {
    if (err) {
      res.status(400).json({ error: err.message });
    } else {
      res.json({ bookings });
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});