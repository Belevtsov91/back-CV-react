require("dotenv").config();
const mongoose = require("mongoose");

const URI = process.env.MONGODB_URI;
if (!URI) { console.error("MONGODB_URI not set"); process.exit(1); }

const TestSchema = new mongoose.Schema({ ping: String, ts: Date });
const TestModel = mongoose.model("TestPing", TestSchema);

async function run() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(URI);
  console.log("✅ Connected! Host:", mongoose.connection.host);

  console.log("\nInserting test document...");
  const doc = await TestModel.create({ ping: "hello", ts: new Date() });
  console.log("✅ Inserted:", doc._id.toString());

  console.log("\nReading it back...");
  const found = await TestModel.findById(doc._id).lean();
  console.log("✅ Found:", found);

  console.log("\nDeleting test document...");
  await TestModel.deleteOne({ _id: doc._id });
  console.log("✅ Deleted.");

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("\n📦 Collections in DB:", collections.map(c => c.name));

  await mongoose.disconnect();
  console.log("\n✅ Disconnected. Cluster is working!");
}

run().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
