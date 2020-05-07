const express = require("express")
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const { uuid } = require('uuidv4');
var cors = require('cors');
require('dotenv').config();
const { ChatDB } = require('./chatdb/index.js');

const jwtKey = process.env.JWT_KEY

const app = express()
app.use(bodyParser.json())
// use it before all route definitions
app.use(cors({origin: 'http://localhost:8100'}));
// app.use(express.static('public'))

app.get("/verify", (req, res) => {
    console.log(req.headers)
    const token = req.headers["authorization"]
    console.log("token:", token)
    var decoded =""
    try {
        decoded = jwt.verify(token, jwtKey);
    } catch(err) {
        console.log("err", err)
    }
    res.status(200).send(decoded)
})

var port = process.env.PORT || 8004;
console.log("Starting server on port", port)
app.listen(port, () => {
    console.log('Server started.')
});
