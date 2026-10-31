import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

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
app.post("/add-event", async (req, res) => {
  const event = req.body;

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
app.get("/my-events/:email", async (req, res) => {
  const email = req.params.email;

  const events = await userCollection.find({ organizerEmail: email }).toArray();
  res.send(events);
});

// Update Events
app.put("/events/:id", async (req, res) => {
  const { email, ...data } = req.body;
  const id = new ObjectId(req.params.id);
  const event = await userCollection.findOne({
    _id: id,
    organizerEmail: email,
  });

  await userCollection.updateOne({ _id: id }, { $set: data });
  await eventCollection.updateOne({ _id: event.allEventId }, { $set: data });

  res.send(event);
});

// Delete event
app.delete("/events/:id", async (req, res) => {
  const id = new ObjectId(req.params.id);
  const { organizerEmail } = req.body;

  const event = await userCollection.findOne({
    _id: id,
    organizerEmail,
  });

  await userCollection.deleteOne({ _id: id });
  await eventCollection.deleteOne({ _id: event.allEventId });

  res.send(event);
});

// event details page
app.get("/events/:id", async (req, res) => {
  const id = new ObjectId(req.params.id);
  const event = await eventCollection.findOne({ _id: id });

  res.send(event);
});

// join event
app.post("/join-event", async (req, res) => {
  const joinedEvent = req.body;
  await joinedEventsCollection.insertOne(joinedEvent);
  res.send({ message: "Joined successfully" });
});

// Leave Event
app.delete("/leave-event", async (req, res) => {
  const { eventId, email } = req.body;

  await joinedEventsCollection.deleteOne({ eventId, email });

  res.send({ message: "Left successfully" });
});

// এই API-টা ব্যবহার করছি একজন user কোন কোন event-এ Join করেছে, সেগুলো বের করার জন্য।
app.get("/joined-events/:email", async (req, res) => {
  const email = req.params.email;

  const events = await joinedEventsCollection
    .find({ email: email })
    .sort({ eventDate: 1 })
    .toArray();

  res.send(events);
});

// Check user joined ase kina
app.get("/joined-events/:email/:eventId", async (req, res) => {
  const { email, eventId } = req.params;
  const event = await joinedEventsCollection.findOne({ email, eventId });

  res.send({
    isJoined: event ? true : false,
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

export default app;
