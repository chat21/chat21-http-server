require('dotenv').config();
var url = require('url');
const express = require("express");
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const { uuid } = require('uuidv4');
var cors = require('cors');
var mongodb = require("mongodb");
const { ChatDB } = require('./chatdb/index.js');
const { Chat21Api } = require('./chat21Api/index.js');
const { Chat21Push } = require('./sendpush/index.js');
let logger = require('./tiledesk-logger').logger;

const jwtKey = process.env.JWT_KEY || "tokenKey";
const BASEURL = '/api';
let chatdb = null;
let chatapi = null;
let chatpush = null;

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
  console.log("app.use(), req.query:", req.query);
  var urlobj = url.parse(req.originalUrl);
  if (urlobj.pathname === '/') {
    next();
    return;
  }
  const jwt = decodejwt(req)
  console.log("jwt:", jwt)
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
    logger.error('Unauthorized.');
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
  logger.debug("HTTP: getting /:appid/:userid/conversations")
  if (!authorize(req, res)) {
    logger.debug("Unauthorized!")
    return
  }
  logger.debug("Go with conversations!")
  conversations(req, false, function(err, docs) {
    logger.debug("got conversations", docs, err)
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

app.get(BASEURL + "/:appid/:userid/conversations/archived", (req, res) => {
  logger.debug("HTTP: getting /:appid/:userid/archived_conversations")
  if (!authorize(req, res)) {
    logger.debug("Unauthorized!")
    return
  }
  conversations(req, true, function(err, docs) {
    logger.debug("got archived conversations", docs, err)
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
  logger.debug("appId:", appid, "user:", JSON.stringify(req.user))
  if (!req.user || (req.user.appId !== appid)) { // (req.user.uid !== userid) || 
    res.status(401).end()
    return false
  }
  return true
}

app.get(BASEURL + "/:appid/:userid/archived_conversations", (req, res) => {
  logger.debug("HTTP: GET /:appid/:userid/archived_conversations")
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

app.get(BASEURL + "/:appid/:userid/conversations/:conversWith", (req, res) => {
  logger.debug("HTTP: GET /:appid/:userid/conversations/:conversWith");
  if (!authorize(req, res)) {
    return
  }
  conversationDetail(req, function(err, docs) {
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

function conversationDetail(req, callback) {
  // logger.debug("getting /:appid/:userid/archived_conversations")
  const appid = req.params.appid
  const userid = req.params.userid
  const conversWith = req.params.conversWith
  chatdb.conversationDetail(appid, userid, conversWith, function(err, docs) {
    callback(err, docs);
  });
}

function conversations(req, archived, callback) {
  // logger.debug("getting /:appid/:userid/archived_conversations")
  const appid = req.params.appid
  const userid = req.params.userid
  chatdb.lastConversations(appid, userid, archived, function(err, docs) {
    callback(err, docs)
  });
}

app.get(BASEURL + "/:appid/:userid/conversations/:convid/messages", (req, res) => {
    logger.debug("HTTP: getting /:appid/:userid/messages")
    const appid = req.params.appid
    const userid = req.params.userid
    const convid = req.params.convid
    const jwt = decodejwt(req)
    // logger.debug("app:", appid, "user:", userid, "convid:", convid, "token:", jwt)
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
        // logger.debug("REPLY:", reply)
        res.status(200).json(reply)
      }
    })
})

/** Delete a conversation */
app.delete(BASEURL + '/:app_id/conversations/:recipient_id/', (req, res) => {
  logger.debug('HTTP: delete: Conversation. req.params:', req.params, 'req.body:', req.body)

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
  logger.debug("im_admin?", im_admin, "roles:", req.user.roles)
  if (req.body.user_id && im_admin) {
    logger.debug('user_id from body:', req.body.user_id);
    user_id = req.body.user_id;
  }

  // logger.debug('recipient_id:', recipient_id);
  // logger.debug('app_id:', app_id);
  logger.debug('user_id:', user_id);

  chatapi.archiveConversation(app_id, user_id, recipient_id, function(err) {
    if (err) {
      res.status(500).send({"success":false, "err": err});
    }
    else {
      res.status(201).send({"success":true});
    }
  })

  // chatApi.archiveConversation(user_id, recipient_id, app_id).then(function(result) {
  //   logger.debug('result', result);
  //   res.status(204).send({"success":true});
  // });
});

/**
 * Sends a message.
 *
 * This endpoint supports CORS.
 */
app.post(BASEURL + '/:app_id/messages', (req, res) => {
  logger.debug('HTTP: Sends a message:', JSON.stringify(req.body));
  if (!req.body.sender_fullname) {
      logger.error('Sender Fullname is mandatory');
      res.status(405).send('Sender Fullname is mandatory');
      return
  }
  else if (!req.body.recipient_id) {
      logger.error('Recipient id is mandatory');
      res.status(405).send('Recipient id is mandatory');
      return
  }
  else if (!req.body.recipient_fullname) {
      logger.error('Recipient Fullname is mandatory');
      res.status(405).send('Recipient Fullname is mandatory');
      return
  }
  // else if (!req.body.text) {
  //     logger.error('text is mandatory');
  //     res.status(405).send('text is mandatory');
  //     return
  // }
  logger.debug('validation ok');

  let sender_id = req.user.uid;
  logger.debug('sender_id' + sender_id);

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
  logger.debug('sender_id:' + sender_id);
  // logger.debug('sender_fullname', sender_fullname);
  logger.debug('recipient_id:' + recipient_id);
  // logger.debug('recipient_fullname', recipient_fullname);
  logger.debug('text:'+ text);
  // logger.debug('app_id', appid);
  logger.debug('channel_type:'+ channel_type);
  // logger.debug('attributes', attributes);
  // logger.debug('type', type);
  // logger.debug('metadata', metadata);
  // logger.debug('timestamp', timestamp);
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
      if (err) {
        logger.error("message sent with err", err)
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

/** Create group */
app.post(BASEURL + '/:appid/groups', (req, res) => {
  logger.debug("HTTP: Create a group /:appid/groups")
  logger.debug("appId:" + req.user.appId + ", user:" + req.user.uid)
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

    logger.debug('group_name' + group_name);
    logger.debug('group_id'+ group_id);
    logger.debug('group_owner' + group_owner);
    logger.debug('group_members' + group_members);
    logger.debug('app_id' + appid);

    const now = Date.now()
    var group = {};
    group.name = group_name;
    group.uid = group_id;
    group.appId = appid;
    group.owner = group_owner;
    group.members = group_members;
    group.createdOn = now;
    group.updatedOn = now;
    if (group_attributes) {
        group.attributes = group_attributes;
    }
    logger.debug("creating group " + JSON.stringify(group));
    chatapi.createGroup(group, function(err) {
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
  logger.debug("HTTP: Get group data. getting /:appid/groups/group_id")
  if (!authorize(req, res)) {
    logger.debug("Unauthorized!")
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
      // logger.debug("group members", group.members)
      im_member = group.members[req.user.uid]
      im_admin = req.user.roles.admin
      // logger.debug("im_member:", im_member)
      // logger.debug("im_admin:", im_admin)
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
  logger.debug('HTTP: Join a group. adds a member to a group', req.body, req.params);
  if (!authorize(req, res)) {
    logger.debug("Unauthorized")
    res.status(401).send('Unauthorized');
    return
  }
  if (!req.body.member_id) {
      res.status(405).send('member_id is mandatory!');
      return
  }
  const joined_member_id = req.body.member_id;
  const group_id = req.params.group_id;
  // const app_id = req.params.appid;
  logger.debug('joined_member_id', joined_member_id);
  logger.debug('group_id', group_id);
  // logger.debug('chatapi', chatapi);
  chatapi.addMemberToGroupAndNotifyUpdate(req.user, joined_member_id, group_id, function(err, group) {
    logger.debug("THE GROUP:", group)
    if (err) {
      logger.error("An error occurred while a member was joining the group", err)
      const reply = {
        success: false,
        err: (err) ? err : "An error occurred while a member was joining the group",
        http_status: 405
      }
      res.status(reply.http_status).send(reply)
    }
    else if (group) {
      logger.debug("Notifying to other members and coping old group messages to new user timeline...")
      let message_label = {
        key: "MEMBER_JOINED_GROUP",
        parameters: {
            member_id: joined_member_id
            // fullname: fullname // OPTIONAL
        }
      };
      chatapi.joinGroupMessages(joined_member_id, group, message_label, function(err) {
        logger.debug("member joined. Notified to other members and copied old group messages to new user timeline");
        if (err) {
          logger.error("An error occurred while joining member", err);
          const reply = {
            success: false,
            err: err,
            http_status: 405
          }
          res.status(reply.http_status).send(reply);
        }
        else {
          res.status(200).send({success: true});
        }
      });
    }
    else {
      const reply = {
        success: false,
        err: "Group not found",
        http_status: 405
      }
      logger.error("Error encountered:", reply);
      res.status(reply.http_status).send(reply);
    }
  })
});

/** Set members of a group */
app.put(BASEURL + '/:app_id/groups/:group_id/members', (req, res) => {
  logger.debug('HTTP: Set members of a group with:', req.body);
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
  // logger.debug("new_members:", new_members)
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
  logger.debug('HTTP: Leave group');
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
  logger.debug('member_id:'+ member_id);
  logger.debug('group_id:' + group_id);
  logger.debug('app_id:' + app_id);
  logger.debug('user:' + user.uid);
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
  logger.debug('HTTP: Update group (just group name)');
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
  logger.debug('HTTP: Update group custom attributes for group:' + req.params.group_id + "body:" + JSON.stringify(req.body));
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

// ****************************************************************
// **************** PUSH NOTIFICATIONS MANAGEMENT *****************
// ****************************************************************

/**
 * Saves an App instance ID.
 *
 * This endpoint supports CORS.
 */
 app.post(BASEURL + '/:app_id/:user_id/instances/:instance_id', (req, res) => {
  logger.debug('HTTP: Adds a user app instance_id:', JSON.stringify(req.body));

  if (!req.params.user_id) {
    res.status(405).send('user_id is mandatory!');
  }

  if (!req.params.app_id) {
    res.status(405).send('app_id is mandatory!');
  }

  let app_id = req.params.app_id;
  let user_id = req.params.user_id;
  logger.log("user_id", user_id)
  logger.log("app_id", app_id)
  const jwt = decodejwt(req)
  if (jwt.sub !== user_id || jwt.app_id !== app_id) {
    res.status(401).send("Unauthorized.")
    return
  }

  if (!req.params.instance_id) {
    res.status(405).send('instance_id is mandatory!');
  }

  let instance_id = req.params.instance_id;

  /*  instance_id : {
        device_model:  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; r...",
        language: "en-US",
        platform: "ionic",
        platform_version: "3.0.55"
      }
  */

  let device_model = req.body.device_model;
  let language = req.body.language;
  let platform = req.body.platform;
  let platform_version = req.body.platform_version;
  let appid = req.params.app_id;
  const instance = {
    app_id: app_id,
    user_id: user_id,
    instance_id: instance_id,
    device_model:  device_model,
    language: language,
    platform: platform,
    platform_version: platform_version
  }
  chatpush.saveAppInstance(
    instance,
    function(err) {
      if (err) {
        logger.error("instance saving error", err);
        const reply = {
          success: false,
          err: err
        }
        res.status(404).send(reply)
      }
      else {
        res.status(200).send({success: true})
      }
    }
  )
});

/**
 * Send push notification for a new message.
 * Admin users only
 * This endpoint supports CORS.
 */
 app.post(BASEURL + '/:app_id/notify', (req, res) => {
  logger.debug('HTTP: Send push notification for a new message:', JSON.stringify(req.body));
  
  const im_admin = req.user.roles.admin
  logger.debug("im_admin?", im_admin, "roles:", req.user.roles)
  if (!im_admin) {
    return res.status(403).send({success: false, msg: 'Unauthorized.'});
  }

  res.status(200).send({success: true})

  /*
  {
    "event_type": "message-sent",
    "createdAt": 1637857283012,
    "recipient_id": "03-ANDREALEO",
    "app_id": "tilechat",
    "message_id": "d9627444-d3ed-4bce-ba7c-4d16950f6343",
    "data": {
      "text": "test2",
      "type": "text",
      "recipient_fullname": "Andrea Leo",
      "sender_fullname": "Andrea Sponziello",
      "attributes": {
        "client": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
        "sourcePage": "http://localhost:8100/#/conversation-detail/03-ANDREALEO/Andrea%20Leo/active",
        "userEmail": "andreasponziello@tiledesk.com",
        "userFullname": "Andrea Sponziello",
        "lang": "en"
      },
      "metadata": "",
      "channel_type": "direct",
      "message_id": "d9627444-d3ed-4bce-ba7c-4d16950f6343",
      "sender": "6d011n62ir097c0143cc42dc",
      "recipient": "03-ANDREALEO",
      "app_id": "tilechat",
      "timestamp": 1637857283009,
      "status": 100
    },
    "extras": {
      "topic": "apps.tilechat.users.6d011n62ir097c0143cc42dc.messages.03-ANDREALEO.clientadded"
    }
  }
  */

  // sendNotification(app_id, message, sender_id, recipient_id)
  chatpush.sendNotification(req.body.app_id, req.body.data, req.body.data.sender, req.body.recipient_id);

});

// ********************************************************************
// **************** END PUSH NOTIFICATIONS MANAGEMENT *****************
// ********************************************************************

function decodejwt(req) {
    logger.debug(req.headers)
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
    logger.debug("token:", token)
    var decoded = null
    try {
        decoded = jwt.verify(token, jwtKey);
    } catch(err) {
        logger.debug("err", err)
    }
    return decoded
}





async function startAMQP(config) {
  let rabbitmq_uri = null;
  if (config && config.rabbitmq_uri) {
    // logger.log("rabbitmq_uri found in config", config)
    rabbitmq_uri = config.rabbitmq_uri;
  }
  else if (process.env.RABBITMQ_URI) {
    // logger.log("rabbimq_uri found in env")
    rabbitmq_uri = process.env.RABBITMQ_URI;
  }
  else {
    throw new Error('please configure process.env.RABBITMQ_URI or use parameter config.rabbimq_uri option.');
  }
  
  const mongouri = process.env.MONGODB_URI || "mongodb://localhost:27017/chatdb";
  logger.log("Connecting to MongoDB: " + mongouri);

  // Create a database variable outside of the
  // database connection callback to reuse the connection pool in the app.
  var db;
  var client;
  try {
    client = await mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true })
  }
  catch(error) {
    logger.error("(ChatHttpServer) An error occurred during connection to MongoDB:", error);
    process.exit(1);
  }
  logger.log("MongoDB connected.")
  db = client.db();
  chatdb = new ChatDB({database: db})
  
  chatapi = new Chat21Api({exchange: 'amq.topic', database: chatdb, rabbitmq_uri: rabbitmq_uri});
  chatpush = new Chat21Push({database: chatdb});
  var amqpConnection = await chatapi.start();
  logger.log("[AMQP] connected.");
}

// let rabbitmq_uri;

// async function startServer(config, callback) {
  
//   if (!config || (config && !config.rabbitmq_uri)) {
//     throw new Error('config.rabbitmq_uri option can NOT be empty. Please specify this property value in config JSON');
//   }

//   rabbitmq_uri = config.rabbitmq_uri;
//   app.listen(port, () => {
//     callback();
//   });
// }



module.exports = {app: app, startAMQP: startAMQP, logger: logger};
