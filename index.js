require('dotenv').config();
const express = require("express") // // //
const bodyParser = require("body-parser")
const winston = require("./winston");
const jwt = require("jsonwebtoken")
const { uuid } = require('uuidv4');
var cors = require('cors');
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

    next();
  } else {
    winston.error('Unauthorized.');
    return res.status(403).send({success: false, msg: 'Unauthorized.'});
  }
  
});

app.get("/", (req, res) => {
  res.status(200).send("Chat21 Http Server v. 0.1.2")
})

app.get("/verify", (req, res) => {
    const decoded = decodejwt(req)
    res.status(200).send(decoded)
})


app.get(BASEURL + "/:appid/:userid/conversations", (req, res) => {
  winston.debug("getting /:appid/:userid/conversations")
  if (!authorize(req, res)) {
    winston.debug("Unauthorized!")
    return
  }
  winston.debug("Go with conversations!")
  conversations(req, false, function(err, docs) {
    winston.debug("got conversations", docs, err)
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
  winston.debug("appId:", appid, "user:", JSON.stringify(req.user))
  if (!req.user || (req.user.appId !== appid)) { // (req.user.uid !== userid) || 
    res.status(401).end()
    return false
  }
  return true
}

app.get(BASEURL + "/:appid/:userid/archived_conversations", (req, res) => {
  winston.debug("GET /:appid/:userid/archived_conversations")
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
  // winston.debug("getting /:appid/:userid/archived_conversations")
  const appid = req.params.appid
  const userid = req.params.userid
  chatdb.lastConversations(appid, userid, archived, function(err, docs) {
    callback(err, docs)
  });
}

app.get(BASEURL + "/:appid/:userid/conversations/:convid/messages", (req, res) => {
    winston.debug("getting /:appid/:userid/messages")
    const appid = req.params.appid
    const userid = req.params.userid
    const convid = req.params.convid
    const jwt = decodejwt(req)
    // winston.debug("app:", appid, "user:", userid, "convid:", convid, "token:", jwt)
    if (jwt.sub !== userid || jwt.app_id !== appid) {
        res.status(401).end()
        return
    }
    chatdb.lastMessages(appid, userid, convid, -1, 200, function(err, messages) {
      if (err) {
        const reply = {
            success: false,
            err: err.message()
        }
        res.status(500).send(reply)
      }
      else {
        const reply = {
          success: true,
          result: messages
        }
        // winston.debug("REPLY:", reply)
        res.status(200).json(reply)
      }
    })
})

/** Delete a conversation */
app.delete(BASEURL + '/:app_id/conversations/:recipient_id/', (req, res) => {
  winston.debug('delete: Conversation. req.params:', req.params, 'req.body:', req.body)

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
  winston.debug("im_admin?", im_admin, "roles:", req.user.roles)
  if (req.body.user_id && im_admin) {
    winston.debug('user_id from body:', req.body.user_id);
    user_id = req.body.user_id;
  }

  // winston.debug('recipient_id:', recipient_id);
  // winston.debug('app_id:', app_id);
  winston.debug('user_id:', user_id);

  chatapi.archiveConversation(app_id, user_id, recipient_id, function(err) {
    if (err) {
      res.status(500).send({"success":false, "err": err});
    }
    else {
      res.status(201).send({"success":true});
    }
  })

  // chatApi.archiveConversation(user_id, recipient_id, app_id).then(function(result) {
  //   winston.debug('result', result);
  //   res.status(204).send({"success":true});
  // });
});

/**
 * Sends a message.
 *
 * This endpoint supports CORS.
 */
app.post(BASEURL + '/:app_id/messages', (req, res) => {
  winston.debug('Sends a message:', JSON.stringify(req.body));
  if (!req.body.sender_fullname) {
      winston.error('Sender Fullname is mandatory');
      res.status(405).send('Sender Fullname is mandatory');
      return
  }
  else if (!req.body.recipient_id) {
      winston.error('Recipient id is mandatory');
      res.status(405).send('Recipient id is mandatory');
      return
  }
  else if (!req.body.recipient_fullname) {
      winston.error('Recipient Fullname is mandatory');
      res.status(405).send('Recipient Fullname is mandatory');
      return
  }
  else if (!req.body.text) {
      winston.error('text is mandatory');
      res.status(405).send('text is mandatory');
      return
  }
  winston.debug('validation ok');

  let sender_id = req.user.uid;
  winston.debug('sender_id' + sender_id);

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
  winston.debug('sender_id:', sender_id);
  // winston.debug('sender_fullname', sender_fullname);
  winston.debug('recipient_id:', recipient_id);
  // winston.debug('recipient_fullname', recipient_fullname);
  winston.debug('text:', text);
  // winston.debug('app_id', appid);
  winston.debug('channel_type:', channel_type);
  // winston.debug('attributes', attributes);
  // winston.debug('type', type);
  // winston.debug('metadata', metadata);
  // winston.debug('timestamp', timestamp);
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
      winston.debug("message sent with err", err)
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

  winston.debug("appId:", req.user.appId, "user:", req.user.uid)
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

    winston.debug('group_name', group_name);
    winston.debug('group_id', group_id);
    winston.debug('group_owner', group_owner);
    winston.debug('group_members', group_members);
    winston.debug('app_id', appid);

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
    winston.debug("creating group " + JSON.stringify(group));
    chatapi.createGroup(appid, group, function(err) {
      if (err) {
        res.status(500).send({"success":false, "err": err});
      }
      else {
        res.status(201).send({"success":true, group: group});
      }
    })
});

function newGroupId() {
  group_id = "group-" + uuid();
  return group_id
}

/** Get group data */
app.get(BASEURL + '/:appid/groups/:group_id', (req, res) => {
  winston.debug("getting /:appid/groups/group_id")
  if (!authorize(req, res)) {
    winston.debug("Unauthorized!")
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
      // winston.debug("group members", group.members)
      im_member = group.members[req.user.uid]
      im_admin = req.user.roles.admin
      // winston.debug("im_member:", im_member)
      // winston.debug("im_admin:", im_admin)
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
  winston.debug('adds a member to a group', req.body, req.params);
  if (!authorize(req, res)) {
    winston.debug("Unauthorized")
    res.status(401).send('Unauthorized');
    return
  }
  if (!req.body.member_id) {
      res.status(405).send('member_id is mandatory!');
      return
  }
  const joined_member_id = req.body.member_id;
  const group_id = req.params.group_id;
  winston.debug('joined_member_id', joined_member_id);
  winston.debug('group_id', group_id);
  chatapi.addMemberToGroupAndNotifyUpdate(req.user, joined_member_id, group_id, function(reply, group) {
    winston.debug("THE GROUP:", group)
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
      winston.debug("Error encountered:", reply)
    }
  })
});

/** Set members of a group */
app.put(BASEURL + '/:app_id/groups/:group_id/members', (req, res) => {
  winston.debug('Set members of a group with:', req.body);
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
  // winston.debug("new_members:", new_members)
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
  winston.debug('Leave group');
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
  winston.debug('member_id:', member_id);
  winston.debug('group_id:', group_id);
  winston.debug('app_id:', app_id);
  winston.debug('user:', user.uid);
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
  winston.debug('Update group (just group name)');
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
  winston.debug('Update group custom attributes for group:', req.params.group_id, "body:", JSON.stringify(req.body));
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
    // winston.debug(req.headers)
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
    // winston.debug("token:", token)
    var decoded = null
    try {
        decoded = jwt.verify(token, jwtKey);
    } catch(err) {
        winston.debug("err", err)
    }
    return decoded
}





async function startServer() {

  winston.debug("connecting to mongodb...")

  const mongouri = process.env.MONGODB_URI || "mongodb://localhost:27017/chatdb";
  // var ObjectID = mongodb.ObjectID;
  // Create a database variable outside of the
  // database connection callback to reuse the connection pool in the app.
  var db;

  var client = await mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true })
  winston.debug("mongodb connected...", db)

  db = client.db();
  chatdb = new ChatDB({database: db})
  
  chatapi = new Chat21Api({exchange: 'amq.topic', database: chatdb});
  var amqpConnection = await chatapi.start();  
  winston.debug("[AMQP] connected.", amqpConnection);


}

// startServer();



module.exports = {app: app, startServer: startServer};
