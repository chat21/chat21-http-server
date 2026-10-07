const logger = require("../tiledesk-logger").logger
/* 
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
    this.instances_collection = 'instances'
    this.db.collection(this.messages_collection).createIndex(
      { 'timelineOf':1, 'conversWith': 1 }
    );
    this.db.collection(this.conversations_collection).createIndex(
      { 'timelineOf':1, "app_id": 1, "timestamp": 1, "archived": 1 }
    );
    this.db.collection(this.conversations_collection).createIndex(
      { "app_id": 1, "conversWith": 1}
    );
    this.db.collection(this.groups_collection).createIndex(
      { 'uid':1 }
    );
    this.db.collection(this.instances_collection).createIndex(
      { 'user_id':1 }
    );
  }

  saveOrUpdateMessage(message, callback) {
    logger.debug("(ChatDB) saving message...", message)
    this.db.collection(this.messages_collection).updateOne({timelineOf: message.timelineOf, message_id: message.message_id}, { $set: message }, { upsert: true }, function(err, doc) {
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
    logger.debug("(ChatDB) saving conversation...", conversation)
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
    this.db.collection(this.groups_collection).updateOne( { uid: group.uid }, { $set: group }, { upsert: true }, function(err, doc) {
      if (err) {
        if (callback) {
          callback(err);
        }
      }
      else {
        if (callback) {
          callback(null);
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

  /**
   * Atomically replaces the group members.
   * Calls back with the group as it was before the update (null if the group doesn't exist):
   * the added/removed members must be computed on it, a group read earlier can be changed meanwhile.
   * The written updatedOn is the group version used by the observer cache.
   */
  setGroupMembers(group_id, members, callback) {
    const updatedOn = Date.now();
    const update = { $set: { members: members, updatedOn: updatedOn } };
    this.db.collection(this.groups_collection).findOneAndUpdate({ uid: group_id }, update, { returnDocument: 'before' }, function(err, result) {
      if (callback) {
        callback(err, result ? result.value : null, updatedOn);
      }
    });
  }

  /**
   * Atomically removes a member from the group.
   * Calls back with the group as it was before the update (null if the group doesn't exist) and the written updatedOn.
   */
  removeGroupMember(group_id, member_id, callback) {
    const updatedOn = Date.now();
    const update = { $unset: {}, $set: { updatedOn: updatedOn } };
    update['$unset']["members." + member_id] = "";
    this.db.collection(this.groups_collection).findOneAndUpdate({ uid: group_id }, update, { returnDocument: 'before' }, function(err, result) {
      if (callback) {
        callback(err, result ? result.value : null, updatedOn);
      }
    });
  }

  /**
   * Sets only the given fields of the group, leaving the members untouched.
   * Calls back with the updated group (null if the group doesn't exist).
   */
  updateGroupFields(group_id, fields, callback) {
    const update = { $set: { ...fields, updatedOn: Date.now() } };
    this.db.collection(this.groups_collection).findOneAndUpdate({ uid: group_id }, update, { returnDocument: 'after' }, function(err, result) {
      if (callback) {
        callback(err, result ? result.value : null);
      }
    });
  }

  joinGroup(group_id, member_id, callback) {
    logger.debug("(ChatDB) joining group...", group_id, member_id)
    const member_field = "members." + member_id
    const now = Date.now()
    const set_command = {
      $set: {
        // member_field: 1, // see after
        "updatedOn": now
      }
    }
    set_command['$set'][member_field] = 1
    // Calls back with the group after the join: members changed meanwhile by other calls are included
    this.db.collection(this.groups_collection).findOneAndUpdate( { uid: group_id }, set_command, { upsert: true, returnDocument: 'after' }, function(err, result) {
      if (callback) {
        callback(err, result ? result.value : null)
      }
    });
  }

//   db.products.update(
//     { _id: 100 },
//     { $set: { "details.make": "zzz" } }
//  )

  lastConversations(appid, userid, archived, callback) {
    logger.debug("(ChatDB) DB. app: "+ appid+ " user: " + userid + " archived: "+ archived)
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

  conversationDetail(appid, timelineOf, conversWith, archived, callback) {
    logger.debug("(ChatDB) DB. app: "+ appid+ " user: " + timelineOf + " conversWith: "+ conversWith);
    this.db.collection(this.conversations_collection).find( { timelineOf: timelineOf, app_id: appid, conversWith: conversWith, archived: archived } ).limit(1).toArray(function(err, docs) {
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
    logger.debug("(ChatDB) DB. app:", appid, "user:", userid, "convid", convid)
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

  saveAppInstance(instance, callback) {
    this.db.collection(this.instances_collection).updateOne( { instance_id: instance.instance_id }, { $set: instance}, { upsert: true }, function(err) {
      if (err) {
        callback(err);
      }
      else {
        if (callback) {
          callback(null);
        }
      }
    });
  }

  allInstancesOf(appid, userid, callback) {
    logger.debug("(ChatDB) DB. app:", appid, "user:", userid)
    this.db.collection(this.instances_collection).find( { user_id: userid, app_id: appid }).toArray( (err, docs) => {
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

  deleteInstanceByInstanceId(instance_id, callback) {
    this.db.collection(this.instances_collection).deleteOne({instance_id: instance_id}, function(err, obj) {
      if (err) {
        if (callback) {
          callback(err, null);
        }
      }
      else {
        if (callback) {
          callback(null, obj);
        }
      }
   });
  }

  deleteConversationsByConversWith(app_id, convers_with, callback) {
    logger.log("deleteConversationsByConversWith()");
    this.db.collection(this.conversations_collection).deleteMany({app_id: app_id, conversWith: convers_with}, function(err, obj) {
      if (err) {
        logger.error("deleteConversationsByConversWith() error", err);
        if (callback) {
          callback(err, null);
        }
      }
      else {
        logger.log("deleteConversationsByConversWith() ok");
        if (callback) {
          callback(null, obj);
        }
      }
   });
  }

  deleteMessagesByConversWith(app_id, convers_with, callback) {
    logger.log("deleteMessagesByConversWith()", convers_with);
    this.db.collection(this.messages_collection).deleteMany({app_id: app_id, conversWith: convers_with}, function(err, obj) {
      if (err) {
        console.error("deleteMessagesByConversWith() error", err);
        if (callback) {
          callback(err, null);
        }
      }
      else {
        logger.log("deleteMessagesByConversWith() ok");
        if (callback) {
          callback(null, obj);
        }
      }
   });
  }

}

module.exports = { ChatDB };
