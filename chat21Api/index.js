/* 
    ver 0.1
    Andrea Sponziello - (c) Tiledesk.com
*/

/**
 * Chat21Api for NodeJS
 */

var amqp = require('amqplib/callback_api');
const { uuid } = require('uuidv4');

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
        let dest_topic = `apps.${app_id}.users.${user_id}.conversations.${convers_with}.archive`
        console.log("archive dest_topic:", dest_topic)
        const payload = JSON.stringify({})
        
        this.publish(dest_topic, Buffer.from(payload), function(err) {
            if (callback) {
                callback(err)
            }
        });
    }

    // REFACTOR AS SET MEMBERS
    createGroup(appid, group, callback) {
        // 1. create group json
        // 2. save group json in mongodb
        // 3. publish to /observer
        // 4. observer publishes JSON to all members
        // 5. observer (virtually) creates group 'timelineOf' messages (that's created on the first message sent by one member)
        var create_group_topic = `apps.observer.${appid}.groups.create`
        console.log("Publishing to topic:", create_group_topic);
        console.log(">>> NOW PUBLISHING... CREATE GROUP TOPIC", create_group_topic)
        const group_payload = JSON.stringify(group)
        this.publish(create_group_topic, Buffer.from(group_payload), function(err) {
            console.log("PUBLISHED 'CREATE GROUP' ON TOPIC", create_group_topic)
            callback(err)
        });
    }

    addMemberToGroupAndNotifyUpdate(user, joined_member_id, group_id, callback) {
        this.chatdb.getGroup(group_id, (err, group) => {
          console.log("group found?", group, "err", err)
          if (err || !group) {
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
            console.log("group members", group.members)
            console.log("group owner", group.owner)
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            console.log("im_owner:",im_owner)
            console.log("im_admin:",im_admin)
            if (im_admin || im_owner) {
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
              this.chatdb.joinGroup(group_id, joined_member_id, (err) => {
                if (err) {
                  console.log("An error occurred:", err)
                  const reply = {
                      success: false,
                      err: err.message() ? err.message() : "Error joining group",
                      http_status: 500
                  }
                  // res.status(500).send(reply)
                  if (callback) {
                    callback(reply, null)
                  }
                }
                else {
                  console.log("group updated with new joined member.")
                  this.notifyGroupUpdate(group, group.members, (err) => {
                    console.log("PUBLISHED 'UPDATE GROUP'")
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
                        console.log("GROUP IS", group)
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
        console.log("updating group " + JSON.stringify(group) + " to "+ update_group_topic);
        const data = {
          group: group,
          notify_to: users_to_be_notified //{...new_members, ...old_members }
        }
        console.log("payload:", data)
        const group_payload = JSON.stringify(data)
        this.publish(update_group_topic, Buffer.from(group_payload), (err) => {
          console.log("PUBLISHED 'UPDATE GROUP' ON TOPIC", update_group_topic)
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
        console.log("SENDING 'ADDED TO GROUP' TO EACH MEMBER INCLUDING THE JOINED ONE...", group)
        const appid = group.appId
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
            console.log("Member joined group message:", message)
            let inbox_of = member_id
            let convers_with = group.uid
            this.deliverMessage(appid, message, inbox_of, convers_with, (err) => {
                if (err) {
                    console.log("error delivering message to joined member", inbox_of)
                    callback(err)
                    return
                }
                else {
                    console.log("DELIVERED MESSAGE TO", inbox_of, "CONVERS_WITH", convers_with)
                }
            })
        }
        // 2. pubblish old group messages to the joined member (in the member/group-conversWith timeline)
        const userid = group.uid
        const convid = group.uid
        this.chatdb.lastMessages(appid, userid, convid, 1, 200, (err, messages) => {
            if (err) {
                console.log("Error", err)
                callback(err)
            }
            else if (!messages) {
                console.log("No messages in group", group.uid)
                callback(null)
            }
            else {
                console.log("delivering old group messages to:", joined_member_id)
                const inbox_of = joined_member_id
                const convers_with = group.uid
                messages.forEach(message => {
                    // TODO: CHECK IN MESSAGE WAS ALREADY DELIVERED. (CLIENT? SERVER?)
                    console.log("Message:", message.text)
                    this.deliverMessage(appid, message, inbox_of, convers_with, (err) => {
                        if (err) {
                            console.log("error delivering message to joined member", inbox_of)
                        }
                        else {
                            console.log("DELIVERED MESSAGE TO", inbox_of, "CONVERS_WITH", convers_with)
                        }
                    })
                });
                callback(null)
            }
        })
    }

    leaveGroup(user, removed_member_id, group_id, app_id, callback) {
        // get group by id
        this.chatdb.getGroup(group_id, (err, group) => {
            console.log("group found?", group, "err", err)
            if (err || !group) {
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
              console.log("group members", group.members)
              console.log("group owner", group.owner)
              const im_owner = (group.owner === user.uid)
              const im_admin = user.roles.admin
              const im_member = group.members[user.uid]
              const member_exists = group.members[removed_member_id]
              console.log("im_owner:",im_owner)
              console.log("im_admin:",im_admin)
              if ((im_admin || im_owner || im_member) && member_exists) {
                let old_members = {...group.members};
                delete group.members[removed_member_id]
                console.log("old_members:", old_members)
                console.log("new_members:", group.members)
                this.chatdb.saveOrUpdateGroup(group, (err) => {
                    if (err) {
                        console.log("An error occurred:", err)
                        const reply = {
                            success: false,
                            err: err.message() ? err.message() : "Error saving group"
                        }
                        callback(reply)
                        return
                    }
                    console.log("....saved group with no leaved member.", group)
                    console.log("... notify to old members",old_members, "the new group")
                    this.notifyGroupUpdate(group, old_members, (err) => { // TO OLD MEMBERS
                        if (err) {
                            if (callback) {
                                callback(err);
                            }
                            return
                        }
                        if (callback) {
                            callback(null);
                        }
                        // old_members.sendMessage("member_id leaved the group")
                        for (let [member_id, value] of Object.entries(old_members)) {
                            console.log("to member:", member_id)
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
                            console.log("Member left group message:", message)
                            let inbox_of = member_id
                            let convers_with = group.uid
                            this.deliverMessage(group.appId, message, inbox_of, convers_with, function(err) {
                                if (err) {
                                    console.log("error delivering message to member (about the left member)", inbox_of)
                                    callback(err)
                                    return
                                }
                                else {
                                    console.log("DELIVERED MESSAGE TO", inbox_of, "CONVERS_WITH", convers_with)
                                }
                            })
                        }
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
            console.log("PUBLISH: DELIVER MESSAGE TO TOPIC:", deliver_message_topic)
            if (err) {
                console.log("error delivering message to joined member on topic", deliver_message_topic)
                if (callback) {
                    callback(err)
                    return
                }
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
      console.log("outgoing_message:", outgoing_message)
      let dest_topic = `apps.${appid}.users.${sender}.messages.${recipient}.outgoing`
      const message_payload = JSON.stringify(outgoing_message)
      this.publish(dest_topic, Buffer.from(message_payload), function(err) {
        console.log("PUBLISHED: SENDING MESSAGE TO TOPIC:", dest_topic)
        if (err) {
          console.log("error sending message", err, "On topic", dest_topic)
          if (callback) {
            callback(err)
            return
          }
        }
        callback(null)
      });
    }

    setGroupMembers(user, new_members, group_id, callback) {
        this.chatdb.getGroup(group_id, (err, group) => {
            console.log("group found?", group, "err", err)
            if (err || !group) {
                callback({err: {message: "Not found"}})
                return
            }
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            if (!(im_admin || im_owner)) {
                callback({err: {message: "Unauthorized"}})
                return
            }
            // 2. updates members and update group
            const old_members = {...group.members} // save old members to notify group update LATER
            group.members = new_members;
            const now = Date.now()
            group.updatedOn = now;
            this.chatdb.saveOrUpdateGroup(group, (err) => {
                if (err) {
                    console.log("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    callback(reply)
                    return
                }
                console.log("....saved group with no member.", group)
                this.notifyGroupUpdate(group, old_members, (err) => { // TO OLD MEMBERS
                    if (err) {
                        callback(err);
                        return
                    }
                    callback(null);
                    // 4. join new members
                    for (let [member_id, value] of Object.entries(new_members)) {
                        console.log(">>>>> JOINING MEMBER", member_id)
                        this.joinGroup(member_id, group, function(reply) {
                            console.log("member", member_id, "invited on group", group_id, "result", reply)
                        })
                    }
                })
            })
        })
    }

    updateGroupData(user, group_name, group_id, callback) {
        this.chatdb.getGroup(group_id, (err, group) => {
            console.log("group found?", group, "err", err)
            if (err || !group) {
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
                    console.log("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    callback(reply)
                    return
                }
                console.log("....saved group with no member.", group)
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
            console.log("group found?", group, "err", err)
            if (err || !group) {
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
                    console.log("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    callback(reply)
                    return
                }
                console.log("....saved group with no member.", group)
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
        this.startMQ()
    }

    startMQ() {
        console.log("Connecting to RabbitMQ...")
        const that = this
        amqp.connect(process.env.RABBITMQ_URI, (err, conn) => {
            if (err) {
                console.error("[AMQP]", err.message);
                return setTimeout(() => { that.startMQ() }, 1000);
                // return setTimeout(that.startMQ, 1000);
            }
            conn.on("error", (err) => {
                if (err.message !== "Connection closing") {
                    console.error("[AMQP] conn error", err.message);
                }
            });
            conn.on("close", () => {
                console.error("[AMQP] reconnecting");
                return setTimeout(() => { that.startMQ() }, 1000);
                // return setTimeout(that.startMQ, 1000);
            });
            console.log("[AMQP] connected.");
            this.amqpConn = conn;
            that.whenConnected();
        });
    }
  
    whenConnected() {
        this.startPublisher();
    }
  
    startPublisher() {
        this.amqpConn.createConfirmChannel( (err, ch) => {
            if (this.closeOnErr(err)) return;
            ch.on("error", function (err) {
                console.error("[AMQP] channel error", err.message);
            });
            ch.on("close", function () {
                console.log("[AMQP] channel closed");
            });
            this.pubChannel = ch;
            if (this.offlinePubQueue.length > 0) {
                while (true) {
                    console.log("PERICOLOOOOOOOOOOOO")
                    var [exchange, routingKey, content] = this.offlinePubQueue.shift();
                    this.publish(routingKey, content);
                }
            }
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
                    callback(err)
                }
                else {
                    console.log("published to", routingKey, "result", ok)
                    callback(null)
                }
            });
        } catch (e) {
            console.error("[AMQP] publish", e.message);
            this.offlinePubQueue.push([this.exchange, routingKey, content]);
            callback(e)
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