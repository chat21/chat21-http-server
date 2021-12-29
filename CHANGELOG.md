
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