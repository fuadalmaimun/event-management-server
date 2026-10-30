import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";


const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const mongoClient = await connectToMongoDB();
const db = mongoClient.db("event-platform");
const eventCollection = db.collection("events");


// Root Route
app.get("/", (req, res) => {
  res.send("GoodTogether Server is Running!");
});

// insert event
app.post("/add-event", async (req, res) => {
  const event = req.body;
  const result = await eventCollection.insertOne(event);
  res.send(result);
});

// Get all events
app.get("/events", async (req, res) => {
  const events = await eventCollection.find().toArray();
  res.send(events);
});


// Update a event
app.put("/events/:id",  async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  const result = await eventCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: data },
  );

  res.json(result);
});

// Delete a delete
app.delete("/events/:id",  async (req, res) => {
  const { id } = req.params;

  const result = await eventCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});

app.listen(port, () => {
  console.log(`A08 Server is running at http://localhost:${port}`);
});
