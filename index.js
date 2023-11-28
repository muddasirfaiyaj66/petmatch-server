const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()

const app = express();
const port = 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rrl4awm.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB!');
  } finally {
    // Client will be closed when you finish or encounter an error
    // await client.close();
  }
}

run().catch(console.dir);

// Pets collection API
const petsCollection = client.db('petMasterDB').collection('pets');

app.post('/api/v1/pets', async (req, res) => {
  try {
    const data = req.body;
    console.log(data);
    const result = await petsCollection.insertOne(data);
   res.send(result)
  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
});

app.get('/api/v1/pets', async (req, res) => {
  try {
    
    let category = {}
    if(req?.query?.category){
      category ={category:req.query.category}
      console.log(category);
    }

    const result = await petsCollection.find(category).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
});

// Welcome route
app.get('/', (req, res) => {
  res.send({ message: 'Welcome to PetMatch Server!' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
