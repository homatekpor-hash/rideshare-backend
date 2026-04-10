const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'Rideshare API is running!' });
});

app.post('/register', (req, res) => {
  const { name, email, password, role, referral_code } = req.body;
  const myReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  db.run(`INSERT INTO users (name, email, password, role, referral_code) VALUES (?, ?, ?, ?, ?)`,
    [name, email, password, role || 'rider', myReferralCode], function (err) {
      if (err) { res.status(400).json({ error: 'Email already exists' }); }
      else {
        if (referral_code) {
          db.get(`SELECT id FROM users WHERE referral_code = ?`, [referral_code], (err, referrer) => {
            if (referrer) {
              db.run(`INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)`, [referrer.id, this.lastID]);
              db.run(`UPDATE users SET wallet_balance = wallet_balance + 5 WHERE id = ?`, [referrer.id]);
            }
          });
        }
        res.json({ message: 'User registered!', userId: this.lastID, role: role || 'rider', referralCode: myReferralCode });
      }
    });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
    if (err || !user) { res.status(400).json({ error: 'Invalid email or password' }); }
    else {
      res.json({
        message: 'Login successful!',
        userId: user.id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        profilePicture: user.profile_picture,
        isOnline: user.is_online,
        walletBalance: user.wallet_balance,
        referralCode: user.referral_code
      });
    }
  });
});

app.get('/reset-password/:email/:newPassword', (req, res) => {
  const { email, newPassword } = req.params;
  db.run(`UPDATE users SET password = ? WHERE email = ?`, [newPassword, email], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: `Password reset for ${email}!` }); }
  });
});

app.put('/users/:userId/profile', (req, res) => {
  const { userId } = req.params;
  const { name, phone } = req.body;
  db.run(`UPDATE users SET name = ?, phone = ? WHERE id = ?`, [name, phone, userId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Profile updated!' }); }
  });
});

app.put('/users/:userId/status', (req, res) => {
  const { userId } = req.params;
  const { is_online } = req.body;
  db.run(`UPDATE users SET is_online = ? WHERE id = ?`, [is_online, userId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Status updated!', is_online }); }
  });
});

app.put('/users/:userId/picture', (req, res) => {
  const { userId } = req.params;
  const { profile_picture } = req.body;
  db.run(`UPDATE users SET profile_picture = ? WHERE id = ?`, [profile_picture, userId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Profile picture updated!' }); }
  });
});

app.get('/profile/:userId', (req, res) => {
  const { userId } = req.params;
  db.get(`SELECT id, name, email, role, phone, profile_picture, is_online, wallet_balance, referral_code, created_at FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err || !user) { res.status(400).json({ error: 'User not found' }); }
    else { res.json({ user }); }
  });
});

app.post('/driver/documents', (req, res) => {
  const { driver_id, license_front, license_back, national_id_front, national_id_back, insurance_image, roadworthiness_image, face_photo } = req.body;
  db.get(`SELECT id FROM driver_documents WHERE driver_id = ?`, [driver_id], (err, existing) => {
    if (existing) {
      db.run(`UPDATE driver_documents SET license_front=?, license_back=?, national_id_front=?, national_id_back=?, insurance_image=?, roadworthiness_image=?, face_photo=?, verified=0, rejection_reason=NULL WHERE driver_id=?`,
        [license_front, license_back, national_id_front, national_id_back, insurance_image, roadworthiness_image, face_photo, driver_id], function (err) {
          if (err) { res.status(400).json({ error: err.message }); }
          else { res.json({ message: 'Documents updated!' }); }
        });
    } else {
      db.run(`INSERT INTO driver_documents (driver_id, license_front, license_back, national_id_front, national_id_back, insurance_image, roadworthiness_image, face_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [driver_id, license_front, license_back, national_id_front, national_id_back, insurance_image, roadworthiness_image, face_photo], function (err) {
          if (err) { res.status(400).json({ error: err.message }); }
          else { res.json({ message: 'Documents uploaded!' }); }
        });
    }
  });
});

app.get('/driver/documents/:driverId', (req, res) => {
  const { driverId } = req.params;
  db.get(`SELECT * FROM driver_documents WHERE driver_id = ?`, [driverId], (err, docs) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ documents: docs || {} }); }
  });
});

app.post('/rides', (req, res) => {
  const { driver_id, from_location, to_location, from_lat, from_lng, to_lat, to_lng, seats_available, departure_time, price, waypoints, full_route } = req.body;
  db.run(`INSERT INTO rides (driver_id, from_location, to_location, from_lat, from_lng, to_lat, to_lng, seats_available, departure_time, price, waypoints, full_route) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [driver_id, from_location, to_location, from_lat || 5.6037, from_lng || -0.1870, to_lat || 5.6037, to_lng || -0.1870, seats_available, departure_time, price || 0, waypoints || '', full_route || ''], function (err) {
      if (err) { res.status(400).json({ error: err.message }); }
      else { res.json({ message: 'Ride posted!', rideId: this.lastID }); }
    });
});

app.get('/rides/match', (req, res) => {
  const { from_city, to_city } = req.query;

  const corridors = [
    ['accra', 'odorkor', 'darkuman', 'mallam junction', 'kaneshie', 'north kaneshie', 'weija', 'weija junction', 'kasoa', 'budumburam', 'winneba'],
    ['accra', 'achimota', 'lapaz', 'tantra hill', 'ofankor', 'pokuase', 'amasaman', 'nsawam'],
    ['accra', 'madina', 'adenta', 'oyibi', 'aburi', 'koforidua'],
    ['accra', 'spintex', 'teshie', 'nungua', 'community 1', 'tema', 'ashaiman'],
    ['accra', 'circle', 'achimota', 'ofankor', 'kumasi'],
    ['accra', 'adabraka', 'tudu', 'makola', 'agbogbloshie', 'kaneshie'],
    ['accra', 'osu', 'labone', 'airport', 'east legon', 'legon', 'haatso', 'taifa', 'dome', 'kwabenya'],
    ['accra', 'dansoman', 'mamprobi', 'korle bu', 'kaneshie'],
    ['kumasi', 'ejisu', 'konongo', 'cape coast', 'takoradi'],
    ['accra', 'cape coast', 'takoradi'],
    ['accra', 'winneba', 'cape coast'],
    ['kaneshie', 'mallam junction', 'odorkor', 'darkuman', 'lapaz', 'achimota', 'accra'],
    ['kasoa', 'weija junction', 'weija', 'darkuman', 'mallam junction', 'kaneshie', 'accra'],
  ];

  const normalize = (str) => str?.toLowerCase().trim() || '';

  const isOnSameCorridor = (from, to, rideFrom, rideTo, rideWaypoints) => {
    const fromN = normalize(from);
    const toN = normalize(to);
    const rideFromN = normalize(rideFrom);
    const rideToN = normalize(rideTo);
    const waypointList = (rideWaypoints || '').split(',').map(w => normalize(w.trim())).filter(w => w);

    for (const corridor of corridors) {
      const rideFromIdx = corridor.findIndex(s => rideFromN.includes(s) || s.includes(rideFromN));
      const rideToIdx = corridor.findIndex(s => rideToN.includes(s) || s.includes(rideToN));
      const fromIdx = corridor.findIndex(s => fromN.includes(s) || s.includes(fromN));
      const toIdx = corridor.findIndex(s => toN.includes(s) || s.includes(toN));

      if (rideFromIdx !== -1 && rideToIdx !== -1 && fromIdx !== -1 && toIdx !== -1) {
        const minRide = Math.min(rideFromIdx, rideToIdx);
        const maxRide = Math.max(rideFromIdx, rideToIdx);
        if (fromIdx >= minRide && toIdx <= maxRide) return true;
      }

      // Check waypoints
      for (const wp of waypointList) {
        const wpIdx = corridor.findIndex(s => wp.includes(s) || s.includes(wp));
        if (wpIdx !== -1 && fromIdx !== -1) {
          const minRide2 = Math.min(rideFromIdx !== -1 ? rideFromIdx : wpIdx, wpIdx);
          const maxRide2 = Math.max(rideToIdx !== -1 ? rideToIdx : wpIdx, wpIdx);
          if (fromIdx >= minRide2 && (toIdx === -1 || toIdx <= maxRide2)) return true;
        }
      }
    }
    return false;
  };

  db.all(`SELECT rides.*, users.name as driver_name, users.phone as driver_phone, users.profile_picture, users.is_online FROM rides JOIN users ON rides.driver_id = users.id WHERE rides.status = 'active' AND rides.seats_available > 0`, [], (err, rides) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else {
      const matches = rides.filter(ride => {
        const fromN = normalize(from_city);
        const toN = normalize(to_city);
        const rideFromN = normalize(ride.from_location);
        const rideToN = normalize(ride.to_location);

        // Direct match
        const fromMatch = !from_city || rideFromN.includes(fromN) || fromN.includes(rideFromN);
        const toMatch = !to_city || rideToN.includes(toN) || toN.includes(rideToN);
        if (fromMatch && toMatch) return true;

        // Corridor match
        if (from_city || to_city) {
          return isOnSameCorridor(from_city, to_city, ride.from_location, ride.to_location, ride.waypoints);
        }
        return false;
      });
      res.json({ matches });
    }
  });
});

app.get('/rides', (req, res) => {
  db.all(`SELECT rides.*, users.name as driver_name FROM rides JOIN users ON rides.driver_id = users.id WHERE rides.status = 'active'`, [], (err, rides) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ rides }); }
  });
});

app.post('/bookings', (req, res) => {
  const { ride_id, passenger_id } = req.body;
  db.run(`INSERT INTO bookings (ride_id, passenger_id, status) VALUES (?, ?, 'pending')`, [ride_id, passenger_id], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else {
      db.run(`UPDATE rides SET seats_available = seats_available - 1 WHERE id = ?`, [ride_id]);
      res.json({ message: 'Ride booked!', bookingId: this.lastID });
    }
  });
});

app.put('/bookings/:bookingId/accept', (req, res) => {
  const { bookingId } = req.params;
  db.run(`UPDATE bookings SET status = 'accepted' WHERE id = ?`, [bookingId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else {
      db.get(`SELECT bookings.*, rides.from_location, rides.to_location, rides.driver_id, users.name as driver_name FROM bookings JOIN rides ON bookings.ride_id = rides.id JOIN users ON rides.driver_id = users.id WHERE bookings.id = ?`, [bookingId], (err, booking) => {
        if (booking) {
          const autoMsg = `Hello! I have accepted your booking. I will pick you up at ${booking.from_location}. Please be ready! 🚗`;
          db.run(`INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`, [booking.driver_id, booking.passenger_id, autoMsg]);
        }
      });
      res.json({ message: 'Booking accepted!' });
    }
  });
});

app.put('/bookings/:bookingId/decline', (req, res) => {
  const { bookingId } = req.params;
  db.get(`SELECT ride_id FROM bookings WHERE id = ?`, [bookingId], (err, booking) => {
    if (err || !booking) { res.status(400).json({ error: 'Booking not found' }); }
    else {
      db.run(`UPDATE bookings SET status = 'declined' WHERE id = ?`, [bookingId]);
      db.run(`UPDATE rides SET seats_available = seats_available + 1 WHERE id = ?`, [booking.ride_id]);
      res.json({ message: 'Booking declined.' });
    }
  });
});

app.put('/bookings/:bookingId/start', (req, res) => {
  const { bookingId } = req.params;
  db.run(`UPDATE bookings SET status = 'started' WHERE id = ?`, [bookingId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else {
      db.get(`SELECT bookings.*, rides.from_location, rides.to_location, rides.driver_id FROM bookings JOIN rides ON bookings.ride_id = rides.id WHERE bookings.id = ?`, [bookingId], (err, booking) => {
        if (booking) {
          const autoMsg = `Your trip has started! We are now heading to ${booking.to_location}. Sit back and enjoy the ride! 🛣️`;
          db.run(`INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`, [booking.driver_id, booking.passenger_id, autoMsg]);
        }
      });
      res.json({ message: 'Trip started!' });
    }
  });
});

app.put('/bookings/:bookingId/end', (req, res) => {
  const { bookingId } = req.params;
  db.get(`SELECT bookings.*, rides.price, rides.driver_id, rides.to_location FROM bookings JOIN rides ON bookings.ride_id = rides.id WHERE bookings.id = ?`, [bookingId], (err, booking) => {
    if (err || !booking) { res.status(400).json({ error: 'Booking not found' }); }
    else {
      const netAmount = booking.price * 0.9;
      db.run(`UPDATE bookings SET status = 'completed' WHERE id = ?`, [bookingId]);
      db.run(`UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?`, [netAmount, booking.driver_id]);
      db.run(`INSERT INTO wallet_transactions (user_id, amount, type, description) VALUES (?, ?, 'credit', 'Trip payment received')`, [booking.driver_id, netAmount]);
      const autoMsg = `We have arrived at ${booking.to_location}! Thank you for riding with us. Please rate your experience. Have a great day! 🎉`;
      db.run(`INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`, [booking.driver_id, booking.passenger_id, autoMsg]);
      res.json({ message: 'Trip completed! Payment processed.', netAmount });
    }
  });
});

app.put('/bookings/:bookingId/cancel', (req, res) => {
  const { bookingId } = req.params;
  db.get(`SELECT ride_id FROM bookings WHERE id = ?`, [bookingId], (err, booking) => {
    if (err || !booking) { res.status(400).json({ error: 'Booking not found' }); }
    else {
      db.run(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [bookingId]);
      db.run(`UPDATE rides SET seats_available = seats_available + 1 WHERE id = ?`, [booking.ride_id]);
      res.json({ message: 'Booking cancelled!' });
    }
  });
});

app.get('/my-rides/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`SELECT rides.*, COUNT(bookings.id) as booking_count FROM rides LEFT JOIN bookings ON rides.id = bookings.ride_id WHERE rides.driver_id = ? GROUP BY rides.id ORDER BY rides.created_at DESC`, [userId], (err, rides) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ rides }); }
  });
});

app.get('/my-bookings/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`SELECT bookings.id, bookings.status as booking_status, rides.from_location, rides.to_location, rides.departure_time, rides.price, rides.driver_id, rides.id as ride_id, users.name as driver_name, users.phone as driver_phone FROM bookings JOIN rides ON bookings.ride_id = rides.id JOIN users ON rides.driver_id = users.id WHERE bookings.passenger_id = ? ORDER BY bookings.created_at DESC`, [userId], (err, bookings) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ bookings }); }
  });
});

app.get('/driver/requests/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`
    SELECT bookings.id, bookings.status, bookings.created_at,
    users.name as passenger_name, users.phone as passenger_phone,
    users.profile_picture as passenger_pic, users.id as passenger_id,
    rides.from_location, rides.to_location, rides.price, rides.departure_time
    FROM bookings JOIN rides ON bookings.ride_id = rides.id
    JOIN users ON bookings.passenger_id = users.id
    WHERE rides.driver_id = ? AND bookings.status = 'pending'
    ORDER BY bookings.created_at DESC
  `, [userId], (err, requests) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ requests }); }
  });
});

app.get('/driver/active-trip/:userId', (req, res) => {
  const { userId } = req.params;
  db.get(`
    SELECT bookings.id, bookings.status,
    rides.from_location, rides.to_location, rides.from_lat, rides.from_lng, rides.to_lat, rides.to_lng, rides.price,
    users.name as passenger_name, users.phone as passenger_phone,
    users.profile_picture as passenger_pic, users.id as passenger_id
    FROM bookings JOIN rides ON bookings.ride_id = rides.id
    JOIN users ON bookings.passenger_id = users.id
    WHERE rides.driver_id = ? AND bookings.status IN ('accepted','started')
    ORDER BY bookings.created_at DESC LIMIT 1
  `, [userId], (err, trip) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ trip: trip || null }); }
  });
});

app.get('/rider/active-trip/:userId', (req, res) => {
  const { userId } = req.params;
  db.get(`
    SELECT bookings.id, bookings.status,
    rides.from_location, rides.to_location, rides.from_lat, rides.from_lng, rides.to_lat, rides.to_lng, rides.price,
    users.name as driver_name, users.phone as driver_phone,
    users.profile_picture as driver_pic, users.id as driver_id
    FROM bookings JOIN rides ON bookings.ride_id = rides.id
    JOIN users ON rides.driver_id = users.id
    WHERE bookings.passenger_id = ? AND bookings.status IN ('accepted','started')
    ORDER BY bookings.created_at DESC LIMIT 1
  `, [userId], (err, trip) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ trip: trip || null }); }
  });
});

app.get('/driver/completed-trips/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`
    SELECT bookings.id, bookings.status, rides.from_location, rides.to_location, rides.price,
    users.name as passenger_name, users.id as passenger_id, users.profile_picture as passenger_pic
    FROM bookings JOIN rides ON bookings.ride_id = rides.id
    JOIN users ON bookings.passenger_id = users.id
    WHERE rides.driver_id = ? AND bookings.status = 'completed'
    ORDER BY bookings.created_at DESC
  `, [userId], (err, trips) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ trips }); }
  });
});

app.get('/notifications/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`SELECT bookings.id, bookings.status, bookings.created_at, users.name as passenger_name, rides.from_location, rides.to_location FROM bookings JOIN rides ON bookings.ride_id = rides.id JOIN users ON bookings.passenger_id = users.id WHERE rides.driver_id = ? ORDER BY bookings.created_at DESC`, [userId], (err, notifications) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ notifications }); }
  });
});

app.post('/messages', (req, res) => {
  const { sender_id, receiver_id, message } = req.body;
  if (!sender_id || !receiver_id || !message) {
    return res.status(400).json({ error: 'sender_id, receiver_id and message are required' });
  }
  db.run(`INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`, [sender_id, receiver_id, message], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Message sent!', messageId: this.lastID }); }
  });
});

app.get('/messages/:userId/:otherUserId', (req, res) => {
  const { userId, otherUserId } = req.params;
  db.all(`
    SELECT messages.*, users.name as sender_name FROM messages
    JOIN users ON messages.sender_id = users.id
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY messages.created_at ASC
  `, [userId, otherUserId, otherUserId, userId], (err, messages) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ messages }); }
  });
});

app.get('/conversations/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`
    SELECT
      CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user_id,
      users.name as other_user_name,
      users.profile_picture as other_user_pic,
      messages.message as last_message,
      messages.created_at
    FROM messages
    JOIN users ON users.id = CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
    WHERE sender_id = ? OR receiver_id = ?
    GROUP BY other_user_id
    ORDER BY messages.created_at DESC
  `, [userId, userId, userId, userId], (err, conversations) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ conversations }); }
  });
});

app.post('/ratings', (req, res) => {
  const { ride_id, rater_id, rated_id, rating, comment, rater_role } = req.body;
  db.run(`INSERT INTO ratings (ride_id, passenger_id, driver_id, rating, comment, rater_role) VALUES (?, ?, ?, ?, ?, ?)`,
    [ride_id, rater_id, rated_id, rating, comment, rater_role || 'rider'], function (err) {
      if (err) { res.status(400).json({ error: err.message }); }
      else { res.json({ message: 'Rating submitted!', ratingId: this.lastID }); }
    });
});

app.get('/ratings/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`
    SELECT ratings.*, users.name as rater_name FROM ratings
    JOIN users ON users.id = ratings.passenger_id
    WHERE ratings.driver_id = ? OR ratings.passenger_id = ?
    ORDER BY ratings.created_at DESC
  `, [userId, userId], (err, ratings) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else {
      const avgRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1) : 0;
      res.json({ ratings, avgRating });
    }
  });
});

app.get('/earnings/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`SELECT rides.id, rides.from_location, rides.to_location, rides.departure_time, rides.price,
    COUNT(bookings.id) as passengers,
    (rides.price * COUNT(bookings.id)) as gross_earned,
    (rides.price * COUNT(bookings.id) * 0.9) as net_earned,
    (rides.price * COUNT(bookings.id) * 0.1) as commission
    FROM rides LEFT JOIN bookings ON rides.id = bookings.ride_id
    WHERE rides.driver_id = ? AND rides.status != 'cancelled'
    GROUP BY rides.id ORDER BY rides.created_at DESC`, [userId], (err, earnings) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else {
      const totalNet = earnings.reduce((sum, e) => sum + (e.net_earned || 0), 0);
      const totalCommission = earnings.reduce((sum, e) => sum + (e.commission || 0), 0);
      const totalPassengers = earnings.reduce((sum, e) => sum + (e.passengers || 0), 0);
      res.json({ earnings, totalNet, totalCommission, totalPassengers });
    }
  });
});

app.post('/complaints', (req, res) => {
  const { user_id, subject, message } = req.body;
  db.run(`INSERT INTO complaints (user_id, subject, message) VALUES (?, ?, ?)`, [user_id, subject, message], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Complaint submitted!', complaintId: this.lastID }); }
  });
});

app.get('/complaints', (req, res) => {
  db.all(`SELECT complaints.*, users.name as user_name, users.role FROM complaints JOIN users ON complaints.user_id = users.id ORDER BY complaints.created_at DESC`, [], (err, complaints) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ complaints }); }
  });
});

app.put('/complaints/:complaintId', (req, res) => {
  const { complaintId } = req.params;
  const { status } = req.body;
  db.run(`UPDATE complaints SET status = ? WHERE id = ?`, [status, complaintId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Complaint updated!' }); }
  });
});

app.get('/referrals/:userId', (req, res) => {
  const { userId } = req.params;
  db.all(`SELECT referrals.*, users.name as referred_name, users.created_at as joined_at FROM referrals JOIN users ON referrals.referred_id = users.id WHERE referrals.referrer_id = ? ORDER BY referrals.created_at DESC`, [userId], (err, referrals) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ referrals }); }
  });
});

app.get('/wallet/:userId', (req, res) => {
  const { userId } = req.params;
  db.get(`SELECT wallet_balance FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else {
      db.all(`SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, transactions) => {
        res.json({ balance: user?.wallet_balance || 0, transactions: transactions || [] });
      });
    }
  });
});

app.get('/admin/rides', (req, res) => {
  db.all(`SELECT rides.*, users.name as driver_name FROM rides JOIN users ON rides.driver_id = users.id ORDER BY rides.created_at DESC`, [], (err, rides) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ rides }); }
  });
});

app.get('/admin/users', (req, res) => {
  db.all(`SELECT id, name, email, role, phone, is_online, wallet_balance, referral_code, created_at FROM users ORDER BY created_at DESC`, [], (err, users) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ users }); }
  });
});

app.get('/admin/bookings', (req, res) => {
  db.all(`SELECT bookings.*, rides.from_location, rides.to_location, rides.price, users.name as passenger_name FROM bookings JOIN rides ON bookings.ride_id = rides.id JOIN users ON bookings.passenger_id = users.id ORDER BY bookings.created_at DESC`, [], (err, bookings) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ bookings }); }
  });
});

app.get('/admin/documents', (req, res) => {
  db.all(`SELECT driver_documents.*, users.name as driver_name FROM driver_documents JOIN users ON driver_documents.driver_id = users.id ORDER BY driver_documents.created_at DESC`, [], (err, documents) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ documents }); }
  });
});

app.put('/admin/documents/:driverId/verify', (req, res) => {
  const { driverId } = req.params;
  db.run(`UPDATE driver_documents SET verified = 1, rejection_reason = NULL WHERE driver_id = ?`, [driverId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Driver verified!' }); }
  });
});

app.put('/admin/documents/:driverId/reject', (req, res) => {
  const { driverId } = req.params;
  const { reason } = req.body;
  db.run(`UPDATE driver_documents SET verified = 0, rejection_reason = ? WHERE driver_id = ?`, [reason, driverId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Documents rejected!' }); }
  });
});

app.get('/admin/revenue', (req, res) => {
  db.all(`SELECT rides.id, rides.price, COUNT(bookings.id) as passengers, (rides.price * COUNT(bookings.id) * 0.1) as commission FROM rides LEFT JOIN bookings ON rides.id = bookings.ride_id WHERE rides.status != 'cancelled' GROUP BY rides.id`, [], (err, data) => {
    if (err) { res.status(400).json({ error: err.message }); }
    else {
      const totalRevenue = data.reduce((sum, d) => sum + (d.commission || 0), 0);
      const totalRides = data.length;
      const totalPassengers = data.reduce((sum, d) => sum + (d.passengers || 0), 0);
      res.json({ data, totalRevenue, totalRides, totalPassengers });
    }
  });
});

app.put('/rides/:rideId/cancel', (req, res) => {
  const { rideId } = req.params;
  db.run(`UPDATE rides SET status = 'cancelled' WHERE id = ?`, [rideId], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: 'Ride cancelled!' }); }
  });
});

app.get('/setup-admin/:email', (req, res) => {
  const { email } = req.params;
  db.run(`UPDATE users SET role = 'admin' WHERE email = ?`, [email], function (err) {
    if (err) { res.status(400).json({ error: err.message }); }
    else { res.json({ message: `Admin role set for ${email}!` }); }
  });
});

// Migrations
db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'rider'`, () => {});
db.run(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE users ADD COLUMN profile_picture TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0`, () => {});
db.run(`ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0`, () => {});
db.run(`ALTER TABLE users ADD COLUMN referral_code TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE rides ADD COLUMN price REAL DEFAULT 0`, () => {});
db.run(`ALTER TABLE rides ADD COLUMN waypoints TEXT DEFAULT ''`, () => {});
db.run(`ALTER TABLE rides ADD COLUMN full_route TEXT DEFAULT ''`, () => {});
db.run(`ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT 'pending'`, () => {});
db.run(`ALTER TABLE driver_documents ADD COLUMN license_front TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE driver_documents ADD COLUMN license_back TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE driver_documents ADD COLUMN national_id_front TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE driver_documents ADD COLUMN national_id_back TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE driver_documents ADD COLUMN face_photo TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE driver_documents ADD COLUMN rejection_reason TEXT DEFAULT NULL`, () => {});
db.run(`ALTER TABLE ratings ADD COLUMN rater_role TEXT DEFAULT 'rider'`, () => {});
db.run(`CREATE TABLE IF NOT EXISTS driver_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, driver_id INTEGER, license_front TEXT, license_back TEXT, national_id_front TEXT, national_id_back TEXT, insurance_image TEXT, roadworthiness_image TEXT, face_photo TEXT, verified INTEGER DEFAULT 0, rejection_reason TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`, () => {});
db.run(`CREATE TABLE IF NOT EXISTS complaints (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, subject TEXT, message TEXT, status TEXT DEFAULT 'open', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`, () => {});
db.run(`CREATE TABLE IF NOT EXISTS referrals (id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_id INTEGER, referred_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`, () => {});
db.run(`CREATE TABLE IF NOT EXISTS wallet_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount REAL, type TEXT, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`, () => {});
db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER, receiver_id INTEGER, message TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`, () => {});
db.run(`CREATE TABLE IF NOT EXISTS ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, ride_id INTEGER, passenger_id INTEGER, driver_id INTEGER, rating INTEGER, comment TEXT, rater_role TEXT DEFAULT 'rider', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`, () => {});

setTimeout(() => {
  db.run(`UPDATE users SET role = 'admin' WHERE email = 'homatekpor@gmail.com'`, () => {
    console.log('Admin role restored for homatekpor@gmail.com');
  });
}, 2000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});