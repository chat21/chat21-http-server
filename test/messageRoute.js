//During the test the env variable is set to test
process.env.NODE_ENV = 'test';

//Require the dev-dependencies
let chai = require('chai');
let chaiHttp = require('chai-http');

let server = require('../index').app;


// async function start() {
//     await require('../index').startServer();
    
// }
// start();


var express = require('express');
const bodyParser = require('body-parser');


let observer = require('@chat21/chat21-server').observer;
// console.log("observer0",observer);
// observer.setWebHook("http://localhost:3001")

observer.setWebHookEndpoint("http://localhost:3001/");

let should = chai.should();

// chai.config.includeStack = true;

var expect = chai.expect;
var assert = chai.assert;

chai.use(chaiHttp);

before(async() => {
    await require('../index').startAMQP();
    var startServer = await observer.startServer({rabbitmq_uri: process.env.RABBITMQ_URI});
    console.log("startServer before",startServer )
});


describe('MessageRoute',() => {

  const user1 = {
      id: '5f09983d20f76b0019af7190',
      fullname: 'Andrea Leo',
      // firstname: 'Andrea',
      // lastname: 'Leo',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmYmY2ODczMy1lZjRjLTQ2YmItOGU3ZS0wMWMyNWZkMDdhZGIiLCJzdWIiOiI1ZjA5OTgzZDIwZjc2YjAwMTlhZjcxOTAiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiY2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiYXpwIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwidXNlcl9pZCI6IjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE1Mjg2MzIxLCJleHAiOjE5MjYzMjYzMjEsImF1ZCI6WyJyYWJiaXRtcSIsIjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.3Gt5_rT1lwmvV0wEoFYMedUFt25UIVbF-Qt3ufjPjQ4'
    }

    // RABBIT USER (nico.lanzo@frontiere21.it) TOKEN:
   const user2 = {
     id: '82004a48ed067c0012dd32dd',
     fullname: 'Nico Lanzo',
    //  firstname: 'Nico',
    //  lastname: 'Lanzo',
     token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmY0YTk0Yy0zMjBlLTRhYmItYTExZi00MTM3OTlmYmU2YzkiLCJzdWIiOiI4MjAwNGE0OGVkMDY3YzAwMTJkZDMyZGQiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwiY2lkIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwiYXpwIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwidXNlcl9pZCI6IjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE1Mjg2MzIxLCJleHAiOjE5MjYzMjYzMjEsImF1ZCI6WyJyYWJiaXRtcSIsIjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.3iA2cw7YpiKhqva3E8US9xx-mHS6t14ZuvA4nWMhEio'
   }

  // const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmU5YjcwNi1jNzVhLTQzOTEtOTM1Ni1jMmQ5NmViYzM4M2QiLCJzdWIiOiI1ZjA5OTgzZDIwZjc2YjAwMTlhZjcxOTAiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiY2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiYXpwIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwidXNlcl9pZCI6IjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE0OTQzNDkyLCJleHAiOjE5MjU5ODM0OTIsImF1ZCI6WyJyYWJiaXRtcSIsIjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.5DwKRZJC2q9FcXtM3fVOVRLUF2JPaJ6mfHmeKPTnwHA";


  
    describe('/sendDirect', () => {
  


      // mocha test/messageRoute.js  --grep 'sendDirectSent'      
      it('sendDirectSent', (done) => {

          
              // observer.setWebHookEndpoint("http://localhost:3001/");
              // console.log("")

              observer.setWebHookEvents("message-sent");             //NON SERVE CREDO 
              observer.getWebhooks().setWebHookEvents("message-sent");
              console.log("observer.getWebhooks().getWebHookEvents", observer.getWebhooks().getWebHookEvents());

              // observer.setWebHookEndpoint("http://localhost:3001/");
              observer.getWebhooks().setWebHookEndpoint("http://localhost:3001/");
              console.log("observer.getWebhooks().getWebHookEndpoint", observer.getWebhooks().getWebHookEndpoint());
              // observer.setWebHookEvents("message-sent");
             
              var serverClient = express();
              serverClient.use(bodyParser.json());
              serverClient.post('/', function (req, res) {
                  console.log("res.body webhook",  req.body);
                  if (req.body.event_type == "message-sent") {

                      console.log('serverClient req', JSON.stringify(req.body));                        
                      console.log("serverClient.headers",  JSON.stringify(req.headers));
                      // console.log("111",req.body.data.text);
                      expect(req.body.data.text).to.equal("text-sendDirectSent");   

                      expect(req.body.data.recipient).to.equal(user2.id);
                      expect(req.body.data.recipient_fullname).to.equal(user2.fullname);        

                      expect(req.body.data.status).to.equal(100);

                      expect(req.body.data.sender).to.equal(user1.id);   
                      expect(req.body.data.sender_fullname).to.equal(user1.fullname);   
                      
                                                                                            
                      expect(req.body.data.channel_type).to.equal("direct");                                                                              
                      // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");           


                      res.send({text:"ok from webhook"});   
                      listener.close(function() { console.log('listener closed :('); });
                      done();      

                  }
                                                                
              });

              var listener = serverClient.listen(3001, '0.0.0.0', function(){ console.log('Node js Express started', listener.address());});

              chai.request(server)
              .post('/api/tilechat/messages')
              .set({ "Authorization": `${user1.token}`})
              // per channel_type direct nn partono i webhook
              .send({sender_fullname:user1.fullname, recipient_id: user2.id, recipient_fullname: user2.fullname, text: "text-sendDirectSent"})
              .end((err, res) => {
                  console.log("err",  err);
                  console.log("res.body",  res.body);
                  res.should.have.status(200);
                  res.body.should.be.a('object');
                  expect(res.body.success).to.equal(true);                                                                              
                                               
              });         
          

          })
          // .timeout(20000);        







        // mocha test/messageRoute.js  --grep 'sendDirectSent'
        
        it('sendDirectDelivered', (done) => {

            
          // observer.setWebHookEndpoint("http://localhost:3001/");
          // console.log("")

          observer.setWebHookEvents("message-delivered");             //NON SERVE CREDO 
          observer.getWebhooks().setWebHookEvents("message-delivered");
          console.log("observer.getWebhooks().getWebHookEvents", observer.getWebhooks().getWebHookEvents());

          // observer.setWebHookEndpoint("http://localhost:3001/");
          observer.getWebhooks().setWebHookEndpoint("http://localhost:3001/");
          console.log("observer.getWebhooks().getWebHookEndpoint", observer.getWebhooks().getWebHookEndpoint());
          // observer.setWebHookEvents("message-sent");         

          var serverClient = express();
          serverClient.use(bodyParser.json());
          serverClient.post('/', function (req, res) {
              console.log("res.body webhook",  req.body);
              if (req.body.event_type == "message-delivered") {

                  console.log('serverClient req', JSON.stringify(req.body));                        
                  console.log("serverClient.headers",  JSON.stringify(req.headers));
                  // console.log("111",req.body.data.text);
                  expect(req.body.data.text).to.equal("text-sendDirectDelivered");   

                  expect(req.body.data.recipient).to.equal(user2.id);                                                                              
                  expect(req.body.data.status).to.equal(150);

                  expect(req.body.data.sender).to.equal(user1.id);   
                  expect(req.body.data.sender_fullname).to.equal(user1.fullname);  

                  expect(req.body.data.recipient_fullname).to.equal(user2.fullname);                                                                              
                  expect(req.body.data.channel_type).to.equal("direct");                                                                              
                  // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");           


                  res.send({text:"ok from webhook"});   
                  listener.close(function() { console.log('listener closed :('); });
                  done();      

              }
                                                            
          });
          var listener = serverClient.listen(3001, '0.0.0.0', function(){ console.log('Node js Express started', listener.address());});
        

          chai.request(server)
          .post('/api/tilechat/messages')
          .set({ "Authorization": `${user1.token}`})
          // per channel_type direct nn partono i webhook
          .send({sender_fullname:user1.fullname, recipient_id: user2.id, recipient_fullname: user2.fullname, text: "text-sendDirectDelivered"})
          .end((err, res) => {
              console.log("err",  err);
              console.log("res.body",  res.body);
              res.should.have.status(200);
              res.body.should.be.a('object');
              expect(res.body.success).to.equal(true);                                                                                                    
          });         
      

      })
      // .timeout(20000);        









        // mocha test/messageRoute.js  --grep 'sendDirectReceived'
        
        /*
        it('sendDirectReceived', (done) => {

            
          // observer.setWebHookEndpoint("http://localhost:3001/");
          // console.log("")

          observer.setWebHookEvents("message-received");             //NON SERVE CREDO 
          observer.getWebhooks().setWebHookEvents("message-received");
          console.log("observer.getWebhooks().getWebHookEvents", observer.getWebhooks().getWebHookEvents());

          // observer.setWebHookEndpoint("http://localhost:3001/");
          observer.getWebhooks().setWebHookEndpoint("http://localhost:3001/");
          console.log("observer.getWebhooks().getWebHookEndpoint", observer.getWebhooks().getWebHookEndpoint());
          // observer.setWebHookEvents("message-sent");

          // var recipient_id = "recipient-"+Date.now();
          // se nn inizia con support-group-nn manda webhook
          // var recipient_id = "support-group-recipient-"+Date.now();

          chai.request(server)
          .post('/api/tilechat/messages')
          .set({ "Authorization": `${user1.token}`})
          // per channel_type direct nn partono i webhook
          .send({sender_fullname:user1.fullname, recipient_id: user2.id, recipient_fullname: user2.fullname, text: "text-sendDirectReceived"})
          .end((err, res) => {
              console.log("err",  err);
              console.log("res.body",  res.body);
              res.should.have.status(200);
              res.body.should.be.a('object');
              expect(res.body.success).to.equal(true);                                                                              


              var serverClient = express();
              serverClient.use(bodyParser.json());
              serverClient.post('/', function (req, res) {
                  console.log("res.body webhook",  req.body);
                  if (req.body.event_type == "message-received") {

                      console.log('serverClient req', JSON.stringify(req.body));                        
                      console.log("serverClient.headers",  JSON.stringify(req.headers));
                      // console.log("111",req.body.data.text);
                      expect(req.body.data.text).to.equal("text-sendDirectReceived");   

                      expect(req.body.data.recipient).to.equal(user2.id);                                                                              
                      expect(req.body.data.status).to.equal(200);

                      expect(req.body.data.sender).to.equal(user1.id);   
                      expect(req.body.data.sender_fullname).to.equal(user1.fullname);  

                      expect(req.body.data.recipient_fullname).to.equal(user2.fullname);                                                                              
                      expect(req.body.data.channel_type).to.equal("direct");                                                                              
                      // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");           


                      res.send({text:"ok from webhook\n* button1"});   
                      listener.close(function() { console.log('listener closed :('); });
                      done();      

                  }
                                                                
              });
              var listener = serverClient.listen(3001, '0.0.0.0', function(){ console.log('Node js Express started', listener.address());});
            

          });         
      

      }).timeout(20000);        

*/






  });




  describe('/sendGroup', () => {
  


    // mocha test/messageRoute.js  --grep 'sendGroupSent'      
    it('sendGroupSent', (done) => {

        
            // observer.setWebHookEndpoint("http://localhost:3001/");
            // console.log("")

            observer.setWebHookEvents("message-sent");             //NON SERVE CREDO 
            observer.getWebhooks().setWebHookEvents("message-sent");
            console.log("observer.getWebhooks().getWebHookEvents", observer.getWebhooks().getWebHookEvents());

            // observer.setWebHookEndpoint("http://localhost:3001/");
            observer.getWebhooks().setWebHookEndpoint("http://localhost:3001/");
            console.log("observer.getWebhooks().getWebHookEndpoint", observer.getWebhooks().getWebHookEndpoint());
            // observer.setWebHookEvents("message-sent");        



            var count = 0;
            var serverClient = express();
            serverClient.use(bodyParser.json());
            serverClient.post('/', function (req, res) {
            console.log("res.body webhook",  req.body);

                

                if (req.body.event_type == "message-sent") {

                    // console.log('serverClient req', JSON.stringify(req.body));                        
                    // console.log("serverClient.headers",  JSON.stringify(req.headers));
                    // console.log("111",req.body.data.text);
                    // expect(req.body.data.text).to.equal("Group created"); 
                    expect(req.body.data.channel_type).to.equal("group");                              
                    console.log("ok1");

                    expect(req.body.data.recipient).to.equal(recipient_id);
                    console.log("ok2");

                    expect(req.body.data.recipient_fullname).to.equal(groupName);        
                    console.log("ok3");

                    expect(req.body.data.status).to.equal(100);
                    console.log("ok4");


                    if (req.body.data.text === "text-sendGroupSent") {
                      count++;

                      expect(req.body.data.sender).to.equal(user1.id);   
                      console.log("ok5.0");

                      expect(req.body.data.sender_fullname).to.equal(user1.fullname);   
                      console.log("ok6.0");
                                                                                            
                      expect(req.body.data.text).to.equal("text-sendGroupSent");                                                                         
                      console.log("ok7.0");
                    }

                    else if (req.body.data.text === "5f09983d20f76b0019af7190 added to group") {
                      count++;

                      expect(req.body.data.sender).to.equal("system");   
                      console.log("ok5.1");

                      expect(req.body.data.sender_fullname).to.equal("System");   
                      console.log("ok6.1");
                                                                                            
                      expect(req.body.data.text).to.equal("5f09983d20f76b0019af7190 added to group");                                                                         
                      console.log("ok7.1");
                    }

                    else if (req.body.data.text === "82004a48ed067c0012dd32dd added to group") {
                      count++;

                      expect(req.body.data.sender).to.equal("system");   
                      console.log("ok5.2");

                      expect(req.body.data.sender_fullname).to.equal("System");   
                      console.log("ok6.2");
                                                                                            
                      expect(req.body.data.text).to.equal("82004a48ed067c0012dd32dd added to group");                                                                         
                      console.log("ok7.2");
                    }

                    else if (req.body.data.text === "Group created") {
                      count++;

                      expect(req.body.data.sender).to.equal("system");   
                      console.log("ok5.3");

                      expect(req.body.data.sender_fullname).to.equal("System");   
                      console.log("ok6.3");
                                                                                            
                      expect(req.body.data.text).to.equal("Group created");                                                                         
                      console.log("ok7.3");
                    } else {
                      console.log("other text", req.body.data.text);
                    }

                    
                    // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");           

                    console.log("count",count);
                    
                    
                    if (count==4) {
                      listener.close(function() { console.log('listener closed :('); });
                      done();      
                    }
                    
                    res.send({text:"ok from webhook"});  
                }
                                                              
            });
            var listener = serverClient.listen(3001, '0.0.0.0', function(){ console.log('Node js Express started', listener.address());});
                      


            var recipient_id = "group-"+Date.now();
            // var recipient_id = "support-group-recipient-"+Date.now();
            var groupName = "group_name1";
            var group_members = {};
            group_members[user1.id] = 1;
            group_members[user2.id] = 1;

             //Create Group
             chai.request(server)
             .post('/api/tilechat/groups')
             .set({ "Authorization": `${user1.token}`})
             // per channel_type direct nn partono i webhook
             .send({group_id: recipient_id, group_name:groupName, group_members: group_members, attributes: {a1: "v1"} })
             .end((err, res) => {
                 console.log("err",  err);
                 console.log("res.body",  res.body);
                 res.should.have.status(201);
                 res.body.should.be.a('object');
                 expect(res.body.success).to.equal(true);
                 expect(res.body.group.name).to.equal(groupName);     
                 expect(res.body.group.uid).to.equal(recipient_id);     
                 expect(res.body.group.members[user1.id]).to.equal(1);     
                 expect(res.body.group.members[user2.id]).to.equal(1);     
                //  expect(res.body.group.members).to.equal(group_members);     
                 expect(res.body.group.owner).to.equal(user1.id);                      
                 expect(res.body.group.attributes.a1).to.equal("v1");                         

                      chai.request(server)
                      .post('/api/tilechat/messages')
                      .set({ "Authorization": `${user1.token}`})
                      // per channel_type direct nn partono i webhook
                      .send({sender_fullname:user1.fullname, recipient_id: recipient_id, recipient_fullname: groupName, channel_type: "group", text: "text-sendGroupSent"})
                      .end((err, res) => {
                          console.log("err",  err);
                          console.log("res.body",  res.body);
                          res.should.have.status(200);
                          res.body.should.be.a('object');
                          expect(res.body.success).to.equal(true);                                                                              
                      
                      });         
        
          });
        })
        // .timeout(20000);        

  });


});


