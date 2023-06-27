//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
let chai = require('chai');
let chaiHttp = require('chai-http');

let theapp = require('../index');
theapp.logger.setLog("debug");
let server = theapp.app;

// async function start() {
//     await require('../index').startServer();

// }
// start();

var express = require('express');
const bodyParser = require('body-parser');

let observer = require('@chat21/chat21-server').observer;
// console.log("observer0",observer);
// observer.setWebHook("http://localhost:3001")

observer.setWebHookEndpoints(["http://localhost:3001/"]);
observer.logger.setLog("ERROR");
let should = chai.should();

// chai.config.includeStack = true;

var expect = chai.expect;
var assert = chai.assert;

chai.use(chaiHttp);

console.log("\n\n****************************** WARNING ********************************")
console.log("***********************************************************************")
console.log("******************** ONLY MONGODB AND RABBITMQ ON *********************")
console.log("***********************************************************************")

const user1 = {
  id: '5f09983d20f76b0019af7190',
  fullname: 'Andrea Leo',
  firstname: 'Andrea',
  lastname: 'Leo',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmYmY2ODczMy1lZjRjLTQ2YmItOGU3ZS0wMWMyNWZkMDdhZGIiLCJzdWIiOiI1ZjA5OTgzZDIwZjc2YjAwMTlhZjcxOTAiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiY2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiYXpwIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwidXNlcl9pZCI6IjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE1Mjg2MzIxLCJleHAiOjE5MjYzMjYzMjEsImF1ZCI6WyJyYWJiaXRtcSIsIjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.3Gt5_rT1lwmvV0wEoFYMedUFt25UIVbF-Qt3ufjPjQ4'
}
// RABBIT USER (nico.lanzo@frontiere21.it) TOKEN:
const user2 = {
  id: '82004a48ed067c0012dd32dd',
  fullname: 'Nico Lanzo',
  firstname: 'Nico',
  lastname: 'Lanzo',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmY0YTk0Yy0zMjBlLTRhYmItYTExZi00MTM3OTlmYmU2YzkiLCJzdWIiOiI4MjAwNGE0OGVkMDY3YzAwMTJkZDMyZGQiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwiY2lkIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwiYXpwIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwidXNlcl9pZCI6IjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE1Mjg2MzIxLCJleHAiOjE5MjYzMjYzMjEsImF1ZCI6WyJyYWJiaXRtcSIsIjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.3iA2cw7YpiKhqva3E8US9xx-mHS6t14ZuvA4nWMhEio'
}

before( () => {
  return new Promise( async (resolve, reject) => {
    require('../index').logger.setLog("ERROR");
    await require('../index').startAMQP({
      CONTACTS_LOOKUP_ENDPOINT: "http://localhost:3002/contacts"
    });
    observer.setWebHookEnabled(true);
    observer.logger.setLog("error");
    var startServer = await observer.startServer(
    {
      rabbitmq_uri: process.env.RABBITMQ_URI,
      mongodb_uri: process.env.MONGODB_URI
    });
    console.log("startServer before", startServer)
    console.log("Starting contacts server...");
    var contactsServer = express();
    contactsServer.use(bodyParser.json());
    contactsServer.get("/contacts/:userid", (req, res) => {
      const contacts = {
        "5f09983d20f76b0019af7190": user1,
        "82004a48ed067c0012dd32dd": user2
      }
      const userid = req.params.userid
      console.log("/chat21/contacts/:userid", userid)
      let contact = contacts[userid];
      console.log("user:", contact)
      if (!contact) {
          contact = {
              _id: userid,
              "fullname": userid + " NOT FOUND"
          };
      }
      contact.uid = contact.id;
      contact.description = 'id:' + contact.uid;
      res.status(200).send(contact);
      res.end();
    });
    var listener = contactsServer.listen(3002, '0.0.0.0',  () => {
      console.log('contactsServer started.', listener.address());
      resolve();
    });
  })
  
});

describe('MessageRoute', () => {
  describe('/sendDirect', () => {
    // mocha test/messageRoute.js  --grep 'sendDirectSent'      
    it('sendDirectSent', (done) => {
      observer.setWebHookEvents("message-sent");             //NON SERVE CREDO 
      observer.getWebhooks().setWebHookEvents("message-sent");
      console.log("observer.getWebhooks().getWebHookEvents", observer.getWebhooks().getWebHookEvents());
      observer.getWebhooks().setWebHookEndpoints(["http://localhost:3001/"]);
      console.log("observer.getWebhooks().getWebHookEndpoint", observer.getWebhooks().getWebHookEndpoints());
      var serverClient = express();
      serverClient.use(bodyParser.json());
      serverClient.post('/', function (req, res) {
        console.log("res.body webhook", req.body);
        if (req.body.event_type == "message-sent") {
          console.log('serverClient req', JSON.stringify(req.body));
          console.log("serverClient.headers", JSON.stringify(req.headers));
          // console.log("111",req.body.data.text);
          expect(req.body.data.text).to.equal("text-sendDirectSent");
          expect(req.body.data.recipient).to.equal(user2.id);
          expect(req.body.data.recipient_fullname).to.equal(user2.fullname);
          expect(req.body.data.status).to.equal(100);
          expect(req.body.data.sender).to.equal(user1.id);
          expect(req.body.data.sender_fullname).to.equal(user1.fullname);
          expect(req.body.data.channel_type).to.equal("direct");
          // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");
          res.send({ text: "ok from webhook" });
          listener.close(function () { console.log(' :('); });
          done();
        }
      });

      var listener = serverClient.listen(3001, '0.0.0.0', function () { console.log('Node js Express started', listener.address()); });

      chai.request(server)
        .post('/api/tilechat/messages')
        .set({ "Authorization": `${user1.token}` })
        // per channel_type direct nn partono i webhook
        .send({ sender_fullname: user1.fullname, recipient_id: user2.id, recipient_fullname: user2.fullname, text: "text-sendDirectSent" })
        .end((err, res) => {
          if (err) {
            console.error("err", err);
          }
          console.log("res.body", res.body);
          res.should.have.status(200);
          res.body.should.be.a('object');
          expect(res.body.success).to.equal(true);
        });
    })
    

    it('sendDirectDelivered', (done) => {
      observer.setWebHookEvents("message-delivered");
      observer.getWebhooks().setWebHookEvents("message-delivered");
      console.log("observer.getWebhooks().getWebHookEvents", observer.getWebhooks().getWebHookEvents());
      observer.getWebhooks().setWebHookEndpoints(["http://localhost:3001/"]);
      console.log("observer.getWebhooks().getWebHookEndpoint", observer.getWebhooks().getWebHookEndpoints());         
      var serverClient = express();
      serverClient.use(bodyParser.json());
      serverClient.post('/', function (req, res) {
        console.log("res.body webhook", req.body);
        if (req.body.event_type == "message-delivered") {
          console.log('serverClient req', JSON.stringify(req.body));
          console.log("serverClient.headers", JSON.stringify(req.headers));
          expect(req.body.data.text).to.equal("text-sendDirectDelivered");
          expect(req.body.data.recipient).to.equal(user2.id);
          expect(req.body.data.status).to.equal(150);
          expect(req.body.data.sender).to.equal(user1.id);
          expect(req.body.data.sender_fullname).to.equal(user1.fullname);
          expect(req.body.data.recipient_fullname).to.equal(user2.fullname);
          expect(req.body.data.channel_type).to.equal("direct");        
          res.send({ text: "ok from webhook" });
          listener.close(function () { console.log('listener closed.'); });
          done();
        }
      });
      var listener = serverClient.listen(3001, '0.0.0.0', function () { console.log('Node js Express started', listener.address()); });
      chai.request(server)
        .post('/api/tilechat/messages')
        .set({ "Authorization": `${user1.token}` })
        // per channel_type direct nn partono i webhook
        .send({ sender_fullname: user1.fullname, recipient_id: user2.id, recipient_fullname: user2.fullname, text: "text-sendDirectDelivered" })
        .end((err, res) => {
          console.log("err", err);
          console.log("res.body", res.body);
          res.should.have.status(200);
          res.body.should.be.a('object');
          expect(res.body.success).to.equal(true);
        });
    });
  });

  describe('/sendGroup', () => {
    // mocha test/messageRoute.js  --grep 'sendGroupSent'      
    it('sendGroupSent', (done) => {
      var recipient_id = "group-" + Date.now();
      var GROUP_NAME = "group_name1";
      var group_members = {};
      group_members[user2.id] = 1;
      const SENT_MESSAGE = "text-sendGroupSent";
      observer.setWebHookEvents(["message-sent"]);
      console.log("observer.getWebhooks().getWebHookEvents", observer.getWebhooks().getWebHookEvents());
      // observer.setWebHookEndpoint("http://localhost:3001/");
      observer.setWebHookEndpoints(["http://localhost:3001/"]);
      console.log("observer.getWebhooks().getWebHookEndpoints()", observer.getWebhooks().getWebHookEndpoints());
      // observer.setWebHookEvents("message-sent");
      var count = 0;
      var serverClient = express();
      serverClient.use(bodyParser.json());
      serverClient.post('/', function (req, res) {
        //console.log("req.body webhook:", req.body);
        console.log("req.body webhook:", JSON.stringify(req.body));
        if (req.body.event_type == "message-sent") {
          expect(req.body.data.channel_type).to.equal("group");
          expect(req.body.data.recipient).to.equal(recipient_id);
          expect(req.body.data.recipient_fullname).to.equal(GROUP_NAME);
          expect(req.body.data.status).to.equal(100);
          if (
            req.body.data.text === SENT_MESSAGE &&
            req.body.data.sender === user1.id &&
            req.body.data.sender_fullname === user1.fullname
          ) {
            console.log("SENT_MESSAGE ok");
            count++;
          }
          else if (
            req.body.data.sender === 'system' &&
            req.body.data.attributes.messagelabel.key === "MEMBER_JOINED_GROUP" &&
            req.body.data.attributes.messagelabel.parameters.member_id === "5f09983d20f76b0019af7190"
          ) {
            console.log("5f09983d20f76b0019af7190 MEMBER_JOINED_GROUP ok");
            count++;
          }
          else if (
            req.body.data.sender === 'system' &&
            req.body.data.attributes.messagelabel.key === "MEMBER_JOINED_GROUP" &&
            req.body.data.attributes.messagelabel.parameters.member_id === "82004a48ed067c0012dd32dd"
          ) {
            console.log("82004a48ed067c0012dd32dd MEMBER_JOINED_GROUP ok");
            count++;
          }
          else if (
            req.body.data.sender === 'system' &&
            req.body.data.attributes.messagelabel.key === "GROUP_CREATED" &&
            req.body.data.attributes.messagelabel.parameters.creator === "5f09983d20f76b0019af7190"
          ) {
            console.log("5f09983d20f76b0019af7190 GROUP_CREATED ok");
            count++;
          }
          else {
            console.log("other text", req.body.data.text);
          }
          // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");
          if (count == 4) {
            listener.close(function () { console.log('listener closed.'); });
            done();
          }
          res.send({ text: "ok from webhook" });
        }
        else {
          res.send({ text: "ok from webhook" });
        }
      });

      var listener = serverClient.listen(3001, '0.0.0.0', function () {
        console.log('Node js Express started', listener.address());

        // CREATE GROUP
        chai.request(server)
          .post('/api/tilechat/groups')
          .set({ "Authorization": `${user1.token}` })
          // per channel_type direct nn partono i webhook
          .send({ group_id: recipient_id, group_name: GROUP_NAME, group_members: group_members, attributes: { a1: "v1" } })
          .end((err, res) => {
            console.log("group created!");
            console.log("err", err);
            console.log("res.body", res.body);
            res.should.have.status(201);
            res.body.should.be.a('object');
            expect(res.body.success).to.equal(true);
            expect(res.body.group.name).to.equal(GROUP_NAME);
            expect(res.body.group.uid).to.equal(recipient_id);
            expect(res.body.group.members[user1.id]).to.equal(1);
            expect(res.body.group.members[user2.id]).to.equal(1);
            //  expect(res.body.group.members).to.equal(group_members);
            expect(res.body.group.owner).to.equal(user1.id);
            expect(res.body.group.attributes.a1).to.equal("v1");
            chai.request(server)
              .post('/api/tilechat/messages')
              .set({ "Authorization": `${user1.token}` })
              // per channel_type direct nn partono i webhook
              .send({ sender_fullname: user1.fullname, recipient_id: recipient_id, recipient_fullname: GROUP_NAME, channel_type: "group", text: SENT_MESSAGE }) //"text-sendGroupSent"
              .end((err, res) => {
                console.log("err", err);
                console.log("res.body", res.body);
                res.should.have.status(200);
                res.body.should.be.a('object');
                expect(res.body.success).to.equal(true);
              });
          });
      });
    });
  });


});


