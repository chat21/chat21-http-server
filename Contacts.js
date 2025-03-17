const axios = require('axios'); // ONLY FOR TEMP PUSH WEBHOOK ENDPOINT

let logger = require('./tiledesk-logger').logger;

class Contacts {

    constructor(config) {
        this.CONTACTS_LOOKUP_ENDPOINT = config.CONTACTS_LOOKUP_ENDPOINT;
        this.tdcache = config.tdcache;
    }

    /**
     * Returns the contact info
     * @param {callback} callback - The callback that handles the response.
     * @param {string} contact_id - The contact id.
    */
    async getContact(contact_id, callback) {
        logger.log("(Contacts) Getting contacts:", contact_id);
        logger.log("(Contacts) Getting contacts using CONTACTS_LOOKUP_ENDPOINT", this.CONTACTS_LOOKUP_ENDPOINT);
        if (!this.CONTACTS_LOOKUP_ENDPOINT) {
            logger.log("(Contacts) CONTACTS_LOOKUP_ENDPOINT is null");
            const empty_contact = {
                firstname: "",
                lastname: "",
                fullname: contact_id,
                error: "CONTACTS_LOOKUP_ENDPOINT is null",
            }
            if (callback) {
                callback(empty_contact);
            }
            return empty_contact;
        }
        const contact_key = "contacts:" + contact_id;
        if (this.tdcache) {
            let contact_string = null;
            try {
                contact_string = await this.tdcache.get(contact_key);
                if (contact_string) {
                    logger.log("(Contacts) Got contact from redis cache:", contact_string);
                    const contact = JSON.parse(contact_string);
                    if (contact) {
                        contact.cached = true;
                        if (callback) {
                            callback(contact);
                        }
                        return contact;
                    }
                }
            }
            catch (error) {
                logger.error("(Contacts) An error occurred getting redis:", contact_key);
            }
        }
        const URL = `${this.CONTACTS_LOOKUP_ENDPOINT}/${contact_id}`

        logger.log("(Contacts) Redis failed for:", contact_key);
        logger.log("(Contacts) Getting contact on URL:", URL);
        const HTTPREQUEST = {
            url: URL,
            headers: {
                'Content-Type' : 'application/json'
                //'Authorization': this.jwt_token
            },
            method: 'GET'
        };
        let contact = null;
        try {
            contact = await this.myrequest(HTTPREQUEST);
        }
        catch(error) {
            logger.error("(Contacts) User not found:", URL)
            return null;
        }
        if (contact) {
            const contact_key = "contacts:" + contact_id;
            logger.log("(Contacts) contact found:", contact);
            logger.log("(Contacts) contact key:", contact_key);
            const contact_string = JSON.stringify(contact);
            if (this.tdcache) {
                logger.log("(Contacts) Caching contact as string:", contact_string);
                await this.tdcache.set(contact_key, contact_string, { EX: 120 });
            }
        }
        return contact;
    }

    static getFullnameOf(contact) {
        if (contact && contact.fullname) {
            return contact.fullname.trim();
        }
        else if (contact && contact.firstname && contact.lastname) {
            return (contact.firstname.trim() + " " + contact.lastname.trim()).trim();
        }
        else if (contact.firstname) {
            return contact.firstname.trim();
        }
        else if (contact.lastname) {
            return contact.lastname.trim();
        }
        return "";
    }
    // ************************************************
    // ****************** HTTP REQUEST ****************
    // ************************************************

    async myrequest(options, callback) {
        return new Promise( (resolve, reject) => {
            logger.log("(Contacts) API URL:", options.url);
            logger.log("(Contacts) ** Options:", options);
            axios(
            {
                url: options.url,
                method: options.method,
                data: options.json,
                params: options.params,
                headers: options.headers
            })
            .then( (res) => {
                logger.log("(Contacts) Response for url:", options.url);
                logger.log("(Contacts) Response headers:\n", res.headers);
                if (res && res.status == 200 && res.data) {
                    if (callback) {
                        callback(null, res.data);
                    }
                    resolve(res.data);
                }
                else {
                    if (callback) {
                        const error = { message: "Response status error" };
                        callback(error, null);
                    }
                    reject(error);
                }
            })
            .catch( (error) => {
                if (callback) {
                    callback(error, null);
                }
                reject(error);
            });
        })
    }

}

module.exports = { Contacts };