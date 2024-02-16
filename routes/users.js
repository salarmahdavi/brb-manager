const express = require('express');
const router = express.Router();
const { isLoggedIn, notLoggedIn, checkUserType } = require("../middlewares/authMiddleware");
const passport = require('passport');
const User = require('../database/User');
const { body, validationResult } = require('express-validator');

const isLoggedInMd = (req) => {
  return req.isAuthenticated();
};

const isAdminMd = (req) => {
  return isLoggedInMd(req) && req.user.type === "admin";
};

router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/login', notLoggedIn, (req, res) => {
  res.render("login", { message: req.flash('error'), user: req.user, isLoggedIn: isLoggedInMd(req), isAdmin: isAdminMd(req) });
});

router.post('/login', notLoggedIn, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/users/login',
  failureFlash: true
}));

router.get('/logout', isLoggedIn, (req, res) => {
  req.logout(() => {
    return res.redirect('/');
  });
});

router.get('/addUser', isLoggedIn, checkUserType(['admin']), (req, res) => {
  res.render("add_user", { message: req.flash('error'), success: req.flash('success'), user: req.user, isLoggedIn: isLoggedInMd(req), isAdmin: isAdminMd(req) });
});

router.post('/addUser', isLoggedIn, checkUserType(['admin']), 
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('type').notEmpty().withMessage('Type is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      req.flash('error', errorMessages);
      return res.redirect('/users/addUser');
    }

    try {
      const { name, username, password, type } = req.body;

      const user = await User.findOne({ username }).exec();

      if (user) {
        req.flash('error', 'User already exists');
        return res.redirect('/users/addUser');
      } else {
        const newUser = new User({ name, username, password, type });
        await newUser.save();
        req.flash('success', 'User added successfully');
        return res.redirect("/users/addUser");
      }

    } catch (error) {
      console.error(`[ERROR] ${error}`);
      res.status(500).send("Internal Server Error");
    }
});

router.get('/list', isLoggedIn, checkUserType(['admin']), async (req, res) => {
  try {
    const users = await User.find().exec();
    res.render("users_list", { users, user: req.user, isLoggedIn: isLoggedInMd(req), isAdmin: isAdminMd(req) });
  } catch (error) {
    console.error(`Error fetching users: ${error}`);
    res.status(500).send("Internal Server Error");
  }
});

router.get('/editUser/:id', isLoggedIn, checkUserType(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).exec();
    if (!user) {
      return res.status(404).send("User not found");
    }
    res.render("edit_user", { user, isLoggedIn: isLoggedInMd(req), isAdmin: isAdminMd(req) });
  } catch (error) {
    console.error(`Error fetching user: ${error}`);
    res.status(500).send("Internal Server Error");
  }
});

router.post('/editUser/:id', isLoggedIn, checkUserType(['admin']), async (req, res) => {
  try {
    const { name, username, type, password } = req.body;
    
    const userToUpdate = await User.findById(req.params.id).exec();
    if (!userToUpdate) {
      req.flash('error', 'User not found');
      return res.redirect("/users/list");
    }

    if (password) {
      userToUpdate.password = password;
    }

    userToUpdate.name = name;
    userToUpdate.username = username;
    userToUpdate.type = type;

    await userToUpdate.save();

    req.flash('success', 'User updated successfully');
    return res.redirect("/users/list");
  } catch (error) {
    console.error(`Error updating user: ${error}`);
    req.flash('error', 'Failed to update user');
    res.redirect("/users/list");
  }
});

router.post('/removeUser/:id', isLoggedIn, checkUserType(['admin']), async (req, res) => {
  try {
    const userToRemove = await User.findOneAndDelete({ _id: req.params.id }).exec();
    if (!userToRemove) {
      return res.status(404).send("User not found");
    }
    if (userToRemove.type === 'admin') {
      return res.status(403).send("Admin user cannot be removed");
    }
    req.flash('success', 'User removed successfully');
    return res.redirect("/users/list");
  } catch (error) {
    console.error(`Error removing user: ${error}`);
    req.flash('error', 'Failed to remove user');
    res.redirect("/users/list");
  }
});

router.get('/editPassword', isLoggedIn, (req, res) => {
  res.render("edit_password", { message: req.flash('error'), success: req.flash('success'), user: req.user, isLoggedIn: isLoggedInMd(req), isAdmin: isAdminMd(req) });
});

router.post('/editPassword', isLoggedIn, async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const user = await User.findById(req.user._id).exec();

    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect("/users/editPassword");
    }

    const isPasswordValid = await user.comparePassword(oldPassword);
    if (!isPasswordValid) {
      req.flash('error', 'Incorrect current password');
      return res.redirect("/users/editPassword");
    }

    if (newPassword !== confirmPassword) {
      req.flash('error', 'New password and confirm password do not match');
      return res.redirect("/users/editPassword");
    }

    user.password = newPassword;
    await user.save();

    req.flash('success', 'Password updated successfully');
    return res.redirect("/users/editPassword");
  } catch (error) {
    console.error(`Error updating password: ${error}`);
    req.flash('error', 'Failed to update password');
    res.redirect("/users/editPassword");
  }
});

module.exports = router;