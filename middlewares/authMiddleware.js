const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/users/login");
  }
};

const notLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/users/");
  }
};

const checkUserType = (allowedUserTypes) => {
  return (req, res, next) => {
    const userType = req.user.type;
    if (allowedUserTypes.includes(userType)) {
      return next();
    }
    res.status(403).send('Forbidden');
  };
};

module.exports = {
  isLoggedIn,
  notLoggedIn,
  checkUserType
};
