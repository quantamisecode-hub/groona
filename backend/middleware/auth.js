/* aivorabackend/middleware/auth.js */
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Helper to safely get the UserSession model
const getUserSessionModel = () => {
  try {
    return mongoose.model('UserSession');
  } catch (e) {
    return null; // Model might not be loaded yet in some test envs
  }
};

module.exports = async function (req, res, next) {
  // Get token from header
  const token = req.header('Authorization')?.replace('Bearer ', '');

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;

    // --- ROBUST SESSION CHECK ---
    // If the token has a session_id, verify it still exists in DB
    if (req.user.session_id) {
      const UserSession = getUserSessionModel();
      if (UserSession) {
        const session = await UserSession.findById(req.user.session_id);
        if (!session) {
          return res.status(401).json({ msg: 'Session expired or revoked. Please login again.' });
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    next();
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(401).json({ msg: 'Token is not valid' });
  }
};