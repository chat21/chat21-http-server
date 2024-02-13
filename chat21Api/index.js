/* 
    ver 0.1
    Andrea Sponziello - (c) Tiledesk.com
*/

/**
 * Chat21Api
 */

const logger = require('../tiledesk-logger').logger;

var amqp = require('amqplib/callback_api');
const { uuid } = require('uuidv4');
const { JsonWebTokenError } = require('jsonwebtoken');
const { Contacts } = require('../Contacts.js');

class Chat21Api {
    
    /**
     * Constructor
     * @example
     * const { Chat21Api } = require('chat21Api');
     * const chatapi = new Chat21Api({exchange: 'amq.topic', database: db, rabbitmq_uri: 'amqp://username:password@localhost:5672?heartbeat=60'});
     * 
     */
    constructor(options) {
        if (!options.exchange) {
            throw new Error('exchange option can NOT be empty.');
        }
        if (!options.database) {
            throw new Error('database option can NOT be empty.');
        }
        if (!options.rabbitmq_uri) {
            throw new Error('rabbitmq_uri option can NOT be empty.');
        }
        this.chatdb = options.database
        this.exchange = options.exchange
        this.pubChannel = null;
        this.offlinePubQueue = [];
        this.amqpConn = null;
        this.rabbitmq_uri = options.rabbitmq_uri;
        this.contacts = options.contacts;
    }

    archiveConversation(app_id, user_id, convers_with, callback) {
        // NOTE! THIS ARRIVES DIRECTLY ON THE CLIENT! REFACTOR WITH SOME "OBSERVER.APPS....ARCHIVE" TOPIC
        let dest_topic = `apps.${app_id}.users.${user_id}.conversations.${convers_with}.archive`
        logger.debug("archive dest_topic: " + dest_topic)
        let patch = {
            action: 'archive'
        }
        const payload = JSON.stringify(patch)
        this.publish(dest_topic, Buffer.from(payload), function (err) {
            if (callback) {
                callback(err)
            }
        });
    }

    /** removes all conversations with this ConversWith. Used when a group is removed and you want to
     * remove all the old conversations belonging to this group, on all users timelines
     */
    removeAllConversWithConversations(app_id, convers_with, callback) {
        logger.error("removeAllConversWithConversations()");
        this.chatdb.deleteConversationsByConversWith(app_id, convers_with, function (err, doc) {
            if (err) {
                logger.error("Error deleting conversatios:", err);
                callback(err);
                return
            }
            else {
                callback(null);
            }
        });
    }

    // createGroup(group, callback) {
    //     // 1. create group json
    //     // 2. save group json in mongodb
    //     // 3. publish to /observer
    //     // 4. observer publishes JSON to all members (task on the observer)
    //     // 5. observer (virtually) creates group 'timelineOf' messages (that's created on the first message sent by one member)
    //     this.saveOrUpdateGroup(group, (err) => { // 2. save group json in mongodb
    //         if (err) {
    //             logger.error("Error while saving 'create group':", err);
    //             callback(err);
    //         }
    //         else {
    //             var create_group_topic = `apps.observer.${group.appId}.groups.create`
    //             logger.debug("Publishing to topic: " + create_group_topic);
    //             logger.debug(">>> NOW PUBLISHING... CREATE GROUP TOPIC: " + create_group_topic)
    //             const group_payload = JSON.stringify(group)
    //             this.publish(create_group_topic, Buffer.from(group_payload), function(err) { // 3. publish to /observer
    //                 if (err) {
    //                     logger.error("Error while publishing 'create group':", err);
    //                     callback(err);
    //                 }
    //                 else {
    //                     logger.debug("PUBLISHED 'CREATE GROUP' ON TOPIC: " + create_group_topic);
    //                     callback(null);
    //                 }
    //             });
    //         }
    //     })
    // }

    createGroup(group, callback) {
        // 1. create group json
        // 2. save group json in mongodb
        this.saveOrUpdateGroup(group, (err) => { // 2. save group json in mongodb
            if (err) {
                logger.error("Error while saving 'create group':", err);
                callback(err);
            }
            else {
                // NOTE: DISABLED GROUP-ADDED NOTIFICATION!
                // this.deliverGroupAdded(group, (err) => {
                //     if (err) {
                //         logger.error('An error occurred during group creation, saving group data')
                //         callback(err);
                //     }
                //     else {
                this.sendGroupWelcomeMessage(group, async (err) => {
                    if (err) {
                        logger.error('An error occurred during group creation, sendGroupWelcomeMessage To Initial Members', err)
                        callback(err);
                    }
                    else {
                        // console.log("SENDING 'MEMBER_JOINED_GROUP' FOR EACH MEMBER TO EACH MEMBER...", group);
                        const appid = group.appId
                        for (let [member_id, value] of Object.entries(group.members)) {
                            // console.log("Sending: '" + member_id + " added to group on creation', to the group: " + group.uid);
                            const joined_member = await this.getContact(member_id);
                            const message = {
                                type: "text",
                                text: joined_member.fullname + " joined group on creation",
                                timestamp: Date.now(),
                                channel_type: "group",
                                sender_fullname: "System",
                                sender: "system",
                                recipient_fullname: group.name,
                                recipient: group.uid,
                                attributes: {
                                    subtype: "info",
                                    updateconversation: true,
                                    messagelabel: {
                                        key: "MEMBER_JOINED_GROUP",
                                        parameters: {
                                            member_id: member_id,
                                            fullname: joined_member.fullname,
                                            firstname: joined_member.firstname,
                                            lastname: joined_member.lastname
                                        }
                                    }
                                }
                            }
                            // console.log("Member joined group message:", JSON.stringify(message))
                            this.sendMessageRaw(
                                appid,
                                message,
                                (err) => {
                                    if (err) {
                                        logger.error("Error delivering message to members for 'added to group on creation'", message);
                                        return
                                    }
                                    else {
                                        // console.log("SENT MESSAGE TO: " + group.uid)
                                    }
                                }
                            );
                        }
                        callback(null);
                    }
                });
                //     }
                // });
            }
        });
    }

    deliverGroupAdded(group, callback) {
        const app_id = group.appId
        logger.debug("group IS", group)
        logger.debug("APP_ID IS", app_id)
        for (let [key, value] of Object.entries(group.members)) {
            const member_id = key
            const added_group_topic = `apps.${app_id}.users.${member_id}.groups.${group.uid}.clientadded`
            logger.debug("added_group_topic:", added_group_topic)
            const payload = JSON.stringify(group)
            this.publish(added_group_topic, Buffer.from(payload), function (err, msg) {
                if (err) {
                    logger.error("error publish deliverGroupAdded", err);
                    if (callback) {
                        callback(err);
                    }
                }
                else {
                    if (callback) {
                        callback(null);
                    }
                }
            })
        }
    }

    sendGroupWelcomeMessage(group, callback) {
        // for (let [key, value] of Object.entries(group.members)) {
        const app_id = group.appId;
        var group_created_message = {
            // message_id: uuid(),
            type: "text",
            text: "Group created",
            timestamp: Date.now(),
            channel_type: "group",
            sender_fullname: "System",
            sender: "system",
            recipient_fullname: group.name,
            recipient: group.uid,
            // status: MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
            attributes: {
                subtype: "info",
                updateconversation: true,
                messagelabel: {
                    key: "GROUP_CREATED",
                    parameters:
                    {
                        creator: group.owner
                    }
                }
            }
        }
        this.sendMessageRaw(
            app_id,
            group_created_message,
            (err) => {
                if (err) {
                    logger.error("Error delivering message:", group_created_message)
                    if (callback) {
                        callback(err)
                    }
                }
                else {
                    logger.debug("MESSAGE 'GROUP_CREATED' SENT TO: " + group.uid)
                    if (callback) {
                        callback(null)
                    }
                }
            }
        );
        // }
    }

    saveOrUpdateGroup(group, callback) {
        this.chatdb.saveOrUpdateGroup(group, function (err, doc) {
            if (err) {
                logger.error("Error saving group:", err);
                callback(err);
                return
            }
            else {
                callback(null);
            }
        })
    }

    async addMemberToGroupAndNotifyUpdate(user, joined_member_id, group_id, callback) {
        logger.debug("addMemberToGroupAndNotifyUpdate()");
        const joined_member = await this.getContact(joined_member_id);
        this.chatdb.getGroup(group_id, (err, group) => {
            logger.debug("found group", group)
            if (err || !group) {
                logger.error("group found? with err", err)
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
                logger.debug("actual group members", group.members)
                logger.debug("actual group owner", group.owner)
                logger.debug("group.appId", group.appId);
                const im_owner = (group.owner === user.uid)
                const im_admin = user.roles.admin
                logger.debug("im_owner: " + im_owner)
                logger.debug("im_admin: " + im_admin)
                if (im_admin || im_owner) {
                    logger.debug("adding member", joined_member_id)
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
                    // else
                    group.members[joined_member_id] = 1
                    logger.debug("new members:", group.members)
                    this.chatdb.joinGroup(group_id, joined_member_id, (err) => {
                        logger.log("Member", joined_member_id, "joined group");
                        if (err) {
                            logger.error("An error occurred:", err)
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
                            let message_label = {
                                key: "MEMBER_JOINED_GROUP",
                                parameters: {
                                    member_id: joined_member_id,
                                    fullname: joined_member.fullname,
                                    firstname: joined_member.firstname,
                                    lastname: joined_member.lastname
                                }
                            }
                            let notification = {
                                messagelabel: message_label
                            }


                            // logger.log("qiooooooo4444444452222333333")
                            // let message = {
                            //     type: "text",
                            //     text: joined_member_id + " added to group",
                            //     timestamp: Date.now(),
                            //     channel_type: "group",
                            //     sender_fullname: "System",
                            //     sender: "system",
                            //     recipient_fullname: group.name,
                            //     recipient: group.uid,
                            //     attributes: {
                            //         subtype: "info",
                            //         updateconversation: true,
                            //         messagelabel: message_label
                            //     }
                            // }
                            // logger.log("qiooooooo55555")
                            // logger.log("Member joined group message:", message);
                            // this.sendMessageRaw(
                            //     group.appId,
                            //     message,
                            //     (err) => {
                            //         if (err) {
                            //             logger.error("Error delivering message (addMemberToGroupAndNotifyUpdate), message:", message);
                            //             logger.error("Error delivering message (addMemberToGroupAndNotifyUpdate), error:", err);
                            //             return;
                            //         }
                            //         else {
                            //             logger.log("SENT MESSAGE TO: " + group.uid)
                            //         }
                            //     }
                            // );


                            logger.debug("group updated with new joined member.")
                            this.notifyGroupUpdate(group, group.members, notification, (err) => {
                                logger.log("PUBLISHED 'UPDATE GROUP'")
                                if (err) {
                                    if (callback) {
                                        callback(
                                            {
                                                "success": false,
                                                "err": err,
                                                http_status: 500
                                            },
                                            null
                                        )
                                        return
                                    }
                                }
                                else {
                                    if (callback) {
                                        callback(
                                            null,
                                            group
                                        )
                                        logger.log("GROUP IS", group)
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
    notifyGroupUpdate(group, users_to_be_notified, notification, callback) {
        var update_group_topic = `apps.observer.${group.appId}.groups.update`
        logger.debug("updating group to " + update_group_topic);
        if (notification) {
            group.notification = notification;
        }
        const data = {
            group: group,
            notify_to: users_to_be_notified //{...new_members, ...old_members }
        }
        const group_payload = JSON.stringify(data)
        logger.debug("payload:", group_payload)
        this.publish(update_group_topic, Buffer.from(group_payload), (err) => {
            logger.debug("PUBLISHED 'UPDATE GROUP' ON TOPIC: " + update_group_topic)
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
    joinGroupMessages(joined_member_id, group, message_label, callback) {
        logger.log("JOINED NAME:", joined_member_id)
        logger.debug("'system' sends 'added to group' to (group:" + group.uid + ") - members: " + JSON.stringify(group.members))
        const appid = group.appId
        const now = Date.now()

        let joined_name = joined_member_id;
        if (message_label && message_label.parameters && message_label.parameters.firstname) {
            joined_name = message_label.parameters.firstname;
        }

        const message = {
            // message_id: uuid(),
            type: "text",
            text: joined_name + " added to group",
            timestamp: now,
            channel_type: "group",
            sender_fullname: "System",
            sender: "system",
            recipient_fullname: group.name,
            recipient: group.uid,
            //status: 100, // MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
            attributes: {
                subtype: "info",
                updateconversation: true,
                messagelabel: message_label
            }
        }
        logger.debug("'system' sends 'added to group' message:" + JSON.stringify(message))
        this.sendMessageRaw(
            appid,
            message,
            (err) => {
                if (err) {
                    logger.error("Error delivering message to joined member", err);
                    if (callback) {
                        callback(err)
                    }
                    return
                }
                else {
                    logger.debug("Sent 'member joined group' message:",message, "to: " + group.uid);
                    if (callback) {
                        callback(null);
                    }
                }
            }
        );
        // 2. pubblish old group messages to the joined member (in the member/group-conversWith timeline)
        const group_id = group.uid;
        logger.debug("last messages for appid, userid, convid", appid, group_id, group_id);
        this.chatdb.lastMessages(appid, group_id, group_id, 1, 200, (err, messages) => {
            logger.debug("lastMessages:", messages);
            logger.debug("lastMessages stringify:", JSON.stringify(messages));
            if (err) {
                logger.error("lastMessages Error", err)
                // if (callback) {
                //     callback(err)
                // }
            }
            else if (!messages) {
                logger.debug("No messages in group: " + group_id)
                // if (callback) {
                //     callback(null)
                // }
            }
            else {
                logger.debug("delivering group messages history to: " + joined_member_id)
                const inbox_of = joined_member_id
                const convers_with_group = group_id
                messages.forEach(message => {
                    // TODO: CHECK IF MESSAGE WAS ALREADY DELIVERED. (CLIENT? SERVER?)
                    message["__history"] = "true"
                    message.status = 150; // DELIVERED
                    logger.debug("Delivering message: " + message.text)

                    // logger.debug("message",  message);


                    if (!message.attributes) {
                        // logger.debug("creating empty attributes for message " + message.text);
                        message.attributes = {};
                    }

                    if (message.attributes.forcenotification != true) { 
                        message.attributes.sendnotification = false;
                        // logger.debug("setting message.attributes.sendnotification = false for message with text" + message.text);
                    }

                    // problema se messaggio non ha attributers... devi crearlo
                    this.deliverMessage(appid, message, inbox_of, convers_with_group, (err) => {
                        if (err) {
                            logger.error("error delivering message to joined member", inbox_of)
                            // if (callback) {
                            //     callback(err)
                            // }
                            return;
                        }
                        else {
                            // QUI NON ARRIVA IN LOCALE????
                            logger.debug("DELIVERED MESSAGE TO: " + inbox_of + " __CONVERS_WITH__ " + convers_with_group)
                        }
                    });
                });
                // if (callback) {
                //     callback(null);
                // }
            }
        })
    }

    leaveGroup(user, removed_member_id, group_id, app_id, callback) {
        // get group by id
        logger.debug("member: " + removed_member_id + " will leave group: " + group_id)
        this.chatdb.getGroup(group_id, (err, group) => {
            if (err || !group) {
                logger.error("group found? with err", err)
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
                logger.debug("group found.");
                logger.debug("actual group members: " + JSON.stringify(group.members))
                logger.debug("group owner: " + JSON.stringify(group.owner))
                const im_owner = (group.owner === user.uid)
                const im_admin = user.roles.admin
                const im_member = group.members[user.uid]
                const member_exists = group.members[removed_member_id]
                logger.debug("im_owner: " + im_owner)
                logger.debug("im_admin: " + im_admin)
                if ((im_admin || im_owner || im_member) && member_exists) {
                    let old_members = { ...group.members };
                    delete group.members[removed_member_id]
                    logger.debug("old members: " + JSON.stringify(old_members))
                    logger.debug("new members: " + JSON.stringify(group.members))
                    this.chatdb.saveOrUpdateGroup(group, (err) => {
                        if (err) {
                            logger.error("An error occurred:", err)
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
                        logger.debug("....saved group with leaved member. " + JSON.stringify(group))
                        logger.debug("... notify to old members " + old_members + " the new group")
                        let message_label = {
                            key: "MEMBER_LEFT_GROUP",
                            parameters: {
                                member_id: removed_member_id
                                // fullname: fullname // OPTIONAL
                            }
                        };
                        let notification = {
                            messagelabel: message_label
                        }
                        this.notifyGroupUpdate(group, old_members, notification, (err) => { // TO OLD MEMBERS
                            if (err) {
                                const reply = {
                                    success: false,
                                    err: err,
                                    message: "Error notitfying group update"
                                }
                                if (callback) {
                                    callback(reply);
                                }
                                return;
                            }
                            // "system" sends message "removed from group" to all group members
                            const now = Date.now();
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
                                    subtype: "info",
                                    updateconversation: true,
                                    messagelabel: message_label
                                }
                            }
                            this.sendMessageRaw(
                                app_id,
                                message,
                                (err) => {
                                    if (err) {
                                        logger.error("Error delivering message to members for 'leave group'", inbox_of)
                                        if (callback) {
                                            callback(err)
                                        }
                                        return;
                                    }
                                    else {
                                        logger.debug("SENT MESSAGE TO: " + group.uid)
                                        callback(null);
                                    }
                                }
                            );
                            // for (let [member_id, value] of Object.entries(old_members)) {
                            //     logger.debug("to member: " + member_id)
                            //     const now = Date.now()
                            // const message = {
                            //     message_id: uuid(),
                            //     type: "text",
                            //     text: removed_member_id + " removed from group",
                            //     timestamp: now,
                            //     channel_type: "group",
                            //     sender_fullname: "System",
                            //     sender: "system",
                            //     recipient_fullname: group.name,
                            //     recipient: group.uid,
                            //     status: 100, // MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT,
                            //     attributes: {
                            //         subtype:"info",
                            //         updateconversation : true,
                            //         messagelabel: {
                            //             key: "MEMBER_LEFT_GROUP",
                            //             parameters: {
                            //                 member_id: removed_member_id
                            //                 // fullname: fullname // OPTIONAL
                            //             }
                            //         }
                            //     }
                            // }
                            //     logger.debug("Member left group message: " + JSON.stringify(message))
                            //     let inbox_of = member_id
                            //     let convers_with = group.uid
                            //     this.deliverMessage(group.appId, message, inbox_of, convers_with, function(err) {
                            //         if (err) {
                            //             logger.error("error delivering message to members (about the member who left)", inbox_of)
                            //             if (callback) {
                            //                 callback(err)
                            //             }
                            //             return
                            //         }
                            //         else {
                            //             logger.debug("DELIVERED MESSAGE TO: " + inbox_of + " CONVERS_WITH " + convers_with)
                            //         }
                            //     })
                            // }
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
        this.publish(deliver_message_topic, Buffer.from(message_payload), function (err) {
            logger.debug("PUBLISH: DELIVER MESSAGE TO TOPIC: " + deliver_message_topic)
            if (err) {
                logger.error("error delivering message to joined member on topic", deliver_message_topic)
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
            channel_type: channel_type ? channel_type : "direct",
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
        logger.debug("outgoing_message: " + JSON.stringify(outgoing_message))
        let dest_topic = `apps.${appid}.outgoing.users.${sender}.messages.${recipient}.outgoing`
        const message_payload = JSON.stringify(outgoing_message)
        this.publish(dest_topic, Buffer.from(message_payload), function (err) {
            logger.debug("PUBLISHED: SENDING MESSAGE TO TOPIC: " + dest_topic)
            if (err) {
                logger.error("error sending message On topic: " + dest_topic, err)
                if (callback) {
                    callback(err)
                    return
                }
            }
            logger.verbose("Message Sent to queue: " + JSON.stringify(outgoing_message) + " to " + dest_topic);
            if (callback) {
                callback(null);
            }
        });
    }

    sendMessageRaw(
        appid, // mandatory
        outgoing_message, // mandatory
        callback // optional | null
    ) {
        if (!appid) {
            callback({ message: "appid can't be null" });
            return
        }

        if (!outgoing_message.sender) {
            callback({ message: "sender is mandatory" });
            return
        }
        if (!outgoing_message.recipient) {
            callback({ message: "recipient is mandatory" });
            return
        }
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
        logger.debug("outgoing_message (sendMessageRaw): " + JSON.stringify(outgoing_message))
        let dest_topic = `apps.${appid}.outgoing.users.${outgoing_message.sender}.messages.${outgoing_message.recipient}.outgoing`
        logger.debug("dest_topic (sendMessageRaw): " + dest_topic)
        const message_payload = JSON.stringify(outgoing_message)
        this.publish(dest_topic, Buffer.from(message_payload), (err) => {
            logger.debug("PUBLISHED: SENDING RAW MESSAGE TO TOPIC: " + dest_topic)
            if (err) {
                logger.error("Error sending raw message on topic: " + dest_topic, err)
                if (callback) {
                    callback(err)
                }
            }
            else {
                logger.debug("Message sent to queue: " + JSON.stringify(outgoing_message) + " to " + dest_topic);
                if (callback) {
                    callback(null);
                }
            }
        });
    }

    setGroupMembers(user, new_members, group_id, callback) {
        logger.log("setGroupMembers user:", user, " members:", new_members, " group_id:", group_id)
        this.chatdb.getGroup(group_id, (err, group) => {
            logger.log("Got group:", group)
            if (err || !group) {
                logger.error("group found? with err", err)
                callback({ err: { message: "Not found" } })
                return
            }
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            if (!(im_admin || im_owner)) {
                callback({ err: { message: "Unauthorized" } })
                return
            }
            // 2. update members and update group
            const original_members = { ...group.members } // save old members to notify group update LATER
            group.members = new_members;

            let added_members = {}
            for (const [key, value] of Object.entries(new_members)) {
                logger.log(`${key}: ${value}`);
                if (original_members[key]) {
                    logger.log("member alredy present", key)
                }
                else {
                    added_members[key] = 1
                }
            }
            logger.log("added_members:", added_members);
            if (Object.keys(added_members).length == 0) {
                logger.debug("Same members in group, skipping setGroupMembers()");
                if (callback) {
                    callback({ err: { message: "Same members in group, skipping setGroupMembers()" } })
                }
                return
            }

            const now = Date.now()
            group.updatedOn = now;
            this.chatdb.saveOrUpdateGroup(group, (err) => {
                if (err) {
                    logger.error("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    if (callback) {
                        callback(reply)
                    }
                    return
                }
                // // FOR EACH OLD MEMBER NOTIFY: FOR EACH NEW MEMBER NOTIFY "NEW MEMBER ADDED TO GROUP", OLD
                // let message_label = {
                //     key: "MEMBER_JOINED_GROUP",
                //     parameters: {
                //         member_id: joined_member_id
                //         // fullname: fullname // OPTIONAL
                //     }
                // };
                // let notification = {
                //     messagelabel: message_label
                // };
                this.notifyGroupUpdate(group, original_members, null, async (err) => { // TO ORIGINAL MEMBERS
                    if (err) {
                        logger.error("notifyGroupUpdate Error", err);
                        if (callback) {
                            callback(err);
                        }
                        return
                    }
                    callback(null);
                    // 4. join added members
                    logger.log("*****added members", added_members)
                    for (let [member_id, value] of Object.entries(added_members)) {
                        logger.debug(">>>>> JOINING MEMBER: " + member_id)
                        const joined_member = await this.getContact(member_id);
                        const messagelabel = {
                            key: "MEMBER_JOINED_GROUP",
                            parameters: {
                                member_id: member_id,
                                fullname: joined_member.fullname,
                                firstname: joined_member.firstname,
                                lastname: joined_member.lastname
                            }
                        }
                        this.joinGroupMessages(member_id, group, messagelabel, function (reply) {
                            logger.debug("member " + member_id + " invited on group " + group_id + " result " + reply)
                        })
                    }
                })
            })
        })
    }

    updateGroupData(user, group_name, group_id, callback) {
        this.chatdb.getGroup(group_id, (err, group) => {
            if (err || !group) {
                logger.error("group found? with err", err)
                callback({ err: { message: "Not found" } })
                return
            }
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            if (!(im_admin || im_owner)) {
                callback({ err: { message: "Unauthorized" } })
                return
            }
            // 2. update group
            group.name = group_name;
            const now = Date.now();
            group.updatedOn = now;
            this.chatdb.saveOrUpdateGroup(group, (err) => {
                if (err) {
                    logger.error("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    callback(reply)
                    return
                }
                logger.debug("....saved group with no member: " + JSON.stringify(group))
                let notification = {
                    messagelabel: {
                        key: "DATA_UPDATED_GROUP",
                        parameters: {
                            group_name: group_name
                        }
                    }
                }
                this.notifyGroupUpdate(group, group.members, notification, (err) => {
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
                logger.error("group found? with err", err)
                callback({ err: { message: "Not found" } })
                return
            }
            const im_owner = (group.owner === user.uid)
            const im_admin = user.roles.admin
            if (!(im_admin || im_owner)) {
                callback({ err: { message: "Unauthorized" } })
                return
            }
            // 2. update group
            group.attributes = group_attributes;
            const now = Date.now();
            group.updatedOn = now;
            this.chatdb.saveOrUpdateGroup(group, (err) => {
                if (err) {
                    logger.error("An error occurred:", err)
                    const reply = {
                        success: false,
                        err: err.message() ? err.message() : "Error saving group"
                    }
                    callback(reply)
                    return
                }
                // logger.debug("....saved group with no member.", group)
                let notification = {
                    messagelabel: {
                        key: "ATTRIBUTES_UPDATED_GROUP",
                        parameters: {
                            attributes: group_attributes
                        }
                    }
                }
                this.notifyGroupUpdate(group, group.members, notification, (err) => {
                    if (err) {
                        callback(err);
                        return
                    }
                    callback(null);
                })
            })
        })
    }

    // async getContact(joined_member_id) {
    //     logger.debug('getting joned member name by joined_member_id:', joined_member_id);
    //     const contacts = new Contacts({
    //       CONTACTS_LOOKUP_ENDPOINT: process.env.CONTACTS_LOOKUP_ENDPOINT,
    //       tdcache: tdcache,
    //       log: true
    //     });
    //     const joined_member_name = await this.contacts.getContact(joined_member_id);
    //     logger.debug('joined member name:', joined_member_name);
    // }

    async getContact(joined_member_id) {
        logger.debug('getting joned member name by joined_member_id:', joined_member_id);
        let joined_member = await this.contacts.getContact(joined_member_id);
        logger.debug('joined member:', JSON.stringify(joined_member));
        if (!joined_member) {
            joined_member = {
                firstname: "",
                lastname: "",
                fullname: joined_member_id,
            }
        }
        joined_member.fullname = Contacts.getFullnameOf(joined_member);
        return joined_member;
    }

// ****************************************************************
// **************** AMQP COMMUNICATION MANAGEMENT *****************
// ****************************************************************

    start() {
        const that = this;
        return new Promise(function (resolve, reject) {
            return that.startMQ(resolve, reject)
        });
    }

    startMQ(resolve, reject) {
        const that = this;
        var autoRestart = process.env.AUTO_RESTART;

        if (autoRestart === undefined || autoRestart === "true" || autoRestart === true) {
            autoRestart = true;
        } else {
            autoRestart = false;
        }
        logger.info("autoRestart: " + autoRestart);


        // logger.info("Connecting to RabbitMQ: " + process.env.RABBITMQ_URI)
        //amqp.connect(process.env.RABBITMQ_URI, (err, conn) => {
        amqp.connect(this.rabbitmq_uri, (err, conn) => {
            if (err) {
                logger.error("[AMQP]", err);
                if (autoRestart) {
                    logger.error("[AMQP] reconnecting");
                    return setTimeout(() => { that.startMQ(resolve, reject) }, 1000);
                } else {
                    process.exit(1);
                }
            }
            conn.on("error", (err) => {
                if (err.message !== "Connection closing") {
                    logger.error("[AMQP] conn error:", err);
                    return reject(err);
                }
            });
            conn.on("close", () => {
                logger.error("[AMQP] close");
                if (autoRestart) {
                    logger.error("[AMQP] reconnecting");
                    return setTimeout(() => { that.startMQ(resolve, reject) }, 1000);
                } else {
                    process.exit(1);
                }

            });
            // logger.debug("[AMQP] connected.", conn);
            that.amqpConn = conn;
            that.whenConnected().then(function (ch) {
                return resolve({ conn: conn, ch: ch });
            });


        });

    }

    whenConnected() {
        // logger.debug("whenConnected")
        return this.startPublisher();
    }

    startPublisher() {
        var that = this;
        return new Promise(function (resolve, reject) {
            that.amqpConn.createConfirmChannel((err, ch) => {
                if (that.closeOnErr(err)) return;
                ch.on("error", function (err) {
                    logger.error("[AMQP] channel error", err);
                });
                ch.on("close", function () {
                    logger.error("[AMQP] channel closed");
                });
                that.pubChannel = ch;
                // logger.debug("this.offlinePubQueue.length",that.offlinePubQueue.length)
                if (that.offlinePubQueue.length > 0) {

                    while (true) {
                        var m = that.offlinePubQueue.shift();
                        if (!m) break;
                        this.publish(m[0], m[1], m[2]);
                      }

                    // while (true) {
                    //     logger.debug("PERICOLOOOOOOOOOOOO", that.offlinePubQueue)
                    //     var [exchange, routingKey, content] = that.offlinePubQueue.shift();
                    //     // if (!content) break;
                    //     that.publish(routingKey, content);
                    // }
                }
                return resolve(ch)
            });
        });
    }

    publish(routingKey, content, callback) {
        if (!this.pubChannel) {
            logger.log("AMQP disabled. Can't publish.");
            if (callback) {
                callback(null);
            }
            return;
        }
        try {
            this.pubChannel.publish(this.exchange, routingKey, content, { persistent: false },
                (err, ok) => {
                    logger.log("published to.", routingKey);
                    if (err) {
                        logger.error("[AMQP] publish error:", err);
                        this.offlinePubQueue.push([this.exchange, routingKey, content]);
                        this.pubChannel.connection.close();
                        if (callback) {
                            callback(err)
                        }
                    }
                    else {
                        logger.debug("published to: " + routingKey + " result " + ok);
                        if (callback) {
                            callback(null)
                        }
                    }
                });
        }
        catch (err) {
            logger.error("[AMQP] publish error.", err);
            this.offlinePubQueue.push([this.exchange, routingKey, content]);
            if (callback) {
                callback(err)
            }
        }
    }

    closeOnErr(err) {
        if (!err) return false;
        logger.error("[AMQP] error", err);
        this.amqpConn.close();
        return true;
    }
}

module.exports = { Chat21Api };
