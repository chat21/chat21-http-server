/*
    Andrea Sponziello - (c) Tiledesk.com
*/

/**
 * Chat21Push class
 */

const admin = require("firebase-admin");
const logger = require('../tiledesk-logger').logger;
const MessageConstants = require("../models/messageConstants");

if (process.env.PUSH_ENABLED == undefined || (process.env.PUSH_ENABLED && process.env.PUSH_ENABLED !== 'true')) {
    logger.log("PUSH NOTIFICATIONS: OFF");
}
else {
    logger.log("PUSH NOTIFICATIONS: ON");

    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {

        logger.log("project_id", process.env.FIREBASE_PROJECT_ID);

        let private_key = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
        // logger.log("private_key", private_key);
        // logger.log("client_email", process.env.FIREBASE_CLIENT_EMAIL);


        const serviceAccount = {
            "project_id": process.env.FIREBASE_PROJECT_ID,
            "private_key": private_key,
            "client_email": process.env.FIREBASE_CLIENT_EMAIL
        }
    
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        logger.log("after admin.apps.length:", admin.apps.length);
        // logger.log("admin.credential:", admin.app());
    }
    else {
        logger.log("PUSH NOTIFICATION CONFIG ERROR. Please set all these .env props: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL");
    }
}

class Chat21Push {
    
    /**
     * Constructor
     * @example
     * const { Chat21Push } = require('./sendpush/index.js');
     * const chatpush = new Chat21Push({database: db});
     * 
     */
    constructor(options) {
        if (!options.database) {
            throw new Error('database option can NOT be empty.');
        }
        this.chatdb = options.database
    }

    saveAppInstance(
        instance,
        callback) {
        this.chatdb.saveAppInstance(instance, (err) => {
            if (err) {
                logger.error("Error while saving instance:", err);
                callback(err);
            }
            else {
                callback(null);
            }
        });
    }

    sendNotification(app_id, message, sender_id, recipient_id) {
        logger.log("sending notification");
        logger.log("app_id:", app_id);
        logger.log("message:", message);
        logger.log("sender_id:", sender_id);
        logger.log("recipient_id:", recipient_id);

        logger.log("admin.credential:" + admin.credential)
        if (process.env.PUSH_ENABLED == undefined || (process.env.PUSH_ENABLED && process.env.PUSH_ENABLED === 'false')) {
            logger.log("PUSH NOTIFICATIONS DISABLED");
            return
        }
        else if (admin.apps.length == 0) {
            logger.log("PUSH NOTIFICATIONS ON, but Firebase admin app not configured!");
            return;
        }

        let forcenotification = false;
        if (message.attributes && message.attributes.forcenotification) {
            forcenotification = message.attributes.forcenotification;
            logger.log('forcenotification', forcenotification);
        }
        // if (message.status != MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
        //     logger.log('message.status != MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT');
        //     return 0;
        // }

        if (recipient_id == "system") { //disabled to check push notification for first message
            logger.log('do not send push notification if "system" is the sender');
            return 0;
        }

        if (sender_id == recipient_id) {
            logger.log('do not send push notification to the sender itself');
            return 0;
        }
        if (forcenotification == false) {
            if (message.sender == "system"){
                logger.log('do not send push notification for message with system as sender');
                return 0;
            }
        
            if (message.attributes && message.attributes.sendnotification == false) {
                logger.log('do not send push notification because sendnotification is false');
                return 0;
            }
        
            if (recipient_id == "general_group" ) {
                logger.log('dont send push notification for mute recipient');
                //if sender is receiver, don't send notification
                return 0;
            }
        } else {
            logger.log('forcenotification is enabled');
        }
        const text = message.text;

        logger.log('Getting allInstancesOf for recipient_id: '+recipient_id + ' app_id: '+ app_id);
        
        // const messageTimestamp = JSON.stringify(message.timestamp);
        this.chatdb.allInstancesOf(app_id, recipient_id, (err, instances) => {
            logger.log('instances ', instances);
            /*
            [
                {
                    _id: new ObjectId("61979dbacad78ce3fdea761c"),
                    instance_id: 'eIHQegUYdfGMWpgBBWQvPz:APA91bGZNT3kq31EhSpNr-_IZTUjNN3QyHgz40MjE_sNkl48eir5wkEihi4kIBWgCu7rZ3gXs62F3nCBCoVcSjvDbUKyn0-CGqRl2jWQAH7sQNUw0uTTdzOhOXOlZVNdKbCvM0VFRGkp',
                    app_id: 'tilechat',
                    device_model: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
                    language: 'it',
                    platform: 'ionic',
                    platform_version: '3.0.68',
                    user_id: '6d011n62ir097c0143cc42dc'
                },
                ...
            ]
            */
            // Check if there are any device tokens.
            if (!instances || (instances && instances.length == 0)) {
                logger.log('There are no notification instances for:', recipient_id);
                return
            }
            for (let i = 0; i < instances.length; i++) {
                const instance_id = instances[i].instance_id;
                logger.log("FCM instance_id:", instance_id)
                var instance = instances[i];
                const platform = instance.platform;
                var clickAction = "NEW_MESSAGE";
                if (process.env.WEB_CLICK_ACTION) {
                    clickAction = process.env.WEB_CLICK_ACTION
                }
                let mobileClickAction = "NEW_MESSAGE";
                if (process.env.MOBILE_CLICK_ACTION) {
                    mobileClickAction = process.env.MOBILE_CLICK_ACTION
                }
                var icon = "ic_notification_small";
                // if (platform=="ionic" || platform.indexOf("web/") >- 1){
                //     clickAction = webClickAction;
                //     icon = "/chat/assets/img/icon.png"
                // }
                const payload = {
                    notification: {
                        title: message.sender_fullname,
                        body: text
                        // sound: "default"
                        // icon: icon,
                        // click_action: clickAction,
                        // "content_available": "true",
                        // badge: "1"
                    },
                    data: {
                        recipient: message.recipient,
                        recipient_fullname: message.recipient_fullname,
                        sender: message.sender,
                        sender_fullname: message.sender_fullname,
                        channel_type: message.channel_type,
                        text: text,
                        timestamp: new Date().getTime().toString()
                    },
                    token: instance_id
                };
                if (platform=="ionic" || platform.indexOf("web/") >- 1) {
                    payload.webpush = {
                        fcmOptions: {
                            link: clickAction
                        },
                        headers: {
                            "Urgency": "high"
                        }        
                    }
                }
                else if (platform=="android") {
                    payload.android = {
                        priority: "normal",
                        notification: {
                          clickAction: mobileClickAction,
                          sound: "default"
                        }
                    }
                }
                else if (platform=="ios") {
                    payload.apns = {
                        headers: {
                            "apns-priority": "5"
                        },
                        payload: {
                            aps: {
                              'category': mobileClickAction,
                              sound: "default"
                            }
                        }
                    }
                }
                logger.log("Push payload:", JSON.stringify(payload));
                // admin.messaging().sendToDevice(instance_id, payload) // LEGACY
                // info here: https://firebase.google.com/docs/cloud-messaging/send-message
                admin.messaging().send(payload)
                .then((response) => {
                    logger.log("Push notification sent for message:", JSON.stringify(message));
                    logger.log("  Token (aka instance_id):", instance_id);
                    logger.log("  Platform:", platform);
                    logger.log("  Response:", JSON.stringify(response));
                    // response.results.forEach((result, index) => {
                    //     const error = result.error;
                    //     if (error) {
                    //         logger.error('Failure sending notification to', token, error);
                    //         if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
                    //             var tokenToRemove = path+'/'+token;
                    //             logger.error('Invalid regid. Removing it', token, ' from ',tokenToRemove,error);
                    //             // TODO
                    //             // admin.database().ref(tokenToRemove).remove().then(function () {
                    //             //     logger.log('tokenToRemove removed',tokenToRemove);
                    //             // });
                    //         }
                    //     }
                    //     return error;
                    // })
                })
                .catch((error) => {
                    logger.log('Error sending push notification:', error);
                    if (error.errorInfo && error.errorInfo.code &
                        (error.errorInfo.code === 'messaging/invalid-registration-token' ||
                        error.errorInfo.code === 'messaging/invalid-argument' ||
                        error.errorInfo.code === 'messaging/registration-token-not-registered') ) {
                        this.chatdb.deleteInstanceByInstanceId(instance_id, (err) => {
                            if (err) {
                                logger.error('Error while removing instance_id:', instance_id);    
                            }
                            else {
                                logger.log('Remove instance_id:', instance_id);
                            }
                        });
                    }
                });
            }
        });
    }

}

module.exports = { Chat21Push };
