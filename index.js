const express = require("express")
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const { uuid } = require('uuidv4');
var cors = require('cors');
require('dotenv').config();
var mongodb = require("mongodb");
const { ChatDB } = require('./chatdb/index.js');
const { Chat21Api } = require('./chat21Api/index.js');
// var amqp = require('amqplib/callback_api');
// var amqpConn = null;
// var exchange = 'amq.topic';

const jwtKey = process.env.JWT_KEY
const BASEURL = '/api'
let chatdb = null
let chatapi = null

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
    // adds "user" to req
    req['user'] = {
      uid: jwt.sub,
      appId: jwt.app_id,
      roles: {
        "user": true
      }
    }
    if (jwt.tiledesk_api_roles) { // TODO get multiple roles splitting tiledesk_api_roles on ","
      req['user'].roles[jwt.tiledesk_api_roles] = true
    }
    else {
      req['user'].roles["user"] = true
    }
    // adds "jwt" to req
    req['jwt'] = jwt
  }
  next();
});

app.get("/verify", (req, res) => {
    const decoded = decodejwt(req)
    res.status(200).send(decoded)
})

app.get(BASEURL + "/:appid/:userid/conversations", (req, res) => {
  console.log("getting /:appid/:userid/conversations")
  if (!authorize(req, res)) {
    console.log("Unauthorized!")
    return
  }
  console.log("Go with conversations!")
  conversations(req, false, function(err, docs) {
    console.log("got conversations", docs, err)
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
  // const userid = req.params.userid
  console.log("appId:", appid, "user:", req.user)
  if (!req.user || (req.user.appId !== appid)) { // (req.user.uid !== userid) || 
    res.status(401).end()
    return false
  }
  return true
}

app.get(BASEURL + "/:appid/:userid/archived_conversations", (req, res) => {
  console.log("GET /:appid/:userid/archived_conversations")
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

app.get(BASEURL + "/:appid/:userid/conversations/:convid/messages", (req, res) => {
    console.log("getting /:appid/:userid/messages")
    const appid = req.params.appid
    const userid = req.params.userid
    const convid = req.params.convid
    const jwt = decodejwt(req)
    // console.log("app:", appid, "user:", userid, "convid:", convid, "token:", jwt)
    if (jwt.sub !== userid && jwt.app_id !== appid) {
        res.status(401).end()
        return
    }
    chatdb.lastMessages(appid, userid, convid, -1, 200, function(err, messages) {
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
        // console.log("REPLY:", reply)
        res.status(200).json(reply)
      }
    })
})

/** Delete a conversation */
app.delete(BASEURL + '/:app_id/conversations/:recipient_id/', (req, res) => {
  console.log('delete a conversation:', req.params);

  if (!req.params.recipient_id) {
    res.status(405).send('recipient_id is not present!');
  }

  if (!req.params.app_id) {
      res.status(405).send('app_id is not present!');
  }

  let recipient_id = req.params.recipient_id;
  let app_id = req.params.app_id;
  
  let user_id = req.user.uid;
  const im_admin = req.user.roles.admin
  if (req.body.user_id && im_admin) {
    console.log('user_id from body:', req.body.user_id);
    user_id = req.body.user_id;
  }

  // console.log('recipient_id:', recipient_id);
  // console.log('app_id:', app_id);
  console.log('user_id:', user_id);

  chatapi.archiveConversation(app_id, user_id, recipient_id, function(err) {
    if (err) {
      res.status(500).send({"success":false, "err": err});
    }
    else {
      res.status(201).send({"success":true});
    }
  })

  // chatApi.archiveConversation(user_id, recipient_id, app_id).then(function(result) {
  //   console.log('result', result);
  //   res.status(204).send({"success":true});
  // });
});

/**
 * Sends a message.
 *
 * This endpoint supports CORS.
 */
app.post(BASEURL + '/:app_id/messages', (req, res) => {
  console.log('/:app_id/messages', req.body);
  if (!req.body.sender_fullname) {
      res.status(405).send('Sender Fullname is mandatory');
      return
  }
  else if (!req.body.recipient_id) {
      res.status(405).send('Recipient id is mandatory');
      return
  }
  else if (!req.body.recipient_fullname) {
      res.status(405).send('Recipient Fullname is mandatory');
      return
  }
  else if (!req.body.text) {
      res.status(405).send('text is mandatory');
      return
  }
  let sender_id = req.user.uid;
  im_admin = req.user.roles.admin // admin can force sender_id to someone different from current user
  if (im_admin && req.body.sender_id) {
    sender_id = req.body.sender_id;
  }
  let sender_fullname = req.body.sender_fullname;
  let recipient_id = req.body.recipient_id;
  let recipient_fullname = req.body.recipient_fullname;
  let text = req.body.text;
  let appid = req.params.app_id;
  let channel_type = req.body.channel_type;
  let attributes = req.body.attributes;
  let type = req.body.type;
  let metadata = req.body.metadata;
  let timestamp = req.body.timestamp;
  console.log('sender_id:', sender_id);
  // console.log('sender_fullname', sender_fullname);
  console.log('recipient_id:', recipient_id);
  // console.log('recipient_fullname', recipient_fullname);
  console.log('text:', text);
  // console.log('app_id', appid);
  console.log('channel_type:', channel_type);
  // console.log('attributes', attributes);
  // console.log('type', type);
  // console.log('metadata', metadata);
  // console.log('timestamp', timestamp);
  chatapi.sendMessage(
    appid, // mandatory
    type, // optional | text
    text, // mandatory
    timestamp, // optional | null (=>now)
    channel_type, // optional | direct
    sender_id, // mandatory
    sender_fullname, // mandatory
    recipient_id, // mandatory
    recipient_fullname, // mandatory
    attributes, // optional | null
    metadata, // optional | null
    function(err) { // optional | null
      console.log("message sent with err", err)
      if (err) {
        const reply = {
          success: false,
          err: (err && err.message()) ? err.message() : "Not found"
        }
        res.status(404).send(reply)
      }
      else {
        res.status(200).send({success: true})
      }
    }
  )
});

// *****************************************
// **************** GROUPS *****************
// *****************************************

/** Create a group */
app.post(BASEURL + '/:appid/groups', (req, res) => {

  console.log("appId:", req.user.appId, "user:", req.user.uid)
  if (!req.user || !req.user.appId) {
    res.status(401).end()
    return
  }
  // cors(req, res, () => {
    if (!req.body.group_name) {
        res.status(405).send('group_name not present!');
        return
    }
    if (!req.body.group_members) {
        res.status(405).send('group_members not present!');
    }

    let group_name = req.body.group_name;
    let group_id = req.body.group_id;
    if (!group_id) {
      group_id = newGroupId()
    }
    let current_user = req.user.uid;
    let group_attributes = req.body.attributes;

    let group_owner = current_user;
    im_admin = req.user.roles.admin;
    if (im_admin && req.body.group_owner) {
      group_owner = req.body.group_owner;
    }

    let group_members = {};
    if (req.body.group_members) {
      group_members = req.body.group_members;
    }

    if (!im_admin) {
      group_members[current_user] = 1;
    }

    let appid = req.user.appId;

    console.log('group_name', group_name);
    console.log('group_id', group_id);
    console.log('group_owner', group_owner);
    console.log('group_members', group_members);
    console.log('app_id', appid);

    const now = Date.now()
    var group = {};
    group.name = group_name;
    group.uid = group_id
    group.owner = group_owner;
    group.members = group_members;
    group.createdOn = now;
    group.updatedOn = now;
    if (group_attributes) {
        group.attributes = group_attributes;
    }
    console.log("creating group " + JSON.stringify(group));
    chatapi.createGroup(appid, group, function(err) {
      if (err) {
        res.status(500).send({"success":false, "err": err});
      }
      else {
        res.status(201).send({"success":true});
      }
    })
});

function newGroupId() {
  group_id = "group-" + uuid();
  return group_id
}

/** Get group data */
app.get(BASEURL + '/:appid/groups/:group_id', (req, res) => {
  console.log("getting /:appid/groups/group_id")
  if (!authorize(req, res)) {
    console.log("Unauthorized!")
    return
  }
  const group_id = req.params.group_id
  chatdb.getGroup(group_id, function(err, group) {
    if (err) {
      const reply = {
          success: false,
          err: err.message()
      }
      res.status(404).send(reply)
    }
    else if (group) {
      // console.log("group members", group.members)
      im_member = group.members[req.user.uid]
      im_admin = req.user.roles.admin
      // console.log("im_member:", im_member)
      // console.log("im_admin:", im_admin)
      if (im_member || im_admin) {
        const reply = {
          success: true,
          result: group
        }
        res.status(200).json(reply)
      }
      else {
        const reply = {
          success: false,
          err: "Permission denied"
        }
        res.status(401).send(reply)
      }
    }
    else {
      const reply = {
        success: false,
        err: "Group doesn't exist"
      }
      res.status(404).send(reply)
    }
  });
});

/** Join a group */
app.post(BASEURL + '/:appid/groups/:group_id/members', (req, res) => {
  console.log('adds a member to a group', req.body, req.params);
  if (!authorize(req, res)) {
    console.log("Unauthorized")
    res.status(401).send('Unauthorized');
    return
  }
  if (!req.body.member_id) {
      res.status(405).send('member_id is mandatory!');
      return
  }
  const joined_member_id = req.body.member_id;
  const group_id = req.params.group_id;
  console.log('joined_member_id', joined_member_id);
  console.log('group_id', group_id);
  chatapi.addMemberToGroupAndNotifyUpdate(req.user, joined_member_id, group_id, function(reply, group) {
    console.log("THE GROUP:", group)
    if (group) {
      chatapi.joinGroup(joined_member_id, group, function(err) {
        if (err) {
          const reply = {
            success: false,
            err: (err && err.message()) ? err.message() : "An error occurred",
            http_status: 405
          }
        }
        else {
          res.status(200).send({success: true})
        }
      })
    }
    else {
      console.log("Error encountered:", reply)
    }
  })
});

/** Set members of a group */
app.put(BASEURL + '/:app_id/groups/:group_id/members', (req, res) => {
  console.log('Set members of a group', req.body);
  if (!req.params.group_id) {
      res.status(405).send('group_id is mandatory');
      return
  }
  else if (!req.params.app_id) {
      res.status(405).send('app_id is mandatory');
      return
  }
  else if (!req.body.members) {
    res.status(405).send('members is mandatory');
    return
  }
  let new_members = req.body.members //{};
  // req.body.members.forEach(m => {
  //   new_members[m] = 1
  // })
  console.log("new_members:", new_members)
  const group_id = req.params.group_id
  const user = req.user
  chatapi.setGroupMembers(user, new_members, group_id, function(err) {
    if (err) {
      res.status(405).send(err)
    }
    else {
      res.status(200).send({success: true})
    }
  })
});

/** Leave a group */
app.delete(BASEURL + '/:app_id/groups/:group_id/members/:member_id', (req, res) => {
  // app.delete('/groups/:group_id/members/:member_id', (req, res) => {
  console.log('leave group');
  if (!req.params.member_id) {
      res.status(405).send('member_id is mandatory');
      return
  }
  else if (!req.params.group_id) {
      res.status(405).send('group_id is mandatory');
      return
  }
  else if (!req.params.app_id) {
      res.status(405).send('app_id is mandatory');
      return
  }
  let member_id = req.params.member_id;
  let group_id = req.params.group_id;
  let app_id = req.params.app_id;
  const user = req.user
  console.log('member_id', member_id);
  console.log('group_id', group_id);
  console.log('app_id', app_id);
  console.log('user', user);
  chatapi.leaveGroup(user, member_id, group_id, app_id, function(err) {
    if (err) {
      res.status(405).send(err)
    }
    else {
      res.status(200).send({success: true})
    }
  });
});

/** Update group (just group name) */
app.put(BASEURL + '/:app_id/groups/:group_id', (req, res) => {
  console.log('Update group (just group name)');
  if (!req.params.group_id) {
      res.status(405).send('group_id is mandatory');
      return
  }
  else if (!req.params.app_id) {
      res.status(405).send('app_id is mandatory');
      return
  }
  else if (!req.body.group_name) {
    res.status(405).send('group_name is mandatory');
    return
  }
  const group_name = req.body.group_name;
  const group_id = req.params.group_id
  const user = req.user
  chatapi.updateGroupData(user, group_name, group_id, function(err) {
    if (err) {
      res.status(405).send(err)
    }
    else {
      res.status(200).send({success: true})
    }
  })
});

/** Update group custom attributes */
app.put(BASEURL + '/:app_id/groups/:group_id/attributes', (req, res) => {
  console.log('Update group custom attributes');
  if (!req.params.group_id) {
      res.status(405).send('group_id is mandatory');
      return
  }
  else if (!req.params.app_id) {
      res.status(405).send('app_id is mandatory');
      return
  }
  else if (!req.body.attributes) {
    res.status(405).send('attributes is mandatory');
    return
  }
  const attributes = req.body.attributes;
  const group_id = req.params.group_id
  const user = req.user
  chatapi.updateGroupAttributes(user, attributes, group_id, function(err) {
    if (err) {
      res.status(405).send(err)
    }
    else {
      res.status(200).send({success: true})
    }
  })
});

// ********************************************************
// **************** END GROUPS MANAGEMENT *****************
// ********************************************************

function decodejwt(req) {
    // console.log(req.headers)
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
    else if (req.query['token']) {
      token = req.query['token']
    }
    else {
      return null;
    }
    // console.log("token:", token)
    var decoded = null
    try {
        // console.log("JWTKEY:", jwtKey)
        // console.log("token:", token)
        
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
  chatdb = new ChatDB({database: db})
  var port = process.env.PORT || 8004;
  console.log("Starting server on port", port)
  chatapi = new Chat21Api({exchange: 'amq.topic', database: chatdb});
  chatapi.start();
  app.listen(port, () => {
    console.log('Server started.')
    console.log('Starting AMQP publisher...')
  });
});


// // AMQP COMMUNICATION

// function startMQ() {
//   console.log("Connecting to RabbitMQ...")
//   amqp.connect(process.env.RABBITMQ_URI, function (err, conn) {
//     if (err) {
//       console.error("[AMQP]", err.message);
//       return setTimeout(startMQ, 1000);
//     }
//     conn.on("error", function (err) {
//       if (err.message !== "Connection closing") {
//         console.error("[AMQP] conn error", err.message);
//       }
//     });
//     conn.on("close", function () {
//       console.error("[AMQP] reconnecting");
//       return setTimeout(startMQ, 1000);
//     });
//     console.log("[AMQP] connected.");
//     amqpConn = conn;
//     whenConnected();
//   });
// }

// function whenConnected() {
//   startPublisher();
// }

// var pubChannel = null;
// var offlinePubQueue = [];
// function startPublisher() {
//   amqpConn.createConfirmChannel(function (err, ch) {
//     if (closeOnErr(err)) return;
//     ch.on("error", function (err) {
//       console.error("[AMQP] channel error", err.message);
//     });
//     ch.on("close", function () {
//       console.log("[AMQP] channel closed");
//     });
//     pubChannel = ch;
//     if (offlinePubQueue.length > 0) {
//       while (true) {
//         var [exchange, routingKey, content] = offlinePubQueue.shift();
//         publish(exchange, routingKey, content);
//       }
//     }
//   });
// }

// function publish(exchange, routingKey, content, callback) {
//   try {
//     pubChannel.publish(exchange, routingKey, content, { persistent: true },
//       function (err, ok) {
//         if (err) {
//           console.error("[AMQP] publish", err);
//           offlinePubQueue.push([exchange, routingKey, content]);
//           pubChannel.connection.close();
//           callback(err)
//         }
//         else {
//           console.log("published to", routingKey, "result", ok)
//           callback(null)
//         }
//       });
//   } catch (e) {
//     console.error("[AMQP] publish", e.message);
//     offlinePubQueue.push([exchange, routingKey, content]);
//     callback(e)
//   }
// }

// function closeOnErr(err) {
//   if (!err) return false;
//   console.error("[AMQP] error", err);
//   amqpConn.close();
//   return true;
// }