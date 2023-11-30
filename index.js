const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config()

const app = express();
const port =process.env.PORT || 5000;

// Middlewares
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin:['http://localhost:5173'],
    
    
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

 app.get('/api/v1/users/admin', async(req,res)=>{
  try{
    let email = req.query.email;
    if(email !== req.decoded.email){
      return res.status(403).send({message:"Forbidden Access"})
    }
    const query = {email:email}
    const user = await usersCollection.findOne(query);
    let admin = false;
    if(user){
      admin = user?.role === "admin"
    }
    res.send({admin});

  } catch (error) {
    res.status(500).send({ error: 'An error occurred', message: error.message });
  }
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

// Pets collection API
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
    let query = {};

    if (req?.query?.category) {
      query = { ...query, category: req.query.category };
     
    }

    if (req?.query?.name) {
      const nameRegex = new RegExp(req.query.name, 'i');
      query = { ...query, name: { $regex: nameRegex } };
     
    }
    if (req?.query?.adopted !== undefined) {

      const adoptedValue = req.query.adopted === 'true';
    
      query = { ...query, adopted: adoptedValue };
      
    }
    
    const sortOrder = req?.query?.sortOrder === 'asc' ? 1 : -1;
    const sortField = req?.query?.sortField || 'date';

    
    const page = parseInt(req?.query?.page) ;
    const limit = parseInt(req?.query?.limit); 
    const skip = (page - 1) * limit;

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

})


// Welcome route
app.get('/', (req, res) => {
  res.send({ message: 'Welcome to PetMatch Server!' });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
