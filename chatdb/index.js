/* 
    ver 0.1.2
    Andrea Sponziello - (c) Tiledesk.com
*/

/**
 * This is the class that manages DB persistence
 */
class ChatDB {

  /**
   * Constructor for Persistence object
   *
   * @example
   * const { ChatDB } = require('chatdb');
   * const chatdb = new ChatDB({database: db});
   *
   */
  constructor(options) {
    if (!options.database) {
      throw new Error('mongodb option can NOT be empty.');
    }
    this.db = options.database
    this.messages_collection = 'messages'
    this.conversations_collection = 'conversations'
    this.groups_collection = 'groups'
    this.db.collection(this.messages_collection).createIndex(
      { 'timelineOf':1, 'conversWith': 1 }
    );
    this.db.collection(this.conversations_collection).createIndex(
      { 'timelineOf':1, "app_id": 1, "timestamp": 1, "archived": 1 }
    );
    this.db.collection(this.groups_collection).createIndex(
      { 'uid':1 }
    );
  }

  saveOrUpdateMessage(message, callback) {
    console.log("saving message...", message)
    this.db.collection(this.messages_collection).updateOne({timelineOf: message.timelineOf, message_id: message.message_id}, { $set: message }, { upsert: true }, function(err, doc) {
      console.log("error...", err)
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, doc)
        }
      }
    });
  }

  saveOrUpdateConversation(conversation, callback) {
    console.log("saving conversation...", conversation)
    this.db.collection(this.conversations_collection).updateOne({timelineOf: conversation.timelineOf, conversWith: conversation.conversWith}, { $set: conversation}, { upsert: true }, function(err, doc) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, doc)
        }
      }
    });
  }

  saveOrUpdateGroup(group, callback) {
    console.log("saving group...", group)
    this.db.collection(this.groups_collection).updateOne( { uid: group.uid }, { $set: group }, { upsert: true }, function(err, doc) {
      if (callback) {
        callback(err)
      }
      else {
        if (callback) {
          callback(null)
        }
      }
    });
  }

  getGroup(group_id, callback) {
    this.db.collection(this.groups_collection).findOne( { uid: group_id }, function(err, doc) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, doc)
        }
      }
    });
  }

  joinGroup(group_id, member_id, callback) {
    console.log("joining group...", group_id, member_id)
    const member_field = "members." + member_id
    const now = Date.now()
    const set_command = {
      $set: {
        // member_field: 1, // see after
        "updatedOn": now
      }
    }
    set_command['$set'][member_field] = 1
    this.db.collection(this.groups_collection).updateOne( { uid: group_id }, set_command, { upsert: true }, function(err, doc) {
      if (callback) {
        callback(err)
      }
      else {
        if (callback) {
          callback(null)
        }
      }
    });
  }

//   db.products.update(
//     { _id: 100 },
//     { $set: { "details.make": "zzz" } }
//  )

  lastConversations(appid, userid, archived, callback) {
    console.log("DB. app:", appid, "user:", userid, "archived:", archived)
    this.db.collection(this.conversations_collection).find( { timelineOf: userid, app_id: appid, archived: archived } ).limit(200).sort( { timestamp: -1 } ).toArray(function(err, docs) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, docs)
        }
      }
    });
  }

  lastMessages(appid, userid, convid, sort, limit, callback) {
    console.log("DB. app:", appid, "user:", userid, "convid", convid)
    this.db.collection(this.messages_collection).find( { timelineOf: userid, app_id: appid, conversWith: convid } ).limit(limit).sort( { timestamp: sort } ).toArray(function(err, docs) {
      if (err) {
        if (callback) {
          callback(err, null)
        }
      }
      else {
        if (callback) {
          callback(null, docs)
        }
      }
    });
  }

}

module.exports = { ChatDB };