import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import Database from "better-sqlite3";
import twilio from "twilio";

const db = new Database("messenger.db");

// Twilio Client Setup
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE,
    name TEXT,
    avatar TEXT
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_phone TEXT,
    receiver_phone TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes for Auth
  app.post("/api/auth/send-otp", async (req, res) => {
    const { phone } = req.body;
    
    if (twilioClient && VERIFY_SERVICE_SID) {
      try {
        await twilioClient.verify.v2.services(VERIFY_SERVICE_SID)
          .verifications.create({ to: phone, channel: "sms" });
        res.json({ success: true, mode: "real" });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    } else {
      // Fallback for demo
      console.log(`[DEMO MODE] OTP sent to ${phone}. Use any 6 digits.`);
      res.json({ success: true, mode: "simulated" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    const { phone, code } = req.body;

    let verified = false;

    if (twilioClient && VERIFY_SERVICE_SID) {
      try {
        const verification = await twilioClient.verify.v2.services(VERIFY_SERVICE_SID)
          .verificationChecks.create({ to: phone, code });
        verified = verification.status === "approved";
      } catch (error) {
        verified = false;
      }
    } else {
      // Demo mode: any 6 digit code works
      verified = code.length === 6;
    }

    if (verified) {
      let user = db.prepare("SELECT * FROM users WHERE phone = ?").get(phone);
      if (!user) {
        user = { 
          phone, 
          name: `User ${phone.slice(-4)}`, 
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${phone}` 
        };
        db.prepare("INSERT INTO users (phone, name, avatar) VALUES (?, ?, ?)").run(user.phone, user.name, user.avatar);
      }
      res.json({ success: true, user });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  });

  app.get("/api/messages/:phone1/:phone2", (req, res) => {
    const { phone1, phone2 } = req.params;
    const messages = db.prepare(`
      SELECT * FROM messages 
      WHERE (sender_phone = ? AND receiver_phone = ?) 
      OR (sender_phone = ? AND receiver_phone = ?)
      ORDER BY timestamp ASC
    `).all(phone1, phone2, phone2, phone1);
    res.json(messages);
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users").all();
    res.json(users);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket Server
  const wss = new WebSocketServer({ server });
  const clients = new Map<string, WebSocket>();

  wss.on("connection", (ws) => {
    let userPhone: string | null = null;

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === "auth") {
        userPhone = message.phone;
        if (userPhone) clients.set(userPhone, ws);
      } else if (message.type === "chat") {
        const { sender, receiver, content } = message;
        
        // Save to DB
        db.prepare("INSERT INTO messages (sender_phone, receiver_phone, content) VALUES (?, ?, ?)")
          .run(sender, receiver, content);

        // Send to receiver if online
        const receiverSocket = clients.get(receiver);
        if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
          receiverSocket.send(JSON.stringify({ type: "chat", sender, content, timestamp: new Date().toISOString() }));
        }
      }
    });

    ws.on("close", () => {
      if (userPhone) clients.delete(userPhone);
    });
  });
}

startServer();
