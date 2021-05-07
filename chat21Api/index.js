/* 
    ver 0.1
    Andrea Sponziello - (c) Tiledesk.com
*/

/**
 * Chat21Api for NodeJS
 */
const winston = require("../winston");

var amqp = require('amqplib/callback_api');
const { uuid } = require('uuidv4');
const { JsonWebTokenError } = require('jsonwebtoken');

class Chat21Api {

    /**
     * Constructor
     * @example
     * const { Chat21Api } = require('chat21Api');
     * const chatapi = new Chat21Api({exchange: 'amq.topic', database: db});
     * 
     */
    constructor(options) {
        if (!options.exchange) {
            throw new Error('exchange option can NOT be empty.');
        }
        if (!options.database) {
            throw new Error('database option can NOT be empty.');
        }
        this.chatdb = options.database
        this.exchange = options.exchange
        this.pubChannel = null;
        this.offlinePubQueue = [];
        this.amqpConn = null;
    }
  
    archiveConversation(app_id, user_id, convers_with, callback) {
        // NOTE! THIS ARRIVES DIRECTLY ON THE CLIENT! REFACTOR WITH SOME "OBSERVER.APPS....ARCHIVE" TOPIC
        let dest_topic = `apps.${app_id}.users.${user_id}.conversations.${convers_with}.archive`
        winston.debug("archive dest_topic: " + dest_topic)
        let patch = {
            action: 'archive'
        }
        const payload = JSON.stringify(patch)
        this.publish(dest_topic, Buffer.from(payload), function(err) {
            if (callback) {
                callback(err)
            }
        });
    }

    // REFACTOR AS SET MEMBERS
    createGroup(group, callback) {
        // 1. create group json
        // 2. save group json in mongodb
        // 3. publish to /observer
        // 4. observer publishes JSON to all members (task on the observer)
        // 5. observer (virtually) creates group 'timelineOf' messages (that's created on the first message sent by one member)
        this.saveOrUpdateGroup(group, (err) => { // 2. save group json in mongodb
            if (err) {
                console.error("Error while saving 'create group':", err);
                callback(err);
            }
            else {
                var create_group_topic = `apps.observer.${group.appId}.groups.create`
                winston.debug("Publishing to topic: " + create_group_topic);
                winston.debug(">>> NOW PUBLISHING... CREATE GROUP TOPIC: " + create_group_topic)
                const group_payload = JSON.stringify(group)
                this.publish(create_group_topic, Buffer.from(group_payload), function(err) { // 3. publish to /observer
                    if (err) {
                        console.error("Error while publishing 'create group':", err);
                        callback(err);
                    }
                    else {
                        winston.debug("PUBLISHED 'CREATE GROUP' ON TOPIC: " + create_group_topic);
                        callback(null);
                    }
                });
            }
        })
    }

    saveOrUpdateGroup(group, callback) {
        this.chatdb.saveOrUpdateGroup(group, function(err, doc) {
          if (err) {
            winston.error("Error saving group:", err);
            callback(err);
            return
          }
          else {
            callback(null);
          }
        })
    }

    addMemberToGroupAndNotifyUpdate(user, joined_member_id, group_id, callback) {
        console.debug("addMemberToGroupAndNotifyUpdate()")
        this.chatdb.getGroup(group_id, (err, group) => {
          console.debug("found group", group)
          if (err || !group) {
            winston.error("group found? with err", err)
            const reply = {
                success: false,
                err: (err && err.message()) ? err.message() : "Not found",
                http_status: 404
            }
            // res.status(404).send(reply)
            if (callback) {
              callback(reply, null)
            }
          }
          else {
            //group.appId = app_id;
            console.debug("actual group members", group.members)
            console.debug("actual group owner", group.owner)
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            console.debug("im_owner: " + im_owner)
            console.debug("im_admin: " + im_admin)
            if (im_admin || im_owner) {
              console.debug("adding member", joined_member_id)
              if (group.members[joined_member_id]) {
                const reply = {
                  success: false,
                  err: "Already a member",
                  http_status: 401
                }
                if (callback) {
                  callback(reply, null)
                }
                return
              }
              group.members[joined_member_id] = 1
              console.debug("new members to add", group.members)
              this.chatdb.joinGroup(group_id, joined_member_id, (err) => {
                if (err) {
                  winston.error("An error occurred:", err)
                  const reply = {
                      success: false,
                      err: err.message() ? err.message() : "Error joining group",
                      http_status: 500
                  }
                  if (callback) {
                    callback(reply, null)
                  }
                }
                else {
                  console.debug("group updated with new joined member.")
                  this.notifyGroupUpdate(group, group.members, (err) => {
                    console.debug("PUBLISHED 'UPDATE GROUP'")
                    if (err) {
                      if (callback) {
                        callback({"success":false, "err": err, http_status: 500}, null)
                        return
                      }
                    }
                    else {
                      if (callback) {
                        callback(
                          {"success":true,
                            http_status: 200
                          },
                          group // SUCCESS!!!!
                        )
                        console.debug("GROUP IS", group)
                      }
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
              // res.status(401).send(reply)
              if (callback) {
                callback(reply, null)
              }
            }
          }
        });
    }
    
    /** 
     * Notifies 'groups.update' to the selected user
     */
    notifyGroupUpdate(group, users_to_be_notified, callback) {
        var update_group_topic = `apps.observer.${group.appId}.groups.update`
        console.debug("updating group to " + update_group_topic);
        const data = {
          group: group,
          notify_to: users_to_be_notified //{...new_members, ...old_members }
        }
        const group_payload = JSON.stringify(data)
        console.debug("payload:", group_payload)
        this.publish(update_group_topic, Buffer.from(group_payload), (err) => {
          console.debug("PUBLISHED 'UPDATE GROUP' ON TOPIC: " + update_group_topic)
          callback(err)
        })
    }

    /**
     * Adds a member to a group.
     * 1. Sends "{user} added to this group" message to every member of the group, including the joined one
     * 2. Pubblishes old group messages to the newly joined member timeline
     * NOTE: this method doesn't modify the group members neither sends a group.updated message to
     * the clients. Use addMemberToGroupAndNotifyUpdate() to reach these couple of goals.
     * 
     * @param {*} joined_member_id 
     * @param {*} group 
     * @param {*} callback 
     */
    joinGroup(joined_member_id, group, callback) {
        console.debug("SENDING 'ADDED TO GROUP' TO EACH MEMBER INCLUDING THE JOINED ONE (group:" +  group.uid + ") - members: " + JSON.stringify(group.members))
        const appid = group.appId
        for (let [member_id, value] of Object.entries(group.members)) {
            console.debug("to member: " + member_id)
            const now = Date.now()
            const message = {
                message_id: uuid(),
                type: "text",
                text: joined_member_id + " added to group",
                timestamp: now,
                channel_type: "group",
                sender_fullname: "System",
                sender: "system",
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
            console.debug("Member joined group message: " + JSON.stringify(message))
            let inbox_of = member_id
            let convers_with = group.uid
            this.deliverMessage(appid, message, inbox_of, convers_with, (err) => {
                if (err) {
                    console.error("Error delivering message to joined member", inbox_of)
                    if (callback) {
                        callback(err)
                    }
                    return
                }
                else {
                    console.debug("DELIVERED MESSAGE TO: " + inbox_of + " CONVERS_WITH: " + convers_with)
                }
            })
        }

        // 2. pubblish old group messages to the joined member (in the member/group-conversWith timeline)
        //const userid = group.uid
        // const group_id = 'support-group-6066e60cc3dade4e7389d182-5be10e01-7acc-4135-bbcd-c514f9cc3f8a'
        const group_id = group.uid;
        console.debug("last messages for appid, userid, convid", appid, group_id, group_id);
        // this.chatdb.lastMessages(appid, userid, convid, 1, 200, (err, messages) => {
        this.chatdb.lastMessages(appid, group_id, group_id, 1, 200, (err, messages) => {
            console.debug("lastMessages:", messages);
            console.debug("lastMessages stringify:", JSON.stringify(messages));
            if (err) {
                console.error("lastMessages Error", err)
                if (callback) {
                    callback(err)
                }
            }
            else if (!messages) {
                console.info("No messages in group: " + group_id)
                if (callback) {
                    callback(null)
                }
            }
            else {
                console.debug("delivering old group messages to: " + joined_member_id)
                const inbox_of = joined_member_id
                const convers_with_group = group_id
                messages.forEach(message => {
                    // TODO: CHECK IN MESSAGE WAS ALREADY DELIVERED. (CLIENT? SERVER?)
                    message["__history"] = "true"
                    console.debug("Delivering message: " + message.text)
                    this.deliverMessage(appid, message, inbox_of, convers_with_group, (err) => {
                        if (err) {
                            console.error("error delivering message to joined member", inbox_of)
                            if (callback) {
                                callback(err)
                            }
                        }
                        else {
                            // QUI NON ARRIVA IN LOCALE????
                            console.debug("DELIVERED MESSAGE TO: " + inbox_of +  " __CONVERS_WITH__ " + convers_with_group)
                        }
                    })
                });
                callback(null)
            }
        })
    }

    leaveGroup(user, removed_member_id, group_id, app_id, callback) {
        // get group by id
        console.debug("member: " + removed_member_id + " will leave group: " + group_id)
        this.chatdb.getGroup(group_id, (err, group) => {
            if (err || !group) {
              console.error("group found? with err", err)
              const reply = {
                  success: false,
                  err: (err && err.message()) ? err.message() : "Not found",
                  http_status: 404
              }
              if (callback) {
                callback(reply)
              }
            }
            else {
              console.debug("group found.")
              console.debug("actual group members: " + JSON.stringify(group.members))
              console.debug("group owner: " + JSON.stringify(group.owner))
              const im_owner = (group.owner === user.uid)
              const im_admin = user.roles.admin
              const im_member = group.members[user.uid]
              const member_exists = group.members[removed_member_id]
              console.debug("im_owner: " +im_owner)
              console.debug("im_admin: " + im_admin)
              if ((im_admin || im_owner || im_member) && member_exists) {
                let old_members = {...group.members};
                delete group.members[removed_member_id]
                console.debug("old members: " + JSON.stringify(old_members))
                console.debug("new members: " + JSON.stringify(group.members))
                this.chatdb.saveOrUpdateGroup(group, (err) => {
                    if (err) {
                        console.error("An error occurred:", err)
                        const reply = {
                            success: false,
                            err: err,
                            message: "Error saving group"
                        }
                        if (callback) {
                            callback(reply);
                        }
                        return
                    }
                    console.debug("....saved group with leaved member. " + JSON.stringify(group))
                    console.debug("... notify to old members " +old_members + " the new group")
                    this.notifyGroupUpdate(group, old_members, (err) => { // TO OLD MEMBERS
                        if (err) {
                            const reply = {
                                success: false,
                                err: err,
                                message: "Error notitfying group update"
                            }
                            if (callback) {
                                callback(reply);
                            }
                            return
                        }
                        // if (callback) {
                        //     callback(null);
                        // }
                        // old_members.sendMessage("member_id leaved the group")
                        for (let [member_id, value] of Object.entries(old_members)) {
                            console.debug("to member: " + member_id)
                            const now = Date.now()
                            const message = {
                                message_id: uuid(),
                                type: "text",
                                text: removed_member_id + " removed from group",
                                timestamp: now,
                                channel_type: "group",
                                sender_fullname: "System",
                                sender: "system",
                                recipient_fullname: group.name,
                                recipient: group.uid,
                                status: 100, // MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
                                attributes: {
                                    subtype:"info",
                                    updateconversation : true,
                                    messagelabel: {
                                        key: "MEMBER_LEFT_GROUP",
                                        parameters: {
                                            member_id: removed_member_id
                                            // fullname: fullname // OPTIONAL
                                        }
                                    }
                                }
                            }
                            console.debug("Member left group message: " + JSON.stringify(message))
                            let inbox_of = member_id
                            let convers_with = group.uid
                            this.deliverMessage(group.appId, message, inbox_of, convers_with, function(err) {
                                if (err) {
                                    console.error("error delivering message to members (about the member who left)", inbox_of)
                                    if (callback) {
                                        callback(err)
                                    }
                                    return
                                }
                                else {
                                    console.debug("DELIVERED MESSAGE TO: " + inbox_of + " CONVERS_WITH " + convers_with)
                                }
                            })
                        }
                        callback(null);
                    })
                })
                // chatdb.update_group.new_members
                // group.update(new_members).to(current members)
                // new_members.sendMessage("member_id leaved the group")
              }
              else {
                const reply = {
                    success: false,
                    err: (err && err.message()) ? err.message() : "Not found",
                    http_status: 404
                }
                if (callback) {
                  callback(reply)
                }
              }
            }
        });
    }

    deliverMessage(
            appid, // mandatory
            message, // mandatory
            inbox_of, // mandatory
            convers_with, // mandatory
            callback // optional | null
        ) {
        const deliver_message_topic = `apps.observer.${appid}.users.${inbox_of}.messages.${convers_with}.delivered`
        const message_payload = JSON.stringify(message)
        this.publish(deliver_message_topic, Buffer.from(message_payload), function(err) {
            winston.debug("PUBLISH: DELIVER MESSAGE TO TOPIC: " + deliver_message_topic)
            if (err) {
                winston.error("error delivering message to joined member on topic", deliver_message_topic)
                if (callback) {
                    callback(err)
                }
                return
            }
            if (callback) {
                callback(null)
            }
        });
    }

    sendMessage(
        appid, // mandatory
        type, // optional | text
        text, // mandatory
        timestamp, // optional | null
        channel_type, // optional : direct | group | null
        sender, // mandatory
        sender_fullname, // mandatory
        recipient, // mandatory
        recipient_fullname, // mandatory
        attributes, // optional | null
        metadata, // optional | null
        callback // optional | null
      ) {
      const outgoing_message = {
        text: text,
        type: type,
        recipient_fullname: recipient_fullname,
        sender_fullname: sender_fullname,
        channel_type: channel_type? channel_type : "direct",
      }
      if (attributes) {
        outgoing_message.attributes = attributes
      }
      if (metadata) {
        outgoing_message.metadata = metadata
      }
      if (timestamp) {
        outgoing_message.timestamp = timestamp
      }
      winston.debug("outgoing_message: " + JSON.stringify(outgoing_message))
      let dest_topic = `apps.${appid}.users.${sender}.messages.${recipient}.outgoing`
      const message_payload = JSON.stringify(outgoing_message)
      this.publish(dest_topic, Buffer.from(message_payload), function(err) {
        winston.debug("PUBLISHED: SENDING MESSAGE TO TOPIC: " + dest_topic)
        if (err) {
          winston.error("error sending message On topic: " + dest_topic, err)
          if (callback) {
            callback(err)
            return
          }
        }
        winston.verbose("Message Sent to queue: " + JSON.stringify(outgoing_message) + " to "+ dest_topic);
        callback(null)
      });
    }

    setGroupMembers(user, new_members, group_id, callback) {
        console.log("setGroupMembers user:", user, " members:", new_members, " group_id:", group_id)
        this.chatdb.getGroup(group_id, (err, group) => {
            console.log("Got group:", group)
            if (err || !group) {
                winston.error("group found? with err", err)
                callback({err: {message: "Not found"}})
                return
            }
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            if (!(im_admin || im_owner)) {
                callback({err: {message: "Unauthorized"}})
                return
            }
            // 2. update members and update group
            const old_members = {...group.members} // save old members to notify group update LATER
            group.members = new_members;
            
            let added_members = {}
            for (const [key, value] of Object.entries(new_members)) {
                console.log(`${key}: ${value}`);
                if (old_members[key]) {
                    console.log("member alredy present", key)
                }
                else {
                    added_members[key] = 1
                }
            }
            console.log("added_members:", added_members);
            if (Object.keys(added_members).length == 0) {
                console.debug("Same members in group, skipping setGroupMembers()");
                if (callback) {
                    callback({err: {message: "Same members in group, skipping setGroupMembers()"}})
                }
                return
            }

            const now = Date.now()
            group.updatedOn = now;
            this.chatdb.saveOrUpdateGroup(group, (err) => {
                if (err) {
                    console.error("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    if (callback) {
                        callback(reply)
                    }
                    return
                }
                winston.debug("....saved group with no member." + JSON.stringify(group))
                this.notifyGroupUpdate(group, old_members, (err) => { // TO OLD MEMBERS
                    if (err) {
                        console.error("notifyGroupUpdate Error" , err);
                        if (callback) {
                            callback(err);
                        }
                        return
                    }
                    callback(null);
                    // 4. join added members
                    console.log("*****added members", added_members)
                    for (let [member_id, value] of Object.entries(added_members)) {
                        console.debug(">>>>> JOINING MEMBER: " + member_id)
                        this.joinGroup(member_id, group, function(reply) {
                            console.debug("member " + member_id + " invited on group " + group_id + " result " + reply)
                        })
                    }
                })
            })
        })
    }

    updateGroupData(user, group_name, group_id, callback) {
        this.chatdb.getGroup(group_id, (err, group) => {
            if (err || !group) {
                winston.error("group found? with err", err)
                callback({err: {message: "Not found"}})
                return
            }
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            if (!(im_admin || im_owner)) {
                callback({err: {message: "Unauthorized"}})
                return
            }
            // 2. update group
            group.name = group_name;
            const now = Date.now();
            group.updatedOn = now;
            this.chatdb.saveOrUpdateGroup(group, (err) => {
                if (err) {
                    console.error("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    callback(reply)
                    return
                }
                winston.debug("....saved group with no member: " + JSON.stringify(group))
                this.notifyGroupUpdate(group, group.members, (err) => {
                    if (err) {
                        callback(err);
                        return
                    }
                    callback(null);
                })
            })
        })
    }

    updateGroupAttributes(user, group_attributes, group_id, callback) {
        this.chatdb.getGroup(group_id, (err, group) => {
            if (err || !group) {
                winston.error("group found? with err", err)
                callback({err: {message: "Not found"}})
                return
            }
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            if (!(im_admin || im_owner)) {
                callback({err: {message: "Unauthorized"}})
                return
            }
            // 2. update group
            group.attributes = group_attributes;
            const now = Date.now();
            group.updatedOn = now;
            this.chatdb.saveOrUpdateGroup(group, (err) => {
                if (err) {
                    winston.error("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    callback(reply)
                    return
                }
                // winston.debug("....saved group with no member.", group)
                this.notifyGroupUpdate(group, group.members, (err) => {
                    if (err) {
                        callback(err);
                        return
                    }
                    callback(null);
                })
            })
        })
    }

      // AMQP COMMUNICATION

    start() {
        const that = this;
        return new Promise(function (resolve, reject) {
            return that.startMQ(resolve, reject)
        });
    }

     startMQ(resolve, reject) {    
        const that = this;
        var autoRestart = process.env.AUTO_RESTART;
        if (autoRestart===undefined || autoRestart==="true" || autoRestart===true) {
            autoRestart=true;
        } else {
            autoRestart=false;
        }
        winston.info("autoRestart: " + autoRestart);

        
        winston.info("Connecting to RabbitMQ: " + process.env.RABBITMQ_URI)
        amqp.connect(process.env.RABBITMQ_URI, (err, conn) => {
            if (err) {
                console.error("[AMQP]", err.message);
                if (autoRestart) {
                    console.error("[AMQP] reconnecting");
                    return setTimeout(() => { that.startMQ(resolve, reject) }, 1000);
                } else {
                    process.exit(1);
                }                    
            }
            conn.on("error", (err) => {
                if (err.message !== "Connection closing") {
                    console.error("[AMQP] conn error", err.message);
                    return reject(err);
                }
            });
            conn.on("close", () => {
                console.error("[AMQP] close");
                if (autoRestart) {
                    console.error("[AMQP] reconnecting");
                    return setTimeout(() => { that.startMQ(resolve, reject) }, 1000); 
                } else {
                    process.exit(1);
                }        
                                    
            });
            // winston.debug("[AMQP] connected.", conn);
            that.amqpConn = conn;
            that.whenConnected().then(function(ch) {
                return resolve({conn: conn, ch: ch});
            });

            
        });
        
    }
  
    whenConnected() {
        // winston.debug("whenConnected")
        return this.startPublisher();
    }
  
    startPublisher() {
        var that = this;
        return new Promise(function (resolve, reject) {
            that.amqpConn.createConfirmChannel( (err, ch) => {
                if (that.closeOnErr(err)) return;
                ch.on("error", function (err) {
                    console.error("[AMQP] channel error", err.message);
                });
                ch.on("close", function () {
                    winston.error("[AMQP] channel closed");
                });
                that.pubChannel = ch;
                // winston.debug("this.offlinePubQueue.length",that.offlinePubQueue.length)
                if (that.offlinePubQueue.length > 0) {

                    // while (true) {
                    //     var m = this.offlinePubQueue.shift();
                    //     if (!m) break;
                    //     this.publish(m[0], m[1], m[2]);
                    //   }

                    while (true) {
                        winston.debug("PERICOLOOOOOOOOOOOO",that.offlinePubQueue)
                        var [exchange, routingKey, content] = that.offlinePubQueue.shift();
                        // if (!content) break;
                        that.publish(routingKey, content);
                    }
                }
                return resolve(ch)
            });
        });
    }
  
    publish(routingKey, content, callback) {
        try {
            this.pubChannel.publish(this.exchange, routingKey, content, { persistent: true },
            (err, ok) => {
                if (err) {
                    console.error("[AMQP] publish", err);
                    this.offlinePubQueue.push([this.exchange, routingKey, content]);
                    this.pubChannel.connection.close();

                    if (callback) {
                        callback(err)
                    }
                    
                }
                else {
                    winston.debug("published to: " + routingKey + " result " + ok)
                    if (callback) {
                        callback(null)
                    }
                }
            });
        } catch (e) {
            console.error("[AMQP] publish", e.message);
            this.offlinePubQueue.push([this.exchange, routingKey, content]);
            if (callback) {
                callback(e)
            }
        }
    }
  
    closeOnErr(err) {
        if (!err) return false;
        console.error("[AMQP] error", err);
        this.amqpConn.close();
        return true;
    }
  }
  
  module.exports = { Chat21Api };
