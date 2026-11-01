import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.EVENT_CLIENT}/api/auth/jwks`),
);

// JWT
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).send({
        message: "Unauthorized access",
      });
    }

    const token = authHeader.split(" ")[1];
    const { payload } = await jwtVerify(token, JWKS);

    console.log("JWT verified successfully");
    console.log("Token subject:", payload.sub);

    req.user = payload;
    next();
  } catch (error) {
    console.error("JWT verification failed:", {
      name: error.name,
      code: error.code,
      message: error.message,
    });

    return res.status(401).send({
      message: "Invalid or expired token",
    });
  }
};

// MongoDB
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

const db = client.db("event-platform");
const eventCollection = db.collection("all-events");
const userCollection = db.collection("my-events");
const joinedEventsCollection = db.collection("joined-events");

// Test
app.get("/", (req, res) => {
  res.send("GoodTogether Server is Running!");
});

// Add event
app.post("/add-event", verifyToken, async (req, res) => {
  const event = {
    ...req.body,
    organizerEmail: req.user.email,
  };
  const result = await eventCollection.insertOne(event);

  await userCollection.insertOne({
    ...event,
    allEventId: result.insertedId,
  });

  res.send(result);
});

// Get all events
app.get("/events", async (req, res) => {
  const events = await eventCollection.find().toArray();
  res.send(events);
});

// Get my events
app.get("/my-events", verifyToken, async (req, res) => {
  const email = req.user.email;

  const events = await userCollection
    .find({ organizerEmail: email })
    .toArray();

  res.send(events);
});

// Update Events
app.put("/events/:id", verifyToken, async (req, res) => {
  const { email, ...data } = req.body;
  const id = new ObjectId(req.params.id);

  const event = await userCollection.findOne({
    _id: id,
    organizerEmail: req.user.email,
  });

  if (!event) {
    return res.status(403).send({
      message: "You are not allowed to update this event",
    });
  }

  await userCollection.updateOne(
    { _id: id },
    { $set: data },
  );

  await eventCollection.updateOne(
    { _id: event.allEventId },
    { $set: data },
  );

  res.send({ message: "Event updated successfully" });
});


// Delete event
app.delete("/events/:id", verifyToken, async (req, res) => {
  const id = new ObjectId(req.params.id);

  const event = await userCollection.findOne({
    _id: id,
    organizerEmail: req.user.email,
  });

  if (!event) {
    return res.status(403).send({
      message: "You are not allowed to delete this event",
    });
  }

  await userCollection.deleteOne({ _id: id });

  await eventCollection.deleteOne({
    _id: event.allEventId,
  });

  res.send({ message: "Event deleted successfully" });
});

// event details page
app.get("/events/:id", async (req, res) => {
  const id = new ObjectId(req.params.id);
  const event = await eventCollection.findOne({ _id: id });

  res.send(event);
});

// Join Event
app.post("/join-event", verifyToken, async (req, res) => {
  const email = req.user.email;
  const { eventId } = req.body;

  const exists = await joinedEventsCollection.findOne({
    email,
    eventId,
  });

  if (exists) {
    return res.status(409).send({ message: "Already joined" });
  }

  await joinedEventsCollection.insertOne({
    ...req.body,
    email,
  });

  res.send({ message: "Joined successfully" });
});

// Leave Event
app.delete("/leave-event", verifyToken, async (req, res) => {
  const { eventId } = req.body;

  const email = req.user.email;

  await joinedEventsCollection.deleteOne({ eventId, email });

  res.send({ message: "Left successfully" });
});

// এই API-টা ব্যবহার করছি একজন user কোন কোন event-এ Join করেছে, সেগুলো বের করার জন্য।
app.get("/joined-events/:email/:eventId", verifyToken, async (req, res) => {
  const { eventId } = req.params;
  const email = req.user.email;

  const event = await joinedEventsCollection.findOne({
    email,
    eventId,
  });

  res.send({
    isJoined: !!event,
  });
});

// Check user joined ase kina
app.get("/joined-events", verifyToken, async (req, res) => {
  const email = req.user.email;

  const events = await joinedEventsCollection
    .find({ email })
    .sort({ eventDate: 1 })
    .toArray();

  res.send(events);
});

// featured events
app.get("/featured-events", async (req, res) => {
  const result = await eventCollection.find().limit(6).toArray();
  res.send(result);
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;
