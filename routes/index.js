var express = require('express');
var router = express.Router();

const isLoggedIn = (req) => {
  return req.isAuthenticated();
};

const isAdmin = (req) => {
  return isLoggedIn(req) && req.user.type === "admin";
};

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { user: req.user, isLoggedIn: isLoggedIn(req), isAdmin: isAdmin(req) });
});

router.get('/login', (req, res) => {
  res.redirect("/users/login");
});

module.exports = router;
