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

/**
 * Send a message.
 *
 * This endpoint supports CORS.
 */
app.post(BASEURL + '/:app_id/messages', (req, res) => {
  console.log('/:app_id/messages');
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
  console.log('sender_id', sender_id);
  console.log('sender_fullname', sender_fullname);
  console.log('recipient_id', recipient_id);
  console.log('recipient_fullname', recipient_fullname);
  console.log('text', text);
  console.log('app_id', appid);
  console.log('channel_type', channel_type);
  console.log('attributes', attributes);
  console.log('type', type);
  console.log('metadata', metadata);
  console.log('timestamp', timestamp);
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
  // if (channel_type==null || channel_type=="direct") {  //is a direct message
  //   // sendDirectMessage(sender_id, sender_fullname, recipient_id, recipient_fullname, text, app_id, attributes, timestamp, type, metadata) {
  //   chatApi.sendDirectMessage(sender_id, sender_fullname, recipient_id, recipient_fullname, text, app_id, attributes, timestamp, type, metadata).then(function(result) {
  //     console.log('result', result);
  //     res.status(201).send(result);
  //   });
  // }else if (channel_type=="group") {
  //   // sendGroupMessage(sender_id, sender_fullname, recipient_group_id, recipient_group_fullname, text, app_id, attributes, projectid, timestamp, type, metadata) {
  //   chatApi.sendGroupMessage(sender_id, sender_fullname, recipient_id, recipient_fullname, text, app_id, attributes, undefined, timestamp, type, metadata).then(function(result) {
  //     console.log('result', result);

  //     res.status(201).send(result);
  //   });
  // }else {
  //   res.status(405).send('channel_type error!');
  // }

});

// function sendMessage(
//     appid, // mandatory
//     type, // optional | text
//     text, // mandatory
//     timestamp, // optional | null
//     channel_type, // optional | direct
//     sender, // mandatory
//     sender_fullname, // mandatory
//     recipient, // mandatory
//     recipient_fullname, // mandatory
//     attributes, // optional | null
//     metadata, // optional | null
//     callback // optional | null
//   ) {
//   const outgoing_message = {
//     text: text,
//     type: type,
//     recipient_fullname: recipient_fullname,
//     sender_fullname: sender_fullname,
//     channel_type: channel_type? channel_type : "direct",
//   }
//   if (attributes) {
//     outgoing_message.attributes = attributes
//   }
//   if (metadata) {
//     outgoing_message.metadata = metadata
//   }
//   if (timestamp) {
//     outgoing_message.timestamp = timestamp
//   }
//   console.log("outgoing_message:", outgoing_message)
//   let dest_topic = `apps.${appid}.users.${sender}.messages.${recipient}.outgoing`
//   const message_payload = JSON.stringify(outgoing_message)
//   publish(exchange, dest_topic, Buffer.from(message_payload), function(err) {
//     console.log("PUBLISHED: SENDING MESSAGE TO TOPIC:", dest_topic)
//     if (err) {
//       console.log("error sending message", err, "On topic", dest_topic)
//       if (callback) {
//         callback(err)
//         return
//       }
//     }
//     callback(null)
//   });
// }

// function deliverMessage(
//     exchange, // mandatory
//     appid, // mandatory
//     message, // mandatory
//     inbox_of, // mandatory
//     convers_with, // mandatory
//     callback // optional | null
//   ) {
//   const deliver_message_topic = `apps.observer.${appid}.users.${inbox_of}.messages.${convers_with}.delivered`
//   const message_payload = JSON.stringify(message)
//   publish(exchange, deliver_message_topic, Buffer.from(message_payload), function(err) {
//     console.log("PUBLISH: DELIVER MESSAGE TO TOPIC:", deliver_message_topic)
//     if (err) {
//       console.log("error delivering message to joined member on topic", deliver_message_topic)
//       if (callback) {
//         callback(err)
//         return
//       }
//     }
//     if (callback) {
//       callback(null)
//     }
//   });
// }

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
    im_admin = req.user.roles.admin;
    if (im_admin && req.body.group_owner) {
      group_owner = req.body.group_owner;
    }

    let group_members = {};
    if (req.body.group_members) {
      group_members = req.body.group_members;
    }

    group_members[current_user] = 1;

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

// /**
//  * Joins a member to a group.
//  * 1. Sends "{user} added to this group" message to every member of the group, including the joined one
//  * 2. Pubblishes old group messages to the newly joined member timeline
//  * NOTE: this method doesn't modify the group members neither sends a group.updated message to
//  * the clients. Use addMemberToGroupAndNotifyUpdate() to reach these couple of goals.
//  * 
//  * @param {*} exchange 
//  * @param {*} joined_member_id 
//  * @param {*} group 
//  * @param {*} callback 
//  */
// function joinGroup(exchange, joined_member_id, group, callback) {
//   console.log("SENDING 'ADDED TO GROUP' TO EACH MEMBER INCLUDING THE JOINED ONE...", group)
//   const appid = group.appId
//   for (let [member_id, value] of Object.entries(group.members)) {
//     console.log("to member:", member_id)
//     const now = Date.now()
//     const message = {
//       message_id: uuid(),
//       type: "text",
//       text: joined_member_id + " added to group",
//       timestamp: now,
//       channel_type: "group",
//       sender_fullname: "System",
//       sender: "system",
//       recipient_fullname: group.name,
//       recipient: group.uid,
//       status: 100, // MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
//       attributes: {
//         subtype:"info",
//         updateconversation : true,
//         messagelabel: {
//           key: "MEMBER_JOINED_GROUP",
//           parameters: {
//             member_id: joined_member_id
//             // fullname: fullname // OPTIONAL
//           }
//         }
//       }
//     }
//     console.log("Member joined group message:", message)
//     let inbox_of = member_id
//     let convers_with = group.uid
//     deliverMessage(exchange, appid, message, inbox_of, convers_with, function(err) {
//       if (err) {
//         console.log("error delivering message to joined member", inbox_of)
//         callback(err)
//         return
//       }
//       else {
//         console.log("DELIVERED MESSAGE TO", inbox_of, "CONVERS_WITH", convers_with)
//       }
//     })
//   }
//   // 2. pubblish old group messages to the joined member (in the member/group-conversWith timeline)
//   const userid = group.uid
//   const convid = group.uid
//   chatdb.lastMessages(appid, userid, convid, 1, 200, function(err, messages) {
//     if (err) {
//       console.log("Error", err)
//       callback(err)
//     }
//     else if (!messages) {
//       console.log("No messages in group", group.uid)
//       callback(null)
//     }
//     else {
//       console.log("delivering old group messages to:", joined_member_id)
//       const inbox_of = joined_member_id
//       const convers_with = group.uid
//       messages.forEach(message => {
//         // TODO: CHECK IN MESSAGE WAS ALREADY DELIVERED. (CLIENT? SERVER?)
//         console.log("Message:", message.text)
//         deliverMessage(exchange, appid, message, inbox_of, convers_with, function(err) {
//           if (err) {
//             console.log("error delivering message to joined member", inbox_of)
//           }
//           else {
//             console.log("DELIVERED MESSAGE TO", inbox_of, "CONVERS_WITH", convers_with)
//           }
//         })
//       });
//       callback(null)
//     }
//   })
// }

// function addMemberToGroupAndNotifyUpdate(exchange, user, joined_member_id, group_id, callback) {
//   chatdb.getGroup(group_id, function(err, group) {
//     console.log("group found?", group, "err", err)
//     if (err || !group) {
//       const reply = {
//           success: false,
//           err: (err && err.message()) ? err.message() : "Not found",
//           http_status: 404
//       }
//       // res.status(404).send(reply)
//       if (callback) {
//         callback(reply, null)
//       }
//     }
//     else {
//       console.log("group members", group.members)
//       console.log("group owner", group.owner)
//       im_owner = (group.owner === user.uid)
//       im_admin = user.roles.admin
//       console.log("im_owner:",im_owner)
//       console.log("im_admin:",im_admin)
//       if (im_admin || im_owner) {
//         if (group.members[joined_member_id]) {
//           const reply = {
//             success: false,
//             err: "Already a member",
//             http_status: 401
//           }
//           if (callback) {
//             callback(reply, null)
//           }
//           return
//         }
//         group.members[joined_member_id] = 1
//         chatdb.joinGroup(group_id, joined_member_id, function(err) {
//           if (err) {
//             console.log("An error occurred:", err)
//             const reply = {
//                 success: false,
//                 err: err.message() ? err.message() : "Error joining group",
//                 http_status: 500
//             }
//             // res.status(500).send(reply)
//             if (callback) {
//               callback(reply, null)
//             }
//           }
//           else {
//             console.log("group updated with new joined member.")
//             notifyGroupUpdate(exchange, group, group.members, function(err) {
//               console.log("PUBLISHED 'UPDATE GROUP'")
//               if (err) {
//                 if (callback) {
//                   callback({"success":false, "err": err, http_status: 500}, null)
//                   return
//                 }
//               }
//               else {
//                 if (callback) {
//                   callback(
//                     {"success":true,
//                       http_status: 200
//                     },
//                     group // SUCCESS!!!!
//                   )
//                   console.log("GROUP IS", group)
//                 }
//               }
//             });
//           }
//         })
//       }
//       else {
//         const reply = {
//           success: false,
//           err: "Not allowed"
//         }
//         // res.status(401).send(reply)
//         if (callback) {
//           callback(reply, null)
//         }
//       }
//     }
//   });
// }

/** Set members of a group */
app.put(BASEURL + '/:app_id/groups/:group_id/members', (req, res) => {
  console.log('set members group', req.body);
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
  console.log('set members group');
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
  console.log('set members group');
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
        console.log("JWTKEY:", jwtKey)
        console.log("token:", token)
        
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