const expressSession = require('express-session');

const sessionMiddleware = expressSession({
  secret: process.env.SECRET_KEY || "lPolIFxv6FbWrO07zPjrXzBEVIjW8PU9",
  resave: false,
  saveUninitialized: false
});

module.exports = sessionMiddleware;