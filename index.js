const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
const port =process.env.PORT || 5000;

// Middlewares
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin:['http://localhost:5173', 'https://pet-match-5cee4.firebaseapp.com', 'https://pet-match-5cee4.web.app'],
    
    
    credentials: true
}))

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


const verifyToken = async (req,res,next)=>{
  const token = req.cookies?.token;
  if(!token){
    return res.status(401).send({message:'Unauthorized Access'})
  }
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.status(401).send({message:'Unauthorized Access'})
    }
    req.user =decoded;
    next();
  })
};


//Collections 
const petsCollection = client.db('petMasterDB').collection('pets');
const usersCollection = client.db('petMasterDB').collection('users');
const adoptsCollection = client.db('petMasterDB').collection('adopts');
const donationCampaignCollection = client.db('petMasterDB').collection('donationCampaigns');
const paymentCollection = client.db("petMasterDB").collection("payments");
const donationsCollection = client.db("petMasterDB").collection("donations");



//auth related api

app.post('/api/v1/jwt',  async (req, res) => {
  const user = req.body;
  
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

  res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
  })
      .send({ success: true });
})

app.post('/api/v1/logout', async(req,res)=>{
  const user= req.body;
  res.clearCookie('token', {maxAge:0}).send({success:true})
})
 //user related api 
 app.post('/api/v1/users', async(req,res)=>{
 try{
  const user = req.body;
  const query = {email:user.email};
  const existingUser = await usersCollection.findOne(query);
  if(existingUser){
    return res.send({message: 'User already exist', insertedId:null})
  }
  const result = await usersCollection.insertOne(user);
  res.send(result);
  
 }catch (error) {
  res.status(500).send({ error: 'An error occurred', message: error.message });
}
 });

 app.get('/api/v1/users', async(req,res)=>{
  try{
    const result = await usersCollection.find().toArray();
    res.send(result);

  }catch (error) {
  res.status(500).send({ error: 'An error occurred', message: error.message });
}
 });
 app.get('/api/v1/users/:id', async(req,res)=>{
  try{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)};
    const result = await usersCollection.findOne(query);
    res.send(result);

  }catch (error) {
  res.status(500).send({ error: 'An error occurred', message: error.message });
}
 });

 //make admin 
 app.patch('/api/v1/users/admin/:id', verifyToken, async(req,res)=>{
  try{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)}
    const updatedDoc = {
      $set:{
        role:"admin"
      }
    }
    const result = await usersCollection.updateOne(filter,updatedDoc);
    res.send(result);

  }
  catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
 });


 app.get('/api/v1/users/admin/:email', verifyToken,  async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) {
    return res.status(403).send({ message: 'Forbidden access' })
  }
  const query = { email: email }
  const user = await usersCollection.findOne(query);
  let admin = false;
  if (user) {
    admin = user?.role === "admin";
  }
  res.send({ admin })
});

 app.delete('/api/v1/users/:id', async(req,res)=>{
  try{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)};
    const result = await usersCollection.deleteOne(query);
    res.send(result)

  }
  catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
 })

//adopted collection
 app.post('/api/v1/adopts', async (req, res) => {
  try {
    const data = req.body;
    const result = await adoptsCollection.insertOne(data);
   res.send(result)
  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
});
app.get('/api/v1/adopts', async(req,res)=>{
  try{
    const page = parseInt(req?.query?.page) ;
    const limit = parseInt(req?.query?.limit); 
    let skip = 0; 
    const result = await adoptsCollection.find().limit(limit).skip(skip).toArray();
    res.send(result);

  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
});

app.delete('/ap1/v1/adopt/:id', async (req,res)=>{
  try{

   const id = req.params.id;

const filter = {_id: new ObjectId(id)}
    
    const result = await adoptsCollection.deleteOne(filter);

    res.send(result);

  }catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
})
app.put('/api/v1/adopts/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const filter = { petId: id };
    const body = req.body;

    const updatedAdopt = {
      $set: {
        ...body,
      },
    };

    const options = { upsert: true };
    const result = await adoptsCollection.updateOne(filter, updatedAdopt, options);

    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
});


// Pets collection API
app.post('/api/v1/pets', async (req, res) => {
  try {
    const data = req.body;
    const result = await petsCollection.insertOne(data);
   res.send(result)
  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
});


app.get('/api/v1/pets', async (req, res) => {
  try {
    let query = {};

    if (req?.query?.category) {
      query = { ...query, category: req.query.category };
      console.log(req.query.category);
    }

    if (req?.query?.name) {
      const nameRegex = new RegExp(req.query.name, 'i');
      query = { ...query, name: { $regex: nameRegex } };

      console.log(query);
     
    }
    if (req?.query?.adopted ) {
    
      query = { ...query, adopted:req?.query?.adopted};
      
    }
    if(req?.query?.email){
      console.log(req.query.email);
      query={...query, email:req?.query?.email}
    }
    
    const sortOrder = req?.query?.sortOrder === 'asc' ? 1 : -1;
    const sortField = req?.query?.sortField || 'date';
    

    
    const page = parseInt(req?.query?.page) ;
    const limit = parseInt(req?.query?.limit); 
    let skip = 0; 

    if (page > 0) {
      skip = (page - 1) * limit;
    }

    const result = await petsCollection
      .find(query)
      .sort({ [sortField]: sortOrder })
      .limit(limit)
      .skip(skip)
      .toArray();


    /// search method: api/v1/pets?category=${categoryValue}&name=${searchValue}&sortOrder=dsc&sortField=date&adopted=false&page=2&limit=10
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
});
app.get('/api/v1/pets/:id', async(req,res)=>{
  try{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)};
    const result = await petsCollection.findOne(query);

    res.send(result)

  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }

});
app.get('/api/v1/pets/:id', async(req, res)=>{
  try{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)};
    const result = await petsCollection.deleteOne(filter);

    res.send(result)

  }catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }

})

app.put('/api/v1/pets/:id', async (req, res) => {
  try {
    const id = {_id:new ObjectId(req.params.id)};
    const body = req.body;
    
  
    const UpdatedPets = {
      $set: {
       ...body,

      },

    };
    const option ={upsert:true};
    const result = await petsCollection.updateOne(id, UpdatedPets,option);

   res.send(result);
  } catch (error) {
    res.status(500).send('An error occurred: ' + error.message);
  }

});
app.get('/api/v1/totalPetsData', async (req, res) => {
  try {

    const count = await petsCollection.estimatedDocumentCount();

    
    res.send({count});
  } catch (error) {
    console.error( error);
   
    res.status(500).send({ error: 'Internal Server Error' });
  }
});

//donation campaign 
app.post('/api/v1/donationCampaigns', async(req,res)=>{
  try{
    const data = req.body;
    const result = await donationCampaignCollection.insertOne(data);
    res.send(result);

  }catch (error) {
    console.error( error);
   
    res.status(500).send({ error: 'Internal Server Error' });
  }
});
app.put('/api/v1/donationCampaigns/:id', async (req, res) => {
  try {
    const id = {_id:new ObjectId(req.params.id)};
    const body = req.body;
    console.log('update donation bodyt',body);
  
    const UpdatedDonation = {
      $set: {
       ...body,

      },

    };
    const option ={upsert:true};
    const result = await donationCampaignCollection.updateOne(id, UpdatedDonation,option);

   res.send(result);
  } catch (error) {
    res.status(500).send('An error occurred: ' + error.message);
  }

});
app.get('/api/v1/donationCampaigns', async(req,res)=>{
  try{
    let query = {};

    if(req?.query?.email){
      console.log(req.query.email);
      query={...query, email:req?.query?.email}
    }
    
    const sortOrder = req?.query?.sortOrder === 'asc' ? 1 : -1;
    const sortField = req?.query?.sortField || 'lastDate';
    

    
    const page = parseInt(req?.query?.page) ;
    const limit = parseInt(req?.query?.limit); 
    let skip = 0; 

    if (page > 0) {
      skip = (page - 1) * limit;
    }

    const result = await donationCampaignCollection.find(query).sort({ [sortField]: sortOrder }).limit(limit).skip(skip).toArray();

    res.send(result); 

  }catch (error) {
    console.error( error);
   
    res.status(500).send({ error: 'Internal Server Error' });
  }
})
app.get('/api/v1/donationCampaigns/:id', async(req,res)=>{
  try{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)}

    const result = await donationCampaignCollection.findOne(filter)
    res.send(result)

  }catch (error) {
    console.error( error);
   
    res.status(500).send({ error: 'Internal Server Error' });
  }
})

//donations api 
app.post("/api/v1/donations",async(req,res)=>{
  try{
    const data = req.body;
    const result= await donationsCollection.insertOne(data)
    res.send(result)

  }catch (error) {
    console.error( error);
   
    res.status(500).send({ error: 'Internal Server Error' });
  }

})
app.delete("/api/v1/donations/:id",async(req,res)=>{
  try{
    const id = req.params.id;
    const filter = {_id: new ObjectId(id)}
    const result= await donationsCollection.deleteOne(filter)
    res.send(result)

  }catch (error) {
    console.error( error);
   
    res.status(500).send({ error: 'Internal Server Error' });
  }

})
app.get('/api/v1/donations', async(req,res)=>{
  try{
    let query = {};

    if(req?.query?.email){
      
      query={...query, email:req?.query?.email}
    }
   
    
    const sortOrder = req?.query?.sortOrder === 'asc' ? 1 : -1;
    const sortField = req?.query?.sortField || 'donatedAmount';
    

    
    const page = parseInt(req?.query?.page) ;
    const limit = parseInt(req?.query?.limit); 
    let skip = 0; 

    if (page > 0) {
      skip = (page - 1) * limit;
    }

    const result = await donationsCollection.find(query).sort({ [sortField]: sortOrder }).limit(limit).skip(skip).toArray();

    res.send(result); 

  }catch (error) {
    console.error( error);
   
    res.status(500).send({ error: 'Internal Server Error' });
  }
})

  //payment intent
  app.post('/api/v1/create-payment-intent', async(req,res)=>{
 try{
  const {price }= req.body;
  const amount = parseInt(price * 100);
  console.log('amount',amount);
  const paymentIntent = await stripe.paymentIntents.create({
    amount:amount,
    currency:"usd",
    payment_method_types: ['card']
  })
  res.send({
    clientSecret:paymentIntent.client_secret
  })
 }catch (error) {
  console.error( error);
 
  res.status(500).send({ error: 'Internal Server Error' });
}

  });
    //payment related api
    app.get('/api/v1/payments/:email', verifyToken, async (req, res) => {
      try{
        const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
      }catch (error) {
        console.error( error);
       
        res.status(500).send({ error: 'Internal Server Error' });
      }
    })

    app.post('/api/v1/payments', async(req,res)=>{
    try{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
     
     
  
      res.send(paymentResult)
    }catch (error) {
      console.error( error);
     
      res.status(500).send({ error: 'Internal Server Error' });
    }
    });

// Welcome route
app.get('/', (req, res) => {
  res.send({ message: 'Welcome to PetMatch Server!' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
