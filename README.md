# Chat21 HTTP API Application

> ***🚀 Do you want to install Tiledesk on your server with just one click?***
> 
> ***Use [Docker Compose Tiledesk installation](https://github.com/Tiledesk/tiledesk-deployment/blob/master/docker-compose/README.md) guide***

Chat21 native REST API server

# REST API
Below are described the REST API of Chat21

## Authentication

Before using these APIs you need an authentication JWT token

### JWT Authentication
Coming soon

## Send a message

== Send a Message ==

```
curl --location --request POST 'http://localhost:8004/api/APP_ID/messages' \
--header 'Authorization: JWT-TOKEN' \
--header 'Content-Type: application/json' \
--data-raw '{
 "sender_fullname": "SENDER FULLNAME",
 "recipient_id": "RECIPIENT-UUID",
 "recipient_fullname": "RECIPIENT FULLNAME",
 "text": "hello",
 "type": "text",
 "channel_type": "direct"
}'

```

Where :
- JWT-TOKEN: the authorization JWT token
- sender_fullname: is the Sender Fullname. Ex: Andrea Leo
- recipient_id: it's the recipient id of the message. The recipient id is the user id for direct message and the group id for group messaging.
- recipient_fullname: is the Recipient Fullname. Ex: Andrea Sponziello
- text: it's the message text
- channel_type: it's the channel type. "direct" value for one-to-one direct message and "group" for group messaging. Available values: direct (default) and group.
- type: it's the message type. "text" value for textual message and "image" for sending image message(you must set metadata field). Available values: text (default) and image.
- ATTRIBUTES:  it's the message custom attributes. Example: attributes = {"custom_attribute1": "value1"}. 
- METADATA: it's the image properties: src is the absolute source path of the image, width is the image width, height is the image height. Example: metadata = { "src": "https://www.tiledesk.com/wp-content/uploads/2018/03/tiledesk-logo.png", "width": 200, "height": 200 }
- APP_ID: It's the appid usend on multitenant environment. Use  "default" as default value

## Create a Group

Create a chat user's group making the following POST call :

```
  curl -X POST \
      -H 'Content-Type: application/json' \
      -H "Authorization: JWT-TOKEN" \
      -d '{"group_name": "<GROUP_NAME>", "group_members": {"<MEMBER_ID>":1}}' \
      'http://localhost:8004/api/<APP_ID>/groups'
```

Where:
- GROUP_NAME: it's the new group name
- MEMBER_ID: it's the user ids of the group members
- APP_ID: It's the appid usend on multitenant environment. Use  "default" as default value

## Join a Group

With this API the user can join (become a member) of an existing group:

```
  curl -X POST \
      -H 'Content-Type: application/json' \
      -H "Authorization: JWT-TOKEN" \
      -d '{"member_id": "<MEMBER_ID>"}' \
      'http://localhost:8004/api/<APP_ID>/groups/<GROUP_ID>/members'
```


Where :
- MEMBER_ID: it's the user id of the user you want to joing (become a member)
- APP_ID: It's the appid usend on multitenant environment. Use  "default" as default value
- GROUP_ID: it's the existing group id

## Leave a Group

With this API the user can leave an existing group:

```
  curl -X DELETE \
      -H 'Content-Type: application/json' \
      -H "Authorization: JWT-TOKEN" \
      -d '{"member_id": "<MEMBER_ID>"}' \
      'http://localhost:8004/api/<APP_ID>/groups/<GROUP_ID>/members/<MEMBERID'
```

Where :
- APP_ID: It's the appid usend on multitenant environment. Use  "default" as default value
- GROUP_ID: it's the existing group id
- MEMBER_ID: it's the user id of the user you want to leave a group

## Set Group members

With this API you can set the group members

```
    curl -X PUT \
      -H 'Content-Type: application/json' \
      -H "Authorization: JWT-TOKEN" \
      -d '{"members": {"<member_id1>":1},{"<member_id2>":1}}' \
      'http://localhost:8004/api/<APP_ID>/groups/<GROUP_ID>/members'
```

Where :
- MEMBER_IDs: it's the user ids of the group members
- APP_ID: It's the appid usend on multitenant environment. Use  "default" as default value
- GROUP_ID: it's the existing group id

## Archive or delete a conversation

Archive or delete a conversation from the personal timeline specified by a RECIPIENT_ID

```
    curl  -X DELETE \
       -H 'Content-Type: application/json' \
       -H "Authorization: JWT-TOKEN" \
       http://localhost:8004/api/<APP_ID>/conversations/<RECIPIENT_ID>?delete=<BOOLEAN_VALUE>
```

Where :
- APP_ID: It's the appid usend on multitenant environment. Use  "default" as default value
- RECIPIENT_ID: it's the recipient id
- delete:  (Optional) if true permanently deletes the conversation, if false archives the conversation


## Docker deploy

build -t chat21/chat21-http-server:latest .

docker run  chat21/chat21-server:latest

docker push chat21/chat21-http-server:latest
