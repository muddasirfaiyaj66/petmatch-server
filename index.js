const express = require('express');
const cors = require('cors');
const app = express();
const port =  5000;


app.get('/', async(req,res)=>{
   try{
    res.send({message: 'Welcome to PetMatch Server!'});
   }
   catch (error){
    res.send(error)

   }
});

app.listen(port, ()=>{
    console.log(`Server running on ${port}`);
})


