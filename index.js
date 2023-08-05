const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

// Init express
const app = express();
app.use(bodyParser.json());

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https:/akashpise-bb5cb.firebaseio.com",
});

const db = admin.firestore();

// Define your routes here
const PORT = process.env.PORT || 8181;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Add this route for user creation
app.post("/api/add/user", async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        if (!email || !password || !displayName) {
            return res.status(400).json({
                success: false,
                message: "All fields (email, password, displayName) are required.",
            });
        }

        // Create user in Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
        });

        // Save user data to Firestore or any other required actions
        // ...

        res.status(201).json({ success: true, user: userRecord });
    } catch (error) {
        console.error(error);

        if (error.code === "auth/email-already-exists") {
            return res.status(400).json({
                success: false,
                message: "The email address is already in use by another account.",
            });
        }

        res.status(500).json({ success: false, message: "User creation failed" });
    }
});

// Forgot password API

// Apply rate limiting middleware for password reset endpoint
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // Limit to 5 requests per window
  message: { success: false, message: "Password reset request limit exceeded. Please try again later." },
});
app.post("/api/forgot-password/user", passwordResetLimiter, async (req, res) => {
    try {
        const { email } = req.body;
    
        if (!email) {
          return res.status(400).json({
            success: false,
            message: "Email is required.",
          });
        }
    
        // Generate password reset link using Firebase Admin SDK
        const actionCodeSettings = {
          url: 'https://akashpise-bb5cb.firebaseapp.com/reset-password',
          handleCodeInApp: true, // This would handle the reset in your app client
        };
    
        const resetLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
    
        // Send email using Nodemailer
        const transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: 'akash.pise@nymbleup.com',
            pass: 'Nymbleup@123'
          }
        });
    
        const mailOptions = {
          from: 'akash.pise@nymbleup.com',
          to: email,
          subject: 'Password Reset',
          text: `Click the following link to reset your password: ${resetLink}`
        };
    
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error(error);
            return res.status(500).json({ success: false, message: "Failed to send password reset email." });
          }
          console.log('Email sent: ' + info.response);
          res.status(200).json({ success: true, message: "Password reset email sent successfully." });
        });
    
      } catch (error) {
        console.error(error);
    
        if (error.code === "auth/user-not-found") {
          return res.status(404).json({
            success: false,
            message: "User not found with the provided email.",
          });
        }
    
        res.status(500).json({ success: false, message: "Failed to generate password reset link." });
      }
});


// Auth api
app.post("/auth/login/user", async (req, res) => {
    try {
        const { token } = req.body;
        const decodedToken = await admin.auth().verifyIdToken(token);
        res.json({ success: true, user: decodedToken });
    } catch (error) {
        res.status(401).json({ success: false, message: "Authentication failed" });
    }
});

// Middleware to check if user is authenticated
const isAuthenticated = async (req, res, next) => {
    try {
        const { authorization } = req.headers;
        if (!authorization) throw new Error("Authorization header missing");

        const token = authorization.replace("Bearer ", "");
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;

        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Authentication failed" });
    }
};

// Apply the authentication middleware to protect the route
app.post("/api/images/user", isAuthenticated, async (req, res) => {
    try {
        const image = req.body;
        const newImageRef = await db.collection("images").add(image);
        res.json({ success: true, imageId: newImageRef.id });
    } catch (error) {
        res.status(500).json({ success: false, message: "Error creating image" });
    }
});
