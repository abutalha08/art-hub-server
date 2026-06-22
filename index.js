const express = require('express');
const dotenv = require('dotenv');
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();


const app = express()
const port = process.env.PORT

app.use(cors());
app.use(express.json());




const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

// DB
const db = client.db("art_hub_db");
const artworksCollection = db.collection("artworks");
const userCollection = db.collection("user");
const purchasesCollection = db.collection("purchases");

// CREATE ARTWORK 
app.post("/api/artworks", async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      image,
      artistEmail,
      artistName, 
      artistId,
    } = req.body;


    const newArtwork = {
      title: title,
      description: description,
      price: Number(price),
      category,
      image,
      artistEmail,
      artistName: artistName || "Unknown Artist",
      artistId: artistId || null,

      // marketplace fields (required for future dashboard/admin)
      likes: 0,
      views: 0,
      commentsCount: 0,

      // auto approval (NO admin approval system)
      isApproved: true,
      createdAt: new Date(),
    };
    // INSERT
    const result = await artworksCollection.insertOne(newArtwork);

    return res.status(201).json({
      success: true,
      message: "Artwork created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("ARTWORK_CREATE_ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});



//show in the manageArtwork table
app.get('/api/artworks/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const result = await artworksCollection
      .find({ artistEmail: email })
      .toArray();

    return res.status(200).json(result);
  } catch (error) {
    console.error("FETCH_MY_ARTWORKS_ERROR:", error);
    return res.status(500).json({ error: "Failed to fetch artworks" });
  }
});

 app.delete("/api/artworks/:id", async (req, res) => {
  const { id } = req.params;

  const result = await artworksCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.json(result);
});

 app.patch("/api/artworks/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
    //   console.log(updatedData);

      const result = await artworksCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updatedData },
      );

      res.json(result);
    });

    app.get("/api/artworks", async (req, res) => {
        const cursor = artworksCollection.find();
        const result = await cursor.toArray();
        res.send(result);
    });

    app.get("/api/single-artworks/:id", async (req, res) => {
        const {id} = req.params;
        const query = {_id: new ObjectId(id)};
        const result = await artworksCollection.findOne(query);
        res.send(result);
    })

    app.get("/api/artist-stats/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await artworksCollection
      .aggregate([
        {
          $match: {
            artistEmail: email,
          },
        },
        {
          $group: {
            _id: null,
            totalArtworks: { $sum: 1 },
            totalArtworkValue: { $sum: "$price" },
          },
        },
      ])
      .toArray();

    res.json(
      result[0] || {
        totalArtworks: 0,
        totalArtworkValue: 0,
      }
    );
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch artist stats",
    });
  }
});

app.post("/api/purchases", async (req, res) => {
  try {
    const {
      artworkId,
      buyerEmail,
      buyerName,
    } = req.body;

    // 1. artwork fetch
    const artwork = await artworksCollection.findOne({
      _id: new ObjectId(artworkId),
    });

    if (!artwork) {
      return res.status(404).json({
        success: false,
        message: "Artwork not found",
      });
    }

    // 2. purchase object
    const newPurchase = {
      artworkId: artwork._id,
      title: artwork.title,
       image: artwork.image,
      price: artwork.price,
      category: artwork.category,
      artistName: artwork.artistName,
      artistEmail: artwork.artistEmail,

      buyerEmail,
      buyerName,

      purchasedAt: new Date(),
    };

    // 3. save to DB
    const result = await purchasesCollection.insertOne(newPurchase);

    res.status(201).json({
      success: true,
      message: "Purchase successful",
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.error("PURCHASE ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});
app.get("/api/purchases/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const result = await purchasesCollection
      .find({ buyerEmail: email })
      .sort({ purchaseDate: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Failed to fetch purchases",
    });
  }
});




    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})