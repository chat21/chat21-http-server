
**npm @chat21/chat21-http-server@0.2.16**

available on:
 ▶️ https://www.npmjs.com/package/@chat21/chat21-http-server

## v0.2.18
- firebase private key fix 

## v0.2.17
- logged FIREBASE push env variables

## v0.2.16
- fixed sonar-notified error on saveOrUpdateGroup()
- console.log fixing

## v0.2.15
- Improved Contacts.js: when no endpoint is provided it replies with a mock contact.fullname = contact_id
- Renamed testing files, added _test postfix
- New 0.2.15 npm package

## v0.2.14
- Fixed bug: MEMBER_JOINED_GROUP never updated in chat21Api.setGroupMembers()
- Fixed bug: Contacts.getContact() now correctly manages Redis errors

## v0.2.13
- added testing for Contacts.js
- Contacts.js bug fix (managing "not found" user)

## v0.2.12
- updated with docker node image: 16

## v0.2.11
- test, added embedded CONTACTS_LOOKUP_ENDPOINT
- test, fixed await tdcache

## v0.2.10
- added Contacts class
- added Redis support
- added in .env: CONTACTS_LOOKUP_ENDPOINT, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, CACHE_ENABLED

## v0.2.9
- added /:appid/:userid/archived_conversations/:conversWith endpoint
- fixed conversationDetail() bug (not discrimitating history/archived conversations)

## v0.2.8
- chat21Api.joinGroupMessages(): forced message.status = 150 in history messages after a join

## v0.2.5
- added support for the new outgoing path apps.appId.outgoing
- added push notification support for observer -> message-delivered event

## v0.2.4
- added support for instance_id removal on push notification sending error
- added PUSH_ENABLED=true|false in .env
- added support for config.mongodb_uri in startAMQP()

## v0.2.3
- Embedded (temporarily) the push notifications webhook endpoint in chatApis

## v0.2.2
- Firebase settings are now optional

## v0.2.1
- added firebase push notifications management
- added class Chat21Push
- added /:app_id/:user_id/instances/:instance_id endpoint
- added /:app_id/notify endpoint
- added npm firebase-admin: ^10.0.0

## v0.1.15
- fixed: now setGroupMembers works the right way, sending group-update notifications to original group members

## v0.1.14
- fixed: in startAMQP(), if mongodb doesn't connect => process.exit(1)

## v0.1.12
- log fix

## v0.1.11
- updated TiledeskLogger to v0.1.1
- exported logger

## v0.1.9
- fixed: logger.error("[AMQP] conn error:", err.message) -> logger.error("[AMQP] conn error:", err) Now debug is finally easy with AMQP!
- fixed: "app_id is not defined" (on some tests)
- added logger to Chat21Api class

## v0.1.9
- fixed: removed callback calls from "send history messages" in joinGroupMessages() [this.chatdb.lastMessages...] in chatApi. Now the callback is call just after the sendMessageRaw().

## v0.1.8
- fixed: err: err ? err.message() : "An error occurred" => err:err in "Join a group"

## v0.1.7
- fixed chatApi.joinGroup() renamed to chatApi.joinGroupMessages()

## v0.1.6
- bug fixing