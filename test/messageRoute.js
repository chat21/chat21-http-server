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


let should = chai.should();

// chai.config.includeStack = true;

var expect = chai.expect;
var assert = chai.assert;

chai.use(chaiHttp);

before(async() => {
    await require('../index').startServer();
    var startServer = await observer.startServer;
});


describe('MessageRoute',() => {
   

    const user1 = {
        userid: '5f09983d20f76b0019af7190',
        fullname: 'Andrea Leo',
        firstname: 'Andrea',
        lastname: 'Leo',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmYmY2ODczMy1lZjRjLTQ2YmItOGU3ZS0wMWMyNWZkMDdhZGIiLCJzdWIiOiI1ZjA5OTgzZDIwZjc2YjAwMTlhZjcxOTAiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiY2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiYXpwIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwidXNlcl9pZCI6IjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE1Mjg2MzIxLCJleHAiOjE5MjYzMjYzMjEsImF1ZCI6WyJyYWJiaXRtcSIsIjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.3Gt5_rT1lwmvV0wEoFYMedUFt25UIVbF-Qt3ufjPjQ4'
      }

    // RABBIT USER (nico.lanzo@frontiere21.it) TOKEN:
   const user2 = {
     userid: '82004a48ed067c0012dd32dd',
     fullname: 'Nico Lanzo',
     firstname: 'Nico',
     lastname: 'Lanzo',
     token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmY0YTk0Yy0zMjBlLTRhYmItYTExZi00MTM3OTlmYmU2YzkiLCJzdWIiOiI4MjAwNGE0OGVkMDY3YzAwMTJkZDMyZGQiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwiY2lkIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwiYXpwIjoiODIwMDRhNDhlZDA2N2MwMDEyZGQzMmRkIiwidXNlcl9pZCI6IjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE1Mjg2MzIxLCJleHAiOjE5MjYzMjYzMjEsImF1ZCI6WyJyYWJiaXRtcSIsIjgyMDA0YTQ4ZWQwNjdjMDAxMmRkMzJkZCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.3iA2cw7YpiKhqva3E8US9xx-mHS6t14ZuvA4nWMhEio'
   }

  const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ZmU5YjcwNi1jNzVhLTQzOTEtOTM1Ni1jMmQ5NmViYzM4M2QiLCJzdWIiOiI1ZjA5OTgzZDIwZjc2YjAwMTlhZjcxOTAiLCJzY29wZSI6WyJyYWJiaXRtcS5yZWFkOiovKi9hcHBzLnRpbGVjaGF0LnVzZXJzLjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MC4qIiwicmFiYml0bXEud3JpdGU6Ki8qL2FwcHMudGlsZWNoYXQudXNlcnMuNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwLioiLCJyYWJiaXRtcS5jb25maWd1cmU6Ki8qLyoiXSwiY2xpZW50X2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiY2lkIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwiYXpwIjoiNWYwOTk4M2QyMGY3NmIwMDE5YWY3MTkwIiwidXNlcl9pZCI6IjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCIsImFwcF9pZCI6InRpbGVjaGF0IiwiaWF0IjoxNjE0OTQzNDkyLCJleHAiOjE5MjU5ODM0OTIsImF1ZCI6WyJyYWJiaXRtcSIsIjVmMDk5ODNkMjBmNzZiMDAxOWFmNzE5MCJdLCJraWQiOiJ0aWxlZGVzay1rZXkiLCJ0aWxlZGVza19hcGlfcm9sZXMiOiJ1c2VyIn0.5DwKRZJC2q9FcXtM3fVOVRLUF2JPaJ6mfHmeKPTnwHA";

  describe('/send', () => {
 

    /*

    // mocha test/messageRoute.js  --grep 'sendSimpleDirect'
    it('sendSimpleDirect', (done) => {

        
            observer.setWebHookEndpoint("http://localhost:3001/");

            // var recipient_id = "recipient-"+Date.now();
            // se nn inizia con support-group-nn manda webhook
            var recipient_id = "support-group-recipient-"+Date.now();

            chai.request(server)
            .post('/api/tilechat/messages')
            .set({ "Authorization": `${jwt}`})
            // per channel_type direct nn partono i webhook
            .send({sender_fullname:"sender_fullname", recipient_id: recipient_id, recipient_fullname: "recipient_fullname", text: "text-sendSimpleDirect"})
            .end((err, res) => {
                console.log("err",  err);
                console.log("res.body",  res.body);
                res.should.have.status(200);
                res.body.should.be.a('object');
                expect(res.body.success).to.equal(true);                                                                              
                // var id_faq_kb = res.body._id;


                var serverClient = express();
                serverClient.use(bodyParser.json());
                serverClient.post('/', function (req, res) {
                    if (req.body.event_type == "new-message") {

                        console.log('serverClient req', JSON.stringify(req.body));                        
                        console.log("serverClient.headers",  JSON.stringify(req.headers));
                        // console.log("111",req.body.data.text);
                        expect(req.body.data.text).to.equal("text-sendSimpleDirect");   

                        expect(req.body.data.recipient).to.equal(recipient_id);                                                                              
                        expect(req.body.data.status).to.equal(150);

                        expect(req.body.data.sender).to.equal("5f09983d20f76b0019af7190");   
                        expect(req.body.data.recipient_fullname).to.equal("recipient_fullname");                                                                              
                        expect(req.body.data.channel_type).to.equal("direct");                                                                              
                        // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");           


                        res.send({text:"ok from webhook\n* button1"});   
                        done();      

                    }
                                                                  
                });
                var listener = serverClient.listen(3001, '0.0.0.0', function(){ console.log('Node js Express started', listener.address());});
               

            });         
        

        }).timeout(20000);        

   */











        it('sendSimple', (done) => {

 

            observer.setWebHookEndpoint("http://localhost:3002/");
            observer.setWebHookMethods("new-message-saved");
            var recipient_id = "support-group-recipient-"+Date.now();

            var group_members = {};
            group_members[user1.userid] = 1;
            group_members[user2.userid] = 1;

             //Create Group
             chai.request(server)
             .post('/api/tilechat/groups')
             .set({ "Authorization": `${jwt}`})
             // per channel_type direct nn partono i webhook
             .send({group_id: recipient_id, group_name:"group_name1", group_members: group_members, attributes: {a1: "v1"} })
             .end((err, res) => {
                 console.log("err",  err);
                 console.log("res.body",  res.body);
                 res.should.have.status(201);
                 res.body.should.be.a('object');
                 expect(res.body.success).to.equal(true);
                 expect(res.body.group.name).to.equal("group_name1");     
                 expect(res.body.group.uid).to.equal(recipient_id);     
                 expect(res.body.group.members[user1.userid]).to.equal(1);     
                 expect(res.body.group.members[user2.userid]).to.equal(1);     
                //  expect(res.body.group.members).to.equal(group_members);     
                 expect(res.body.group.owner).to.equal(user1.userid);                      
                 expect(res.body.group.attributes.a1).to.equal("v1");     
                 
                //Send Message
                chai.request(server)
                .post('/api/tilechat/messages')
                .set({ "Authorization": `${jwt}`})
                // per channel_type direct nn partono i webhook
                .send({sender_fullname:"sender_fullname", recipient_id: recipient_id, recipient_fullname: "recipient_fullname", text: "text-sendSimple", channel_type: "group"})
                .end((err, res) => {
                    console.log("err",  err);
                    console.log("res.body",  res.body);
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    expect(res.body.success).to.equal(true);                                                                                              


                    //Webhook Message
                    var serverClient = express();
                    serverClient.use(bodyParser.json());
                    serverClient.post('/', function (req, res) {

                        if (req.body.event_type == "new-message-saved" && req.body.data.text== "text-sendSimple") {

                            console.log('serverClient req', JSON.stringify(req.body));                        
                            console.log("serverClient.headers",  JSON.stringify(req.headers));
                            console.log("res.body.data", req.body.data);
                            expect(req.body.data.text).to.equal("text-sendSimple");   

                            expect(req.body.data.recipient).to.equal(recipient_id);                                                                              
                            expect(req.body.data.status).to.equal(150);

                            expect(req.body.data.sender).to.equal("5f09983d20f76b0019af7190");   
                            expect(req.body.data.sender_fullname).to.equal("sender_fullname");  
                            expect(req.body.data.recipient_fullname).to.equal("recipient_fullname");                                                                              
                            expect(req.body.data.channel_type).to.equal("group");                                                                              
                            // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");           

                            // expect(res.body.data).to.not.equal(undefined);   
                            res.send({text:"ok"});   



                            //check sender message timeline. Message history
                            chai.request(server)
                            .get('/api/tilechat/'+user1.userid+'/conversations/'+recipient_id+'/messages')
                            .set({ "Authorization": `${jwt}`})
                            .end((err, res) => {
                                console.log("err",  err);
                                console.log("res.body",  res.body);
                                res.should.have.status(200);
                                res.body.should.be.a('object');
                                
                                var messagesLength = res.body.result.length-1;

                                expect(res.body.result.length).to.greaterThan(0); 

                                  var text = [];
                                  var recipients = [];
                                  var senders = [];
                                  var fullnames = [];
                                    res.body.result.forEach(function(r){
                                        recipients.push(r.recipient);
                                        senders.push(r.sender);
                                        text.push(r.text);
                                        fullnames.push(r.recipient_fullname)
                                    });

                                expect(recipients).to.deep.include(recipient_id);
                                // expect(res.body.result[messagesLength].recipient).to.equal(recipient_id);                                                                              

                                
                                expect(res.body.result[messagesLength].status).to.be.oneOf([100, 150]);

                                expect(text).to.deep.include("text-sendSimple");
                                // expect(res.body.result[messagesLength].text).to.equal("text-sendSimple"); 

                                expect(senders).to.deep.include(user1.userid);
                                // expect(res.body.result[messagesLength].sender).to.equal(user1.userid);   

                                expect(fullnames).to.deep.include("recipient_fullname");
                                // expect(res.body.result[messagesLength].recipient_fullname).to.equal("recipient_fullname");                                                                              
                                expect(res.body.result[messagesLength].channel_type).to.equal("group");                                                                              
                                expect(res.body.result[messagesLength].timelineOf).to.equal(user1.userid);                                                                              
                            

                                done();



                            });

                    } else {
                        res.send({text:"ok"});   
                    }
                                                                  
                });
                var listener = serverClient.listen(3002, '0.0.0.0', function(){ console.log('Node js Express started', listener.address());});
             

            });         
        
            });
        }).timeout(20000);









        it('sendSimpleConversation', (done) => {

 

            observer.setWebHookEndpoint("http://localhost:3005/");
            observer.setWebHookMethods("conversation-saved");
            var recipient_id = "support-group-recipient-"+Date.now();

            var group_members = {};
            group_members[user1.userid] = 1;
            group_members[user2.userid] = 1;

             //Create Group
             chai.request(server)
             .post('/api/tilechat/groups')
             .set({ "Authorization": `${jwt}`})
             // per channel_type direct nn partono i webhook
             .send({group_id: recipient_id, group_name:"group_name1", group_members: group_members, attributes: {a1: "v1"} })
             .end((err, res) => {
                 console.log("err",  err);
                 console.log("res.body",  res.body);
                 res.should.have.status(201);
                 res.body.should.be.a('object');
                 expect(res.body.success).to.equal(true);
                 expect(res.body.group.name).to.equal("group_name1");     
                 expect(res.body.group.uid).to.equal(recipient_id);     
                 expect(res.body.group.members[user1.userid]).to.equal(1);     
                 expect(res.body.group.members[user2.userid]).to.equal(1);     
                //  expect(res.body.group.members).to.equal(group_members);     
                 expect(res.body.group.owner).to.equal(user1.userid);                      
                 expect(res.body.group.attributes.a1).to.equal("v1");     
                 
                //Send Message
                chai.request(server)
                .post('/api/tilechat/messages')
                .set({ "Authorization": `${jwt}`})
                // per channel_type direct nn partono i webhook
                .send({sender_fullname:"sender_fullname", recipient_id: recipient_id, recipient_fullname: "recipient_fullname", text: "text-sendSimpleConversation", channel_type: "group"})
                .end((err, res) => {
                    console.log("err",  err);
                    console.log("res.body",  res.body);
                    res.should.have.status(200);
                    res.body.should.be.a('object');
                    expect(res.body.success).to.equal(true);                                                                                              


                    //Webhook Message
                    var serverClient = express();
                    serverClient.use(bodyParser.json());
                    serverClient.post('/', function (req, res) {

                        if (req.body.event_type == "conversation-saved" && req.body.data.last_message_text== "text-sendSimpleConversation" && req.body.data.timelineOf=="5f09983d20f76b0019af7190") {

                            console.log('serverClient req', JSON.stringify(req.body));                        
                            console.log("serverClient.headers",  JSON.stringify(req.headers));
                            console.log("res.body.data", req.body.data);
                            expect(req.body.data.last_message_text).to.equal("text-sendSimpleConversation");   

                            expect(req.body.data.recipient).to.equal(recipient_id);                                                                              
                            expect(req.body.data.status).to.equal(150);

                            expect(req.body.data.sender).to.equal("5f09983d20f76b0019af7190");   
                            expect(req.body.data.sender_fullname).to.equal("sender_fullname");  
                            expect(req.body.data.recipient_fullname).to.equal("recipient_fullname");                                                                              
                            expect(req.body.data.channel_type).to.equal("group");                                                                              
                            // expect(req.body.data.timelineOf).to.equal("5f09983d20f76b0019af7190");           

                            // expect(res.body.data).to.not.equal(undefined);   
                            res.send({text:"ok"});    

                           
                                //check sender conversartion timeline
                                chai.request(server)
                                .get('/api/tilechat/'+user1.userid+'/conversations/')
                                .set({ "Authorization": `${jwt}`})
                                .end((err, res) => {
                                    console.log("err",  err);
                                    console.log("res.body",  res.body);
                                    res.should.have.status(200);
                                    res.body.should.be.a('object');
                                    expect(res.body.result.length).greaterThan(1);  
                                    
                                    
                                    var membersRecipient = [];
                                    var membersSender = [];
                                    var membersLastText = [];
                                    res.body.result.forEach(function(r){
                                        membersRecipient.push(r.recipient);
                                        membersSender.push(r.sender);
                                        membersLastText.push(r.last_message_text);
                                    });
                                    console.log("membersRecipient",  membersRecipient);
                                    expect(membersRecipient).to.deep.include(recipient_id);




                                    expect(membersSender).to.deep.include(user1.userid);
                                    expect(membersLastText).to.deep.include("text-sendSimpleConversation");
                               

                                    done()

                                });

                    }else {
                        res.send({text:"ok"});    
                    }
                                                                  
                });
                var listener = serverClient.listen(3004, '0.0.0.0', function(){ console.log('Node js Express started', listener.address());});
             

            });         
        
            });
        }).timeout(20000);












  });



});


