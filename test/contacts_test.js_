var assert = require('assert');
require('dotenv').config();
const { Chat21Api } = require('../chat21Api/index.js');
const { Contacts } = require('../Contacts.js');
var express = require('express');
const bodyParser = require("body-parser")

const user1 = {
    id: '5f09983d20f76b0019af7190',
    fullname: 'Andrea Leo',
    firstname: 'Andrea',
    lastname: 'Leo'
}
// RABBIT USER (nico.lanzo@frontiere21.it) TOKEN:
const user2 = {
    id: '82004a48ed067c0012dd32dd',
    fullname: 'Nico Lanzo',
    firstname: 'Nico',
    lastname: 'Lanzo'
}

let contactsServer = express();
let contactsListener;

before( () => {
    return new Promise( async (resolve, reject) => {
    console.log("Starting contacts server...");
    const contacts = {
        "5f09983d20f76b0019af7190": user1,
        "82004a48ed067c0012dd32dd": user2
    }
    contactsServer.use(bodyParser.json());
    contactsServer.get("/users_util/:userid", (req, res) => {
        const userid = req.params.userid
        console.log("/:userid =>", userid);
        let contact = contacts[userid];
        console.log("user found?", contact)
        if (!contact) {
            res.status(404).send({success: false, message: "Not found"});
            return;
        }
        contact.uid = contact._id;
        contact.description = 'id:' + contact.uid;
        res.status(200).send(contact);
        res.end();
    });
    contactsListener = contactsServer.listen(3003, '0.0.0.0',  () => {
        console.log('contactsServer started.', contactsListener.address());
        resolve();
    });
    })
});

after(function(done) {
    console.log("after - Ending test...");
    contactsListener.close((err) => {
        console.log('contactsListener closed.');
        done();
        //process.exit(err ? 1 : 0);
    });
});

describe('getContact()', async() => {
    
    it('should return a contact', async() => {
        return new Promise( async (resolve, reject) => {
            let contacts_endpoint = "http://localhost:3003/users_util";
            const contacts = new Contacts({
                CONTACTS_LOOKUP_ENDPOINT: contacts_endpoint,
                tdcache: null,
                log: true
            });
            const chatapi = new Chat21Api(
            {
                exchange: 'NOT-NEEDED',
                database: 'NOT-NEEDED',
                rabbitmq_uri: 'NOT-NEEDED',
                contacts: contacts
            });
            const user = await chatapi.getContact(user1.id);
            console.log("user found", user);
            assert(user);
            assert(user.id === user1.id);
            resolve();
        })
    });

    it('should correctly manage user not found on Contacts class', async() => {
        return new Promise( async (resolve, reject) => {
            let contacts_endpoint = "http://localhost:3003/users_util";
            const contacts = new Contacts({
                CONTACTS_LOOKUP_ENDPOINT: contacts_endpoint,
                tdcache: null,
                log: true
            });
            const chatapi = new Chat21Api(
            {
                exchange: 'exchange',
                database: 'database',
                rabbitmq_uri: 'rabbitmq_uri',
                contacts: contacts
            });
            console.log("getting contact unknown-id");
            let user = await contacts.getContact("unknown-id");
            console.log("user found", user);
            assert(user == null);
            resolve();
        })
    });

    it('should correctly manage user not found with ChatApi.getContact() utility method', async() => {
        return new Promise( async (resolve, reject) => {
            let contacts_endpoint = "http://localhost:3002/users_util";
            const contacts = new Contacts({
                CONTACTS_LOOKUP_ENDPOINT: contacts_endpoint,
                tdcache: null,
                log: true
            });
            const chatapi = new Chat21Api(
            {
                exchange: 'exchange',
                database: 'database',
                rabbitmq_uri: 'rabbitmq_uri',
                contacts: contacts
            });
            const user = await chatapi.getContact("unknown-id");
            console.log("user found...", user);
            assert(user.fullname === "unknown-id");
            assert(user.firstname === "");
            assert(user.lastname === "");
            resolve();
        })
    });
    
});
