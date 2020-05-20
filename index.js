const express = require("express")
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const { uuid } = require('uuidv4');
var cors = require('cors');
require('dotenv').config();
var mongodb = require("mongodb");
const { ChatDB } = require('./chatdb/index.js');
var amqp = require('amqplib/callback_api');
var amqpConn = null;
var exchange = 'amq.topic';

const jwtKey = process.env.JWT_KEY

const app = express()
app.use(bodyParser.json())
// use it before all route definitions
// app.use(cors({origin: 'http://localhost:8100'}));
app.use(cors());
// app.use(cors({origin: 'http://tdchatserver.herokuapp.com'}));
// app.use(express.static('public'))

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); //qui dice cequens attento
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-XSRF-Token");
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  next();
});

app.use(function (req, res, next) {
  const jwt = decodejwt(req)
  if (jwt) {
    req.user = {
      userId: jwt.sub,
      appId: jwt.app_id
    }
    req.jwt = jwt
  }
  next();
});

app.get("/verify", (req, res) => {
    const decoded = decodejwt(req)
    res.status(200).send(decoded)
})

app.get("/:appid/:userid/conversations", (req, res) => {
  console.log("getting /:appid/:userid/conversations")
  if (!authorize(req, res)) {
    return
  }
  conversations(req, false, function(err, docs) {
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
      res.status(200).json(reply)
    }
  })
})

function authorize(req, res) {
  const appid = req.params.appid
  const userid = req.params.userid
  console.log("appId:", appid, "userId:", userid, "user:", req.user, "token:", req.jwt)
  if (!req.user || req.user.userId !== userid || req.user.appId !== appid) {
    res.status(401).end()
    return false
  }
  return true
}

app.get("/:appid/:userid/archived_conversations", (req, res) => {
  console.log("getting /:appid/:userid/archived_conversations")
  if (!authorize(req, res)) {
    return
  }
  conversations(req, true, function(err, docs) {
    if (err) {
      const reply = {
          success: false,
          err: err.message()
      }
      res.status(501).send(reply)
    }
    else {
      const reply = {
        success: true,
        result: docs
      }
      res.status(200).json(reply)
    }
  })
})

function conversations(req, archived, callback) {
  console.log("getting /:appid/:userid/archived_conversations")
  const appid = req.params.appid
  const userid = req.params.userid
  chatdb.lastConversations(appid, userid, archived, function(err, docs) {
    callback(err, docs)
  });
}

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

// ****************************************************
// **************** GROUPS MANAGEMENT *****************
// ****************************************************

app.post('/:app_id/groups', (req, res) => {

  if (!authorize(req, res)) {
    return
  }
    
  cors(req, res, () => {

    if (!req.body.group_name) {
        res.status(405).send('group_name is not present!');
    }
    // if (!req.body.group_members) {
    //     res.status(405).send('group_members is not present!');
    // }
    // if (!req.params.app_id) {
    //     res.status(405).send('app_id is not present!');
    // }

    let group_name = req.body.group_name;
    let group_id = req.body.group_id;
    let current_user = req.user.uid;

    if (req.body.current_user) {
      current_user = req.body.current_user;
    }

    let group_owner = current_user;

    let group_members = {};
    if (req.body.group_members) {
      group_members = req.body.group_members;
    }

    group_members[current_user] = 1;

    let app_id = req.params.app_id;


    console.log('group_name', group_name);
    console.log('group_id', group_id);        
    console.log('group_owner', group_owner);
    console.log('group_members', group_members);
    console.log('app_id', app_id);

    // if (group_id) {
    //   // createGroupWithId(group_id, group_name, group_owner, group_members, app_id, attributes, invited_members) {
    //     chatApi.createGroupWithId(group_id, group_name, group_owner, group_members, app_id, req.body.attributes, req.body.invited_members).then(function(result) {
    //     console.log('result', result);
    //     // prima veniva ritornato il result
    //     res.status(201).send({"success":true});
    //   });
    // } else {
    //   // createGroup(group_name, group_owner, group_members, app_id, attributes, invited_members) {
    //     chatApi.createGroup(group_name, group_owner, group_members, app_id, req.body.attributes, req.body.invited_members).then(function(result) {
    //       console.log('result', result);
    //       res.status(201).send({"success":true});
    //     });
  
    // }               
  });
});

// ********************************************************
// **************** END GROUPS MANAGEMENT *****************
// ********************************************************

function decodejwt(req) {
    console.log(req.headers)
    var token = null;
    if (req.headers["authorization"]) {
      token = req.headers["authorization"]
    }
    else if (req.query['jwt']) {
      token = req.query['jwt']
    }
    else if (req.query['JWT']) {
      token = req.query['JWT']
    }
    else {
      return null;
    }
    console.log("token:", token)
    var decoded = null
    try {
        decoded = jwt.verify(token, jwtKey);
    } catch(err) {
        console.log("err", err)
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
    console.log('Starting AMQP publisher...')
    startMQ();
  });
});


// AMQP ADAPTER

function startMQ() {
  console.log("Connecting to RabbitMQ...")
  amqp.connect(process.env.RABBITMQ_URI, function (err, conn) {
    if (err) {
      console.error("[AMQP]", err.message);
      return setTimeout(startMQ, 1000);
    }
    conn.on("error", function (err) {
      if (err.message !== "Connection closing") {
        console.error("[AMQP] conn error", err.message);
      }
    });
    conn.on("close", function () {
      console.error("[AMQP] reconnecting");
      return setTimeout(startMQ, 1000);
    });
    console.log("[AMQP] connected.");
    amqpConn = conn;
    whenConnected();
  });
}

function whenConnected() {
  startPublisher();
}

var pubChannel = null;
var offlinePubQueue = [];
function startPublisher() {
  amqpConn.createConfirmChannel(function (err, ch) {
    if (closeOnErr(err)) return;
    ch.on("error", function (err) {
      console.error("[AMQP] channel error", err.message);
    });
    ch.on("close", function () {
      console.log("[AMQP] channel closed");
    });
    pubChannel = ch;
    if (offlinePubQueue.length > 0) {
      while (true) {
        var [exchange, routingKey, content] = offlinePubQueue.shift();
        publish(exchange, routingKey, content);
      }
    }
  });
}

function publish(exchange, routingKey, content, callback) {
  try {
    pubChannel.publish(exchange, routingKey, content, { persistent: true },
      function (err, ok) {
        if (err) {
          console.error("[AMQP] publish", err);
          offlinePubQueue.push([exchange, routingKey, content]);
          pubChannel.connection.close();
          callback(err)
        }
        else {
          console.log("published to", routingKey, "result", ok)
          callback(null)
        }
      });
  } catch (e) {
    console.error("[AMQP] publish", e.message);
    offlinePubQueue.push([exchange, routingKey, content]);
    callback(e)
  }
}

function closeOnErr(err) {
  if (!err) return false;
  console.error("[AMQP] error", err);
  amqpConn.close();
  return true;
}