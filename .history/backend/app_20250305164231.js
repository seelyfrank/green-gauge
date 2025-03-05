/** @format */

const express = require('express');
const app = express();
const port = 8080;
const cors = require('cors');
require('dotenv').config();

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['POST', 'GET'],
  credentials: true
}));

app.use(express.json());

// include our analyze image route
const analyzeImageRouter = require('./routes/analyzeImage');
app.use('/', analyzeImageRouter);

// listen for incoming requests on port 8080
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// export the Express application isntance so it can be imported in other files
module.exports = app;