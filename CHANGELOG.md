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