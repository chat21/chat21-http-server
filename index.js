/*
    Andrea Sponziello - (c) Tiledesk.com
*/

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
console.log("Logger level:", logger.logLevel);
const axios = require('axios'); // ONLY FOR TEMP PUSH WEBHOOK ENDPOINT
const https = require('https'); // ONLY FOR TEMP PUSH WEBHOOK ENDPOINT
const { TdCache } = require('./TdCache.js');
const { Contacts } = require('./Contacts.js');
let tdcache = null;

const jwtKey = process.env.JWT_KEY || "tokenKey";
const BASEURL = process.env.BASEURL || '/api';
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
  var urlobj = url.parse(req.originalUrl);
  if (urlobj.pathname === '/' || urlobj.pathname === '/test' || urlobj.pathname.includes("/push/webhook/endpoint/") ) {
    next();
    return;
  }
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
    logger.error('Unauthorized.');
    return res.status(403).send({success: false, msg: 'Unauthorized.'});
  }
  
});

app.get("/", (req, res) => {
  res.status(200).send("Chat21 Http Server v. 0.1.2")
})

// http://localhost:8004/test?projectid=646c838d55f7620013e4ab92&mqtt_endpoint=wss%3A%2F%2Feu.rtmv3.tiledesk.com%2Fmqws%2Fws&api_endpoint=https%3A%2F%2Fapi.tiledesk.com%2Fv3&chatapi_endpoint=https%3A%2F%2Feu.rtmv3.tiledesk.com%2Fchatapi%2Fapi
const { Chat21Client } = require('./mqttclient/chat21client.js');
app.get("/test", (req, res) => {

  let TILEDESK_PROJECT_ID = "" || req.query.projectid;
  // if (process.env && process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID) {
  //   TILEDESK_PROJECT_ID = process.env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID
  //     // console.log("TILEDESK_PROJECT_ID:", TILEDESK_PROJECT_ID);
  // }
  // else {
  //     throw new Error(".env.PERFORMANCE_TEST_TILEDESK_PROJECT_ID is mandatory");
  // }

  // console.log("process.env.PERFORMANCE_TEST_MQTT_ENDPOINT:", process.env.PERFORMANCE_TEST_MQTT_ENDPOINT);
  let MQTT_ENDPOINT = "" || req.query.mqtt_endpoint;
  // if (process.env && process.env.PERFORMANCE_TEST_MQTT_ENDPOINT) {
  //   MQTT_ENDPOINT = process.env.PERFORMANCE_TEST_MQTT_ENDPOINT
  //     // console.log("MQTT_ENDPOINT:", MQTT_ENDPOINT);
  // }
  // else {
  //     throw new Error(".env.PERFORMANCE_TEST_MQTT_ENDPOINT is mandatory");
  // }

  let API_ENDPOINT = "" || req.query.api_endpoint;
  // if (process.env && process.env.PERFORMANCE_TEST_API_ENDPOINT) {
  //   API_ENDPOINT = process.env.PERFORMANCE_TEST_API_ENDPOINT
  //     // console.log("API_ENDPOINT:", API_ENDPOINT);
  // }
  // else {
  //     throw new Error(".env.PERFORMANCE_TEST_API_ENDPOINT is mandatory");
  // }

  let CHAT_API_ENDPOINT = "" || req.query.chatapi_endpoint;
  // if (process.env && process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT) {
  //   CHAT_API_ENDPOINT = process.env.PERFORMANCE_TEST_CHAT_API_ENDPOINT
  //     // console.log("CHAT_API_ENDPOINT:", CHAT_API_ENDPOINT);
  // }
  // else {
  //     throw new Error(".env.PERFORMANCE_TEST_CHAT_API_ENDPOINT is mandatory");
  // }

  let config = {
      MQTT_ENDPOINT: MQTT_ENDPOINT,
      CHAT_API_ENDPOINT: CHAT_API_ENDPOINT,
      APPID: 'tilechat',
      TILEDESK_PROJECT_ID: TILEDESK_PROJECT_ID,
      MESSAGE_PREFIX: "Performance-test",
  }

  let user1 = {
    fullname: 'User 1',
    firstname: 'User',
    lastname: '1',
  };




let chatClient1 = new Chat21Client(
  {
      appId: config.APPID,
      MQTTendpoint: config.MQTT_ENDPOINT,
      APIendpoint: config.CHAT_API_ENDPOINT,
      log: false
  });
  
  (async () => {
      let userdata;
      try {
          userdata = await createAnonymousUser(TILEDESK_PROJECT_ID, API_ENDPOINT);
      }
      catch(error) {
          console.log("An error occurred during anonym auth:", error);
          process.exit(0);
      }
      
      user1.userid = userdata.userid;
      user1.token = userdata.token;
  
      let group_id;
      let group_name;
  
      console.log("Message delay check.");
      console.log("MQTT endpoint:", config.MQTT_ENDPOINT);
      console.log("API endpoint:", config.CHAT_API_ENDPOINT);
      console.log("Tiledesk Project Id:", config.TILEDESK_PROJECT_ID);
  
      console.log("Connecting...")
      chatClient1.connect(user1.userid, user1.token, () => {
          console.log("chatClient1 connected and subscribed.");
          group_id = "support-group-" + "64690469599137001a6dc6f5-" + uuid().replace(/-+/g, "");
          group_name = "benchmarks group => " + group_id;
          send(group_id, group_name, chatClient1, config, user1, function(delay) {
            chatClient1.close()
            res.json({delay: delay});
  
            // process.exit(0);
          });
      });
  })();
  

  // res.status(200).send("Chat21 Http Server v. 0.1.2")
})



async function send(group_id, group_name, chatClient, config, user, callback) {
  console.log("\n\n***********************************************");
  console.log("********* Single message delay script *********");
  console.log("***********************************************\n\n");
  let time_sent = Date.now();
  let handler = chatClient.onMessageAdded((message, topic) => {
      console.log("> Incoming message [sender:" + message.sender_fullname + "]: " + message.text);
      if (
          message &&
          message.text.startsWith(config.MESSAGE_PREFIX) &&
          (message.sender_fullname !== "User 1" && message.sender_fullname !== "System") && // bot is the sender
          message.recipient === group_id
      ) {
          console.log("> Incoming message (sender is the chatbot) used for computing ok.");
          let text = message.text.trim();
          let time_received = Date.now();
          let delay = time_received - time_sent;
          console.log("Total delay:" + delay + "ms");

          callback(delay);         
      }
      else {
          console.log("Message not computed:", message.text);
      }
  });
  console.log("Sending test message...");
  let recipient_id = group_id;
  let recipient_fullname = group_name;
  let message_UUID = uuid().replace(/-+/g, "");
  sendMessage(message_UUID, recipient_id, recipient_fullname, async (latency) => {
      console.log("Sent ok:", message_UUID);
  }, chatClient, config, user);
}

function sendMessage(message_UUID, recipient_id, recipient_fullname, callback, chatClient, config, user) {
  const sent_message = config.MESSAGE_PREFIX + "/"+ message_UUID;
  console.log("Sending message with text:", sent_message);
  
  chatClient.sendMessage(
      sent_message,
      'text',
      recipient_id,
      recipient_fullname,
      user.fullname,
      {projectId: config.TILEDESK_PROJECT_ID},
      null, // no metadata
      'group',
      (err, msg) => {
          if (err) {
              console.error("Error send:", err);
          }
          console.log("Message Sent ok:", msg);
      }
  );
}

async function createAnonymousUser(tiledeskProjectId,API_ENDPOINT) {
  ANONYMOUS_TOKEN_URL = API_ENDPOINT + '/auth/signinAnonymously';
  console.log("Getting ANONYMOUS_TOKEN_URL:", ANONYMOUS_TOKEN_URL);
  return new Promise((resolve, reject) => {
      let data = JSON.stringify({
          "id_project": tiledeskProjectId
      });
  
      let axios_config = {
          method: 'post',
          url: ANONYMOUS_TOKEN_URL, //'https://api.tiledesk.com/v3/auth/signinAnonymously',
          headers: { 
              'Content-Type': 'application/json'
          },
          data : data
      };
  
      axios.request(axios_config)
      .then((response) => {
      console.log("Got Anonymous Token:", JSON.stringify(response.data.token));
      CHAT21_TOKEN_URL = API_ENDPOINT + '/chat21/native/auth/createCustomToken';
          let config = {
              method: 'post',
              maxBodyLength: Infinity,
              url: CHAT21_TOKEN_URL,
              headers: { 
                  'Authorization': response.data.token
              }
          };
  
          axios.request(config)
          .then((response) => {
              // console.log(response);

              const mqtt_token = response.data.token;
              const chat21_userid = response.data.userid;
              resolve({
                  userid: chat21_userid,
                  token:  mqtt_token
              });
          })
          .catch((error) => {
              console.log(error);
              reject(error);
          });
      })
      .catch((error) => {
          console.log(error);
          reject(error)
      });
  });
}

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
    logger.debug("Got conversations.");
    if (err) {
      logger.error("Error getting conversations", err);
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
  });
});

app.get(BASEURL + "/:appid/getInfo", (req, res) => {
  res.status(200).send({"v": "0.2.34.2"})
});

/** Delete all conversations from all timelines belonging to a group */
app.delete(BASEURL + '/:app_id/:group_id/conversations/timelines', async (req, res) => {
  // app.delete('/groups/:group_id/members/:member_id', (req, res) => {
  logger.debug('HTTP: Delete all conversations from all timelines belonging to a group');
  if (!req.params.group_id) {
      res.status(405).send('group_id is mandatory');
      return
  }
  else if (!req.params.app_id) {
      res.status(405).send('app_id is mandatory');
      return
  }
  let group_id = req.params.group_id;
  let app_id = req.params.app_id;
  const user = req.user
  logger.debug('app_id:' + app_id);
  logger.debug('group_id:' + group_id);
  chatapi.removeAllConversWithConversations(app_id, group_id, function(err) {
    logger.debug('removeAllConversWithConversations error?', err);
    if (err) {
      res.status(405).send(err)
    }
    else {
      res.status(200).send({success: true})
    }
  });
});

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
  conversationDetail(req, false, function(err, docs) {
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

app.get(BASEURL + "/:appid/:userid/archived_conversations/:conversWith", (req, res) => {
  logger.debug("HTTP: GET /:appid/:userid/conversations/:conversWith");
  if (!authorize(req, res)) {
    return
  }
  conversationDetail(req, true, function(err, docs) {
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

function conversationDetail(req, archived, callback) {
  // logger.debug("getting /:appid/:userid/archived_conversations")
  const appid = req.params.appid
  const userid = req.params.userid
  const conversWith = req.params.conversWith
  chatdb.conversationDetail(appid, userid, conversWith, archived, function(err, docs) {
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

/** Delete (Archive) a conversation */
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
app.get(BASEURL + '/:appid/groups/:group_id', async (req, res) => {
  logger.debug("HTTP: Get group data. getting /:appid/groups/group_id")
  if (!authorize(req, res)) {
    logger.debug("Unauthorized!")
    return
  }
  const group_id = req.params.group_id
  let cached_group = await groupFromCache(group_id);
  console.log("cached group:", cached_group);
  if (cached_group) {
    im_member = cached_group.members[req.user.uid]
    im_admin = req.user.roles.admin
    if (im_member || im_admin) {
      const reply = {
        success: true,
        result: cached_group
      }
      res.status(200).json(reply);
      return;
    }
    else {
      const reply = {
        success: false,
        err: "Permission denied"
      }
      res.status(401).send(reply)
      return;
    }
  }
  chatdb.getGroup(group_id, async (err, group) => {
    if (err) {
      const reply = {
          success: false,
          err: err.message()
      }
      res.status(404).send(reply)
    }
    else if (group) {
      // logger.debug("group members", group.members)
      await saveGroupInCache(group, group_id);
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
app.post(BASEURL + '/:appid/groups/:group_id/members', async (req, res) => {
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
  console.log('joined_member_id:', joined_member_id);
  console.log('join group_id:', group_id);
  // logger.debug('chatapi', chatapi);
  await resetGroupCache(group_id);
  console.log("Got group to join to", group_id);
  chatapi.addMemberToGroupAndNotifyUpdate(req.user, joined_member_id, group_id, async (err, group) => {
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
      logger.debug("Notifying to other members and copying old group messages to new user timeline...")
      const joined_member = await chatapi.getContact(joined_member_id);
      let message_label = {
        key: "MEMBER_JOINED_GROUP",
        parameters: {
          member_id: joined_member_id,
          fullname: joined_member.fullname,
          firstname: joined_member.firstname,
          lastname: joined_member.lastname
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
app.put(BASEURL + '/:app_id/groups/:group_id/members', async (req, res) => {
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
  await resetGroupCache(group_id);
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
app.delete(BASEURL + '/:app_id/groups/:group_id/members/:member_id', async (req, res) => {
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
  await resetGroupCache(group_id);
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
app.put(BASEURL + '/:app_id/groups/:group_id', async (req, res) => {
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
  await resetGroupCache(group_id);
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
app.put(BASEURL + '/:app_id/groups/:group_id/attributes', async (req, res) => {
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
  const group_id = req.params.group_id;
  const user = req.user;
  await resetGroupCache(group_id);
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
 * Sends a push notification for a new message.
 * Admin role only
 */
 app.post(BASEURL + '/:app_id/notify', (req, res) => {
  logger.debug('HTTP: Send push notification for a new message:', JSON.stringify(req.body));
  
  if (!req.params.app_id) {
    res.status(405).send('app_id is mandatory!');
    return;
  }

  const im_admin = req.user.roles.admin
  // logger.debug("im_admin?", im_admin, "roles:", req.user.roles)
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

  chatpush.sendNotification(req.body.data.app_id, req.body.data, req.body.data.sender, req.body.delivered_to);

});

/**
 * TEMPORARY PUSH WEBHOOK ENDPOINT. TO BE REMOVED.
 */
 app.post(BASEURL + '/:app_id/push/webhook/endpoint/:token', (req, res) => {
  res.status(200).send({success: true});

  logger.debug('/push/webhook/endpoint postdata:', JSON.stringify(req.body));
  const event_type = req.body.event_type;
  if (event_type !== 'message-delivered') {
    return;
  }
  logger.log("Processing new message-delivered event...");
  if (!req.params.app_id) {
    res.status(405).send('app_id is mandatory!');
    return;
  }
  if (!req.params.token) {
    res.status(405).send('webhook token is mandatory!');
    return;
  }

  if (!req.params.token === process.env.PUSH_WH_WEBHOOK_TOKEN) {
    res.status(405).send('webhook token error!');
    return;
  }

  const httpsAgent = new https.Agent({
      rejectUnauthorized: false // (NOTE: this will disable client verification)
  });

  let axios_req = {
      url: process.env.PUSH_WH_NOTIFY_URL,
      method: 'POST',
      data: req.body,
      headers: {
          'Authorization': process.env.PUSH_WH_CHAT21_API_ADMIN_TOKEN
      },
      httpsAgent: httpsAgent
  }
  // logger.log("axios_req:", axios_req);

  axios(axios_req)
    .then(function (response) {
      logger.log("response.status:", response.status);
    })
    .catch(function (error) {
      logger.error("Axios call error:", error);
    });

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

async function saveGroupInCache(group, group_id) {
  if (tdcache) {
    const group_key = "chat21:messages:groups:" + group_id;
    await tdcache.set(
      group_key,
      JSON.stringify(group),
      {EX: 86400} // 1 day
    );
  }
}

async function groupFromCache(group_id) {
  logger.debug("groupFromCache() group_id:", group_id)
  if (tdcache) {
    const group_key = "chat21:messages:groups:" + group_id;
    logger.debug("get from cache by group key", group_key)
    let group = null;
    try {
      const group_s = await tdcache.get(group_key);
      console.log("group_s", group_s)
      return JSON.parse(group_s);
    }
    catch(err) {
      console.error("Error getting from cache by group key", error);
    }
    return group;
  }
  else {
    logger.log("No Redis. Returning no group from cache.");
    return null;
  }
}

async function resetGroupCache(group_id) {
  if (tdcache) {
    try {
      const group_key = "chat21:messages:groups:" + group_id;
      await tdcache.client.del(group_key);
      logger.debug("removed group from cache:", group_key);
    }
    catch (error) {
      console.error("An error occurred getting redis:", contact_key);
    }
  }
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
    throw new Error('(Chat21-http) please configure process.env.RABBITMQ_URI or use parameter config.rabbimq_uri option.');
  }

  // redis
  if (config.CACHE_ENABLED == undefined || (config.CACHE_ENABLED && config.CACHE_ENABLED !== 'true')) {
    console.log("(Chat21-http) Cache (Redis) disabled.");
  }
  else {
    console.log("(Chat21-http) Cache (Redis) enabled.");
    if (config && config.REDIS_HOST && config.REDIS_PORT) {
      tdcache = new TdCache({
        host: config.REDIS_HOST,
        port: config.REDIS_PORT,
        password: config.REDIS_PASSWORD
      });
    }
  }
  
  let mongouri = null;
  if (config && config.mongodb_uri) {
    mongouri = config.mongodb_uri;
  }
  else if (process.env.MONGODB_URI) {
    mongouri = process.env.MONGODB_URI;
  }
  else {
    throw new Error('please configure process.env.MONGODB_URI or use parameter config.mongodb_uri option.');
  }

  logger.info("(Chat21-http) Connecting to MongoDB...");

  // Create a database variable outside of the
  // database connection callback to reuse the connection pool in the app.
  var db;
  var client;
  try {
    client = await mongodb.MongoClient.connect(mongouri, { useNewUrlParser: true, useUnifiedTopology: true })
  }
  catch(error) {
    logger.error("(Chat21-http) An error occurred during connection to MongoDB:", error);
    process.exit(1);
  }
  logger.info("(Chat21-http) MongoDB connected.")
  db = client.db();
  chatdb = new ChatDB({database: db})
  chatpush = new Chat21Push({database: chatdb});
  if (tdcache) {
    logger.info("(Chat21-http) connecting to tdcache (Redis)...");
    try {
      await tdcache.connect();
      logger.info("(Chat21-http) tdcache (Redis) connected.");
    }
    catch (error) {
      tdcache = null;
      console.error("(Chat21-http) tdcache (Redis) connection error:", error);
    }
    console.info("(Chat21-http) tdcache (Redis) connected.");
  }
  let contacts_endpoint = process.env.CONTACTS_LOOKUP_ENDPOINT;
  if (config.CONTACTS_LOOKUP_ENDPOINT) {
    contacts_endpoint = config.CONTACTS_LOOKUP_ENDPOINT;
  }
  const contacts = new Contacts({
    CONTACTS_LOOKUP_ENDPOINT: contacts_endpoint,
    tdcache: tdcache,
    log: false
  });

  chatapi = new Chat21Api(
  {
    exchange: 'amq.topic',
    database: chatdb,
    rabbitmq_uri: rabbitmq_uri,
    contacts: contacts
  });
  var amqpConnection = await chatapi.start();
  logger.info("(Chat21-http) [AMQP] connected.");
  logger.info("(Chat21-http) Server started.");
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
