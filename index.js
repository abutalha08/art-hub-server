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
const commentsCollection = db.collection("comments");
const subscriptionCollection = db.collection("subscription");
const subscribeCollection = db.collection('subscribe')

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
      .sort({ purchasedAt: -1 })
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
app.get("/api/buyer-stats/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const totalCollection = await purchasesCollection.countDocuments({
      buyerEmail: email,
    });

    res.json({
      totalCollection,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch buyer stats",
    });
  }
});

//Comment Create API
app.post("/api/artworks/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      userId,
      userName,
      userEmail,
      comment,
    } = req.body;

    if (!comment?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment is required",
      });
    }

    // Purchase check
    const purchased = await purchasesCollection.findOne({
      artworkId: new ObjectId(id),
      buyerEmail: userEmail,
    });

    if (!purchased) {
      return res.status(403).json({
        success: false,
        message: "Purchase required before commenting",
      });
    }

    const newComment = {
      artworkId: new ObjectId(id),
      userId,
      userName,
      userEmail,
      comment,
      createdAt: new Date(),
      updatedAt: null,
    };

    const result = await commentsCollection.insertOne(
      newComment
    );

    res.status(201).json({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to add comment",
    });
  }
});

//Get Comments API
app.get("/api/artworks/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;

    const comments = await commentsCollection
      .find({
        artworkId: new ObjectId(id),
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(comments);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to load comments",
    });
  }
});

app.get(
  "/api/artworks/:id/can-comment/:email",
  async (req, res) => {
    try {
      const { id, email } = req.params;

      const purchased =
        await purchasesCollection.findOne({
          artworkId: new ObjectId(id),
          buyerEmail: email,
        });

      res.send({
        canComment: !!purchased,
      });
    } catch (error) {
      res.status(500).send({
        canComment: false,
      });
    }
  }
);

app.patch("/api/comments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { comment } = req.body;

    const result =
      await commentsCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            comment,
            updatedAt: new Date(),
          },
        }
      );

    res.send(result);
  } catch (error) {
    res.status(500).send({
      success: false,
    });
  }
});

app.delete("/api/comments/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result =
      await commentsCollection.deleteOne({
        _id: new ObjectId(id),
      });

    res.send(result);
  } catch (error) {
    res.status(500).send({
      success: false,
    });
  }
});

//subscription
app.get('/api/subscriptions', async (req, res) => {
    const query = {}
    if(req.query.subscription_id){
        query.subscription_id = req.query.subscription_id
    }

    const subscription = await subscriptionCollection.findOne(query);
    res.send(subscription)
})

app.post('/api/subscribes', async (req, res) => {
    const data = req.body;
    const subsInfo = {
        ...data,
        createdAt: new Date()
    }

    const result = await subscribeCollection.insertOne(subsInfo);

    //update the user plan information
    const filter = { email: data.email};

    //update the value of the 'quantity field to 9
    const updateDocument = {
        $set: {
            subscription: data.subscriptionId,
        }
    }

    const updateResult = await userCollection.updateOne(filter, updateDocument);

    res.send(updateResult);
})

// Artist Sales History
app.get("/api/artist-sales/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const sales = await purchasesCollection
      .find({
        artistEmail: email,
      })
      .sort({ purchasedAt: -1 })
      .toArray();

    res.send(sales);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch sales",
    });
  }
});

// Artist Sales Stats
app.get("/api/artist-sales-stats/:email", async (req, res) => {
  try {
    const { email } = req.params;

    const totalSales =
      await purchasesCollection.countDocuments({
        artistEmail: email,
      });

    const salesAmount =
      await purchasesCollection
        .aggregate([
          {
            $match: {
              artistEmail: email,
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: {
                $sum: "$price",
              },
            },
          },
        ])
        .toArray();

    res.send({
      totalSales,
      totalRevenue:
        salesAmount[0]?.totalRevenue || 0,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
    });
  }
});

// =============================
// ADMIN - GET ALL USERS
// =============================
app.get("/api/users", async (req, res) => {
  try {
    const users = await userCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.send(users);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

// =============================
// ADMIN - CHANGE USER ROLE
// =============================
app.patch("/api/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;

    const { role } = req.body;

    const result =
      await userCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            role,
          },
        }
      );

    res.send(result);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to update role",
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