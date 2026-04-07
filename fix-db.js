const db = require('./database');

db.serialize(() => {
  db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'rider'`, (err) => {
    if (err) console.log('role column:', err.message);
    else console.log('role column added!');
  });

  db.run(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL`, (err) => {
    if (err) console.log('phone column:', err.message);
    else console.log('phone column added!');
  });

  db.run(`ALTER TABLE users ADD COLUMN profile_picture TEXT DEFAULT NULL`, (err) => {
    if (err) console.log('profile_picture column:', err.message);
    else console.log('profile_picture column added!');
  });

  db.run(`ALTER TABLE users ADD COLUMN is_online INTEGER DEFAULT 0`, (err) => {
    if (err) console.log('is_online column:', err.message);
    else console.log('is_online column added!');
  });

  db.run(`ALTER TABLE users ADD COLUMN wallet_balance REAL DEFAULT 0`, (err) => {
    if (err) console.log('wallet_balance column:', err.message);
    else console.log('wallet_balance column added!');
  });

  db.run(`ALTER TABLE users ADD COLUMN referral_code TEXT DEFAULT NULL`, (err) => {
    if (err) console.log('referral_code column:', err.message);
    else console.log('referral_code column added!');
  });

  setTimeout(() => {
    db.run(`UPDATE users SET role = 'admin' WHERE email = 'homatekpor@gmail.com'`, (err) => {
      if (err) console.log('Error:', err.message);
      else console.log('Admin role set for homatekpor@gmail.com!');
    });
  }, 1000);
});