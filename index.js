require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());
app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let tokenStorage = {};

app.get("/auth/google", (req, res) => {
    const sessionId = uuidv4();
    tokenStorage[sessionId] = { status: "pending" }; // Initialize storage
    console.log(`Generated sessionId: ${sessionId}`);

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `response_type=code&client_id=${CLIENT_ID}` +
        `&redirect_uri=${REDIRECT_URI}` +
        `&scope=openid%20email%20profile&access_type=offline&prompt=consent` +
        `&state=${sessionId}`;

    // Return sessionId to Unity before redirecting
    res.json({ sessionId, authUrl });
});

app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    const sessionId = req.query.state;
    console.log(`Callback - Code: ${code}, SessionId: ${sessionId}`);

    if (!code || !sessionId || !tokenStorage[sessionId]) {
        console.error("Invalid callback parameters");
        return res.status(400).send("Invalid request");
    }

    try {
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
        tokenStorage[sessionId] = { status: "completed", id_token };
        console.log(`Stored token for ${sessionId}: ${id_token}`);

        res.send("<h2>Authentication successful! Close this window.</h2>");
    } catch (error) {
        console.error("Token exchange failed:", error.response?.data || error.message);
        res.status(500).send("Authentication failed");
    }
});

app.get("/auth/token", (req, res) => {
    const sessionId = req.query.sessionId;
    console.log(`Token request for sessionId: ${sessionId}`);

    if (!sessionId || !tokenStorage[sessionId] || tokenStorage[sessionId].status === "pending") {
        console.log(`Token not ready for ${sessionId}`);
        res.status(404).json({ error: "Token not available" });
    } else {
        const token = tokenStorage[sessionId].id_token;
        res.json({ id_token: token });
        delete tokenStorage[sessionId];
        console.log(`Sent and cleared token for ${sessionId}`);
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});