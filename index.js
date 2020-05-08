const express = require("express")
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const { uuid } = require('uuidv4');
var cors = require('cors');
require('dotenv').config();
var mongodb = require("mongodb");
const { ChatDB } = require('./chatdb/index.js');

const jwtKey = process.env.JWT_KEY

const app = express()
app.use(bodyParser.json())
// use it before all route definitions
// app.use(cors({origin: 'http://localhost:8100'}));
app.use(cors({origin: 'http://tdchatserver.herokuapp.com/'}));
// app.use(express.static('public'))

app.get("/verify", (req, res) => {
    const decoded = decodejwt(req)
    res.status(200).send(decoded)
})

app.get("/:appid/:userid/conversations", (req, res) => {
    console.log("getting /:appid/:userid/conversations")
    const appid = req.params.appid
    const userid = req.params.userid
    const jwt = decodejwt(req)
    console.log("app:", appid, "user:", userid, "token:", jwt)
    if (jwt.sub !== userid && jwt.app_id !== appid) {
        res.status(401).end()
        return
    }
    chatdb.lastConversations(appid, userid, function(err, docs) {
      if (err) {
        const reply = {
            success: false,
            err: err.message()
        }
        res.status(200).send(reply)
      }
      else {
        const reply = {
          success: true,
          result: docs
        }
        console.log("REPLY:", reply)
        res.status(200).json(reply)
      }
    })
})

app.get("/:appid/:userid/conversations/:convid/messages", (req, res) => {
    console.log("getting /:appid/:userid/messages")
    const appid = req.params.appid
    const userid = req.params.userid
    const convid = req.params.convid
    const jwt = decodejwt(req)
    console.log("app:", appid, "user:", userid, "convid:", convid, "token:", jwt)
    if (jwt.sub !== userid && jwt.app_id !== appid) {
        res.status(401).end()
        return
    }
    chatdb.lastMessages(appid, userid, convid, function(err, messages) {
      if (err) {
        const reply = {
            success: false,
            err: err.message()
        }
        res.status(200).send(reply)
      }
      else {
        const reply = {
          success: true,
          result: messages
        }
        console.log("REPLY:", reply)
        res.status(200).json(reply)
      }
    })
})

function decodejwt(req) {
    console.log(req.headers)
    const token = req.headers["authorization"]
    console.log("token:", token)
    var decoded =""
    try {
        decoded = jwt.verify(token, jwtKey);
    } catch(err) {
        console.log("err", err)
        decoded = err
    }
    return decoded
}

// var port = process.env.PORT || 8004;
// console.log("Starting server on port", port)
// app.listen(port, () => {
//     console.log('Server started.')
// });

const mongouri = process.env.MONGODB_URI || "mongodb://localhost:27017/chatdb";
// var ObjectID = mongodb.ObjectID;
// Create a database variable outside of the
// database connection callback to reuse the connection pool in the app.
var db;
console.log("connecting to mongodb...")
mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true }, function (err, client) {
  if (err) {
    console.log(err);
    process.exit(1);
  } else {
    console.log("MongoDB successfully connected.")
  }
  db = client.db();
  var port = process.env.PORT || 8004;
  console.log("Starting server on port", port)
  app.listen(port, () => {
    chatdb = new ChatDB({database: db})
    console.log('Server started.')
  });
});
