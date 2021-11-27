var admin = require("firebase-admin");
var MessageConstants = require("../models/messageConstants");

var serviceAccount = {
    "project_id": process.env.FIREBASE_PROJECT_ID,
    // "private_key_id": process.env.,
    "private_key": process.env.FIREBASE_PRIVATE_KEY,
    "client_email": process.env.FIREBASE_CLIENT_EMAIL
    // "client_id": process.env.firebase_client_id,
    // "auth_uri": process.env.firebase_auth_uri,
    // "token_uri": process.env.firebase_token_uri,
    // "auth_provider_x509_cert_url": process.env.firebase_auth_provider_x509_cert_url,
    // "client_x509_cert_url": process.env.firebase_client_x509_cert_url
}

// let serviceAccount = {
//     "type": "service_account",
//     "project_id": "chat21-mqtt-push",
//     "private_key_id": "83690e5f5a9b7ba5ab736bf3cedb325df77cf8b3",
//     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDwoo8Ik7AtPUtd\nXP+B1I4v9xQwTqiSG1SFIWuL9os5JYbUtmeqAhzdmZiPppBGDJ3Nzlwb7ZWUFU3M\n8AFDNj+r+renlyCC9QznFqI78fS3d8BGwRVyzBLJM0dyhg9vDDeFsEj7Nw0gmvge\n/ngnPbAB9ygEqv6QSlc2GJETFDanSK5ylEfRk3dEtLfFfo94zhJgjgXsS8mcBMqD\neKmuHdjhQqIwWw5pDgCnBcBB3HgcIbkC8N+2TmhnCTc6BJ3CqaWBI9eK6sCANC5D\nAPtrhgVbH4rHssIg2lvO+gav5S0I8YrASJMCIk+W0Wq3FjAgV0Yx8fGKB9bM0UpG\nbSesmGE7AgMBAAECggEACzuf+D6riSEXN2Zc9VGOpaEfwpD024UqzHJxE8cZgPNG\nOG3D8VdIw6tt/wM/nt6ieOOxm5y2mYN5E0T/J84xMv4nl7kGcDaLXTfvHohjWaEm\nuMI+XxJ+PpOYXl4VsqPJyN0f8eIotknuycS+XkVufKIk0xZjNbuuF2GoxSw60FNW\nWCOLveF0rrvMNB4b9Fzz+grke/YALDQ9bWHuuyxghLNfqK8mjdF07wUQT2u+/8xY\nnx3Vv8pjpon3I54AQBjYd8Rx6TFA550ibYibnOY5G1rTIUWbjq9XF2RgvPxwOxGS\n54EKI6IupP+i7fA2tBz07bodOiw1ThPjEmO/ZzOzwQKBgQD//KU6yr5L6eirfCi0\nUiYQBs0YbUWPfwAUuuxgBVppeL7hVgFMquT/SgxBTOGEEGQv5YQBJBBqIjy0XQKN\nkaiaY6LGE7PHOscL6fsmywbs0bKAS1VXCB1dI/uP2hpGUg7B2uqfeqK5vvXL48Vi\nr1maqvCY+NL55wGy8AG6/ubFYQKBgQDwpbZNWkTJaOMEcIsCsSRUJ2CgzFDSfSTN\nXWVd/xmOLxVlx9yEKD2+JwZ8iZpEpML2rDRQLge4Tn1y6llmaL0YmJ2/3ExHrZ28\nkr8uQ+OF25fYKY5TUa9TbxaBVhtGfDT47vufJdRLL5EIMJgzA1nkux9FcLnr4Ff9\nC4R8ahuQGwKBgAZF5K6qJTurAb6iDkVM9g3SfNgqZVf83r2jTwOTXgHTqanP97wv\nO+ldoStAfQ5FcI8T6sY0YgqXyDELTnK1rRILewOrm+437ITIORVcSFEpWlx2fCLj\n2gRcS1/dEmPCwwXRHYrG8JHoshFLBZ1Desilg7vb7R+en5YI96HjeThBAoGAR2Hg\nYbGVFel27ao0kefZztyfXRM+JjHY6NH7b5ZsDjEJN9fBIbKOHgmVcvueNx5odqM+\nIUqGH7WooJ3DRw1qihE7Od4vAlQNphIhg6e/pcUtlYE+JpjkWOtq0ZKpJI9TZ0P8\nf4jJIERL0RIZE4i68Y5QCFkXzVAOyZDRC9attmECgYBObPzroBviQ+mXUapSGH/A\n+12syUTOLQcmMBT2CSp8CYAnk4yA5Rd1SXobz9QZrmGVR7caWMQjX8mvpjgS+4Uj\npi0SyizTutXISLyLCLtUENP1u2otvj+YKL4b3QP7/NY405i2x8tFWOE7DQ3hDooq\nxrwfeRW6R4NqgOzDBz8gjA==\n-----END PRIVATE KEY-----\n",
//     "client_email": "firebase-adminsdk-2zopd@chat21-mqtt-push.iam.gserviceaccount.com",
//     "client_id": "106987821009523266084",
//     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
//     "token_uri": "https://oauth2.googleapis.com/token",
//     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
//     "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-2zopd%40chat21-mqtt-push.iam.gserviceaccount.com"
//   }

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

/* 
    ver 0.1
    Andrea Sponziello - (c) Tiledesk.com
*/

/**
 * Chat21Api for NodeJS
 */
// const winston = require("../winston");
const logger = require('../tiledesk-logger').logger;
var MessageConstants = require("../models/messageConstants");

var amqp = require('amqplib/callback_api');
const { uuid } = require('uuidv4');
const { JsonWebTokenError } = require('jsonwebtoken');

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
        // = db.ref('/apps/{app_id}/users/{sender_id}/messages/{recipient_id}/{message_id}').onCreate((data, context) => {
        // const message_id = context.params.message_id;
        // const sender_id = context.params.sender_id; 
        // const recipient_id = context.params.recipient_id;
        // const app_id = context.params.app_id;
        // const message = data.val();

        let webClickAction = "http://localhost:4200/";

        console.log("sending notification");
        console.log("app_id:", app_id);
        console.log("message:", message);
        console.log("sender_id:", sender_id);
        console.log("recipient_id:", recipient_id);

        let forcenotification = false;
        if (message.attributes && message.attributes.forcenotification) {
            forcenotification = message.attributes.forcenotification;
            console.log('forcenotification', forcenotification);
        }
        if (message.status != MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT) {
            console.log('message.status != MessageConstants.CHAT_MESSAGE_STATUS_CODE.SENT');
            return 0;
        }
        if (sender_id == "system") {
            console.log('do not send push notification if "system" is the sender');
            return 0;
        }
        if (sender_id == recipient_id) {
            console.log('do not send push notification to the sender itself');
            return 0;
        }
        if (forcenotification == false) {
            if (message.sender == "system"){
                console.log('do not send push notification for message with system as sender');
                return 0;
            }
        
            if (message.attributes && message.attributes.sendnotification == false) {
                console.log('do not send push notification because sendnotification is false');
                return 0;
            }
        
            if (recipient_id == "general_group" ) {
                console.log('dont send push notification for mute recipient');
                //if sender is receiver, don't send notification
                return 0;
            }
        } else {
            console.log('forcenotification is enabled');
        }
        const text = message.text;
        const messageTimestamp = JSON.stringify(message.timestamp);
        this.chatdb.allInstancesOf(app_id, sender_id, (err, instances) => {
            console.log('instances ', instances);
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
                return console.log('There are no notification instances for', user_id);
            }
            for (let i = 0; i < instances.length; i++) {
                const token = instances[i].instance_id;
                console.log("FCM token:", token)
                var instance = instances[i];
                const platform = instance.platform;
                var clickAction = "NEW_MESSAGE";
                var icon = "ic_notification_small";
                if (platform=="ionic" || platform.indexOf("web/") >- 1){
                    clickAction = webClickAction;
                    icon = "/chat/assets/img/icon.png"
                }
                const payload = {
                    notification: {
                        title: message.sender_fullname,
                        body: text,
                        icon: icon,
                        sound: "default",
                        click_action: clickAction,
                        "content_available": "true",
                        badge: "1"
                    },
                    data: {
                        recipient: message.recipient,
                        recipient_fullname: message.recipient_fullname,
                        sender: message.sender,
                        sender_fullname: message.sender_fullname,
                        channel_type: message.channel_type,
                        text: text,
                        timestamp: new Date().getTime().toString()
                    }
                };
                console.log("payload:", payload)
                //getMessaging().send(payload)
                admin.messaging().sendToDevice(token, payload)
                .then((response) => {
                    console.log("Push notification for message "+ JSON.stringify(message) + " with payload "+ JSON.stringify(payload) +" for token "+token+" and platform "+platform+" sent with response ",  JSON.stringify(response));
                    response.results.forEach((result, index) => {
                        const error = result.error;
                        if (error) {
                            console.error('Failure sending notification to', token, error);
                            if (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered') {
                                var tokenToRemove = path+'/'+token;
                                console.error('Invalid regid. Removing it', token, ' from ',tokenToRemove,error);
                                // TODO
                                // admin.database().ref(tokenToRemove).remove().then(function () {
                                //     console.log('tokenToRemove removed',tokenToRemove);
                                // });
                            }
                        }
                        return error;
                    })
                })
                .catch((error) => {
                    console.log('Error sending message:', error);
                });
            }
        });
    }

}

module.exports = { Chat21Push };
