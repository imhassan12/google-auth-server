require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors()); // Allow Unity to access API

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Store tokens per session
let tokenStorage = {};

// Step 1: Redirect user to Google OAuth
app.get("/auth/google", (req, res) => {
    const sessionId = req.query.sessionId; // Get session ID from Unity
    if (!sessionId) {
        return res.status(400).json({ error: "Missing session ID" });
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `response_type=code&client_id=${CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&scope=openid%20email%20profile&access_type=offline&prompt=consent` +
        `&state=${sessionId}`; // Attach session ID

    res.redirect(authUrl);
});

// Step 2: Handle Google OAuth callback
app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    const sessionId = req.query.state; // Retrieve session ID

    if (!code || !sessionId) {
        return res.status(400).send("Invalid request.");
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await axios.post("https://oauth2.googleapis.com/token", null, {
            params: {
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: "authorization_code",
            },
        });

        const { id_token } = tokenResponse.data;

        // Store token with session ID
        tokenStorage[sessionId] = id_token;

        res.send("<h2>Authentication successful! You can close this window and return to the app.</h2>");
    } catch (error) {
        console.error("Token exchange failed:", error.response?.data || error.message);
        res.status(500).send("Authentication failed");
    }
});

// Step 3: Unity fetches the token
app.get("/auth/token", (req, res) => {
    const sessionId = req.query.sessionId; // Get session ID from request

    if (sessionId && tokenStorage[sessionId]) {
        res.json({ id_token: tokenStorage[sessionId] });
        delete tokenStorage[sessionId]; // Clear after sending
    } else {
        res.status(404).json({ error: "Token not available" });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
