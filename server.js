// server.js
require("dotenv").config();
const express = require("express");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for session management
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Ensure this is set correctly
    resave: false,
    saveUninitialized: true,
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport to use GitHub strategy
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "/auth/github/callback",
    },
    function (accessToken, refreshToken, profile, done) {
      // Here you can save the user profile to your database if needed
      return done(null, profile);
    }
  )
);

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from the session
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Routes
app.get("/", (req, res) => {
  res.send(
    '<h1>Welcome to UbiquityOS Plugin Installer</h1><a href="/auth/github">Login with GitHub</a>'
  );
});

// GitHub authentication route
app.get("/auth/github", passport.authenticate("github"));

// GitHub callback route
app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    // Successful authentication, redirect to the main page or dashboard
    res.redirect("/dashboard");
  }
);

// Dashboard route (protected)
app.get("/dashboard", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }
  res.send(
    `<h1>Hello ${req.user.username}</h1><p><a href="/logout">Logout</a></p>`
  );
});

// Logout route
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

// Configuration update route (protected)
app.post("/update-config", (req, res) => {
  console.log("User authenticated:", req.isAuthenticated());
  console.log("User object:", req.user); // Log the user object
  if (!req.isAuthenticated()) {
    return res.status(403).send("Unauthorized");
  }

  // Check if the user has permission to update the configuration
  if (!req.user || !req.user.isAdmin) {
    // Example permission check
    return res
      .status(403)
      .send("Forbidden: You do not have permission to perform this action.");
  }

  const newConfig = req.body; // Get new config from request body

  // Read the existing configuration
  const currentConfig = readConfig();

  // Update the configuration (merge or replace as needed)
  const updatedConfig = { ...currentConfig, ...newConfig };

  // Write the updated configuration back to the file
  writeConfig(updatedConfig);

  res.send("Configuration updated successfully");
});

// Function to read the configuration
function readConfig() {
  const data = fs.readFileSync(configFilePath);
  return JSON.parse(data);
}

// Function to write to the configuration
function writeConfig(newConfig) {
  fs.writeFileSync(configFilePath, JSON.stringify(newConfig, null, 2));
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
