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
var chatdb = null

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

app.get("/:appid/:userid/conversations", (req, res) => {
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

app.get("/:appid/:userid/archived_conversations", (req, res) => {
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
        console.log("REPLY:", reply)
        res.status(200).json(reply)
      }
    })
})

// *****************************************
// **************** GROUPS *****************
// *****************************************

/** Create a group */
app.post('/:appid/groups', (req, res) => {

  console.log("appId:", req.user.appId, "user:", req.user.uid)
  if (!req.user || !req.user.appId) {
    res.status(401).end()
    return
  }
  // cors(req, res, () => {
    if (!req.body.group_name) {
        res.status(405).send('group_name not present!');
    }
    // if (!req.body.group_members) {
    //     res.status(405).send('group_members not present!');
    // }

    let group_name = req.body.group_name;
    let group_id = req.body.group_id;
    if (!group_id) {
      group_id = newGroupId()
    }
    let current_user = req.user.uid;
    let group_attributes = req.body.attributes;

    let group_owner = current_user;

    let group_members = {};
    if (req.body.group_members) {
      group_members = req.body.group_members;
    }

    group_members[current_user] = 1;

    let app_id = req.user.appId;

    console.log('group_name', group_name);
    console.log('group_id', group_id);
    console.log('group_owner', group_owner);
    console.log('group_members', group_members);
    console.log('app_id', app_id);


    // 1. create group json
    // 2. save group json in mongodb
    // 3. publish to /observer
    // 4. observer publishes JSON to all members
    // 5. observer (virtually) creates group_id timelineOf messages (that's created on the first message sent by one member)

    var create_group_topic = `apps.observer.${app_id}.groups.create`
    console.log("Publishing to topic:", create_group_topic);
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
    console.log("creating group " + JSON.stringify(group) + " to "+ create_group_topic);
    // admin.database().ref(path).set(group);

    console.log(">>> NOW PUBLISHING... CREATE GROUP TOPIC", create_group_topic)
    const group_payload = JSON.stringify(group)
    publish(exchange, create_group_topic, Buffer.from(group_payload), function(err) {
      console.log("PUBLISHED 'CREATE GROUP' ON TOPIC", create_group_topic)
      if (err) {
        res.status(500).send({"success":false, "err": err});
      }
      else {
        res.status(201).send({"success":true});
      }
    });
});

function newGroupId() {
  group_id = "group-" + uuid();
  return group_id
}

/** Get group data */
app.get('/:appid/groups/:group_id', (req, res) => {
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
app.post('/:appid/groups/:group_id/members', (req, res) => {
  console.log('adds a member to a group', req.body, req.params);
  if (!authorize(req, res)) {
    console.log("Unauthorized")
    res.status(401).send('Unauthorized');
    return
  }
  if (!req.body.member_id) {
      res.status(405).send('member_id is mandatory!');
  }
  const appid = req.params.appid
  const joined_member_id = req.body.member_id;
  const group_id = req.params.group_id;
  console.log('joined_member_id', joined_member_id);
  console.log('group_id', group_id);
  chatdb.getGroup(group_id, function(err, group) {
    console.log("group found?", group, "err", err)
    if (err || !group) {
      const reply = {
          success: false,
          err: (err && err.message()) ? err.message() : "Not found"
      }
      res.status(404).send(reply)
    }
    else {
      console.log("group members", group.members)
      console.log("group owner", group.owner)
      im_owner = (group.owner === req.user.uid)
      im_admin = req.user.roles.admin
      console.log("im_owner:",im_owner)
      console.log("im_admin:",im_admin)
      if (im_admin || im_owner) {
        if (group.members[joined_member_id]) {
          const reply = {
            success: false,
            err: "Already a member"
          }
          res.status(401).json(reply)
          return
        }
        const now = Date.now()
        group.members[joined_member_id] = 1
        group.updatedOn = now;
        chatdb.saveOrUpdateGroup(group, function(err) {
          if (err) {
            console.log("An error occurred:", err)
            const reply = {
                success: false,
                err: err.message() ? err.message() : "Error saving group"
            }
            res.status(500).send(reply)
          }
          else {
            console.log("saved group with new joined member ok.")
            // 1. send group update to group members
            var update_group_topic = `apps.observer.${group.appId}.groups.update`
            console.log("updating group " + JSON.stringify(group) + " to "+ update_group_topic);
            const group_payload = JSON.stringify(group)
            publish(exchange, update_group_topic, Buffer.from(group_payload), function(err) {
              console.log("PUBLISHED 'UPDATE GROUP' ON TOPIC", update_group_topic)
              if (err) {
                res.status(500).send({"success":false, "err": err});
              }
              else {
                res.status(200).send({"success":false});
                // TODO: SEND MESSAGE "MEMBER ADDED TO GROUP"
                console.log("group.members:", group.members)
                for (let [member_id, value] of Object.entries(group.members)) {
                  console.log("to member:", member_id)
                  const now = Date.now()
                  const message = {
                    message_id: uuid(),
                    type: "text",
                    text: joined_member_id + " added to group",
                    timestamp: now,
                    channel_type: "group",
                    sender_fullname: "System",
                    sender: group.owner,
                    recipient_fullname: group.name,
                    recipient: group.uid,
                    status: 100, // MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
                    attributes: {
                      subtype:"info",
                      updateconversation : true,
                      messagelabel: {
                        key: "MEMBER_JOINED_GROUP",
                        parameters: {
                          member_id: joined_member_id
                          // fullname: fullname // OPTIONAL
                        }
                      }
                    }
                  }
                  console.log("Member joined group message:", message)
                  let inbox_of = member_id
                  let convers_with = group.uid
                  const deliver_message_topic = `apps.observer.${appid}.users.${inbox_of}.messages.${convers_with}.delivered`
                  const message_payload = JSON.stringify(message)
                  publish(exchange, deliver_message_topic, Buffer.from(message_payload), function(err) {
                    console.log("PUBLISH: DELIVER MESSAGE TO TOPIC:", deliver_message_topic)
                    if (err) {
                      console.log("error delivering message to joined member on topic", deliver_message_topic)
                    }
                  });
                }

                // 2. pubblish old group messages to the joined member (in the member/group-conversWith timeline)
                const userid = group.uid
                const convid = group.uid
                chatdb.lastMessages(appid, userid, convid, 1, 200, function(err, messages) {
                  if (err) {
                    console.log("Error", err)
                  }
                  else if (!messages) {
                    console.log("No messages in group", group.uid)
                  }
                  else {
                    console.log("delivering old group messages to:", joined_member_id)
                    messages.forEach(message => {
                      console.log("Message:", message.text)
                      let inbox_of = joined_member_id
                      let convers_with = group.uid
                      const deliver_message_topic = `apps.observer.${appid}.users.${inbox_of}.messages.${convers_with}.delivered`
                      const message_payload = JSON.stringify(message)
                      publish(exchange, deliver_message_topic, Buffer.from(message_payload), function(err) {
                        console.log("PUBLISH: DELIVER MESSAGE TO TOPIC:", deliver_message_topic)
                        if (err) {
                          console.log("error delivering message to joined member on topic", deliver_message_topic)
                        }
                      });
                    });
                  }
                })
              }
            });
          }
        })
      }
      else {
        const reply = {
          success: false,
          err: "Not allowed"
        }
        res.status(401).send(reply)
      }
    }
    // else {
    //   const reply = {
    //     success: false,
    //     err: "Group does not exist"
    //   }
    //   res.status(404).send(reply)
    // }
  });

  
});

// function joinGroup(member_id, group_id, app_id) {
//   var path = '/apps/'+app_id+'/groups/'+group_id+'/members/';
//   var member = {};
//   member[member_id] = 1;
//   console.log("member " + JSON.stringify(member) + " is joining group " + path);
//   return admin.database().ref(path).update(member);
// }

// duplicateTimelineOnJoinGroup = functions.database.ref('/apps/{app_id}/groups/{group_id}/members/{member_id}').onCreate((data, context) => {
//   const member_id = context.params.member_id;
//   const group_id = context.params.group_id;
//   const app_id = context.params.app_id;
//   return chatApi.copyGroupMessagesToUserTimeline(group_id, member_id, app_id);
// });

// function copyGroupMessagesToUserTimeline(group_id, user_id, app_id) {
//   const fromPath = '/apps/'+app_id+'/messages/' + group_id;
//   return admin.database().ref(fromPath).orderByChild("timestamp").once('value').then(function(messagesSnap) {
//     if (messagesSnap.val()!=null){
//       var messagesWithMessageIdAsObject = messagesSnap.val();
//       console.log('messagesWithMessageIdAsObject ' + JSON.stringify(messagesWithMessageIdAsObject) );
//       var messagesIdasArray = Object.keys(messagesWithMessageIdAsObject);
//       console.log('messagesIdasArray ' + JSON.stringify(messagesIdasArray) );
//       // disable notification
//       var i = 0;
//       messagesIdasArray.forEach(function(messageId) {
//         const message = messagesWithMessageIdAsObject[messageId];
//         if (i>0) {
//           if (message.attributes) {
//               message.attributes.sendnotification = false;
//           }
//         }
//         console.log('message ' + JSON.stringify(message));
//         i++;
//       });
//       const toPath = '/apps/'+app_id+'/users/' + user_id+'/messages/'+group_id;
//       console.log('duplicating message ' + JSON.stringify(messagesWithMessageIdAsObject) + " from : " + fromPath + " to " + toPath);
//       return admin.database().ref(toPath).update(messagesWithMessageIdAsObject);
//     } else {
//       console.log("message is null. Nothing to duplicate");
//       return 0;
//     }
//   });
// }

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
    else {
      return null;
    }
    // console.log("token:", token)
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


// AMQP COMMUNICATION

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