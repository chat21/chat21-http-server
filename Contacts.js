const axios = require('axios'); // ONLY FOR TEMP PUSH WEBHOOK ENDPOINT

class Contacts {

    constructor(config) {
        this.CONTACTS_LOOKUP_ENDPOINT = config.CONTACTS_LOOKUP_ENDPOINT;
        this.tdcache = config.tdcache;
        this.log = config.log;
    }

    /**
     * Returns the contact info
     * @param {callback} callback - The callback that handles the response.
     * @param {string} contact_id - The contact id.
    */
    async getContact(contact_id, callback) {
        if (this.log) {
            console.log("Getting contacts:", contact_id);
            console.log("Getting contacts CONTACTS_LOOKUP_ENDPOINT", this.CONTACTS_LOOKUP_ENDPOINT);
            console.log("Getting contacts tdcache", this.tdcache);
        }
        if (this.tdcache) {
            let contact_string = await this.tdcache.get("contacts:" + contact_id);
            if (contact_string) {
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
        const URL = `${this.CONTACTS_LOOKUP_ENDPOINT}/${contact_id}`
        if (this.log) {
            console.log("Contacts URL:", URL)
        }
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
            if (this.log) {
                console.error("User not found:", URL)
            }
            return null;
        }
        if (contact) {
            const contact_key = "contacts:" + contact_id;
            if (this.log) {
                console.log("contact found:", contact);
                console.log("contact key:", contact_key);
            }
            const contact_string = JSON.stringify(contact);
            if (this.tdcache) {
                if (this.log) {
                    console.log("Caching contact as string:", contact_string);
                }
                this.tdcache.set(contact_key, contact_string, { EX: 120 });
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
            if (this.log) {
                console.log("API URL:", options.url);
                console.log("** Options:", options);
            }
            axios(
            {
                url: options.url,
                method: options.method,
                data: options.json,
                params: options.params,
                headers: options.headers
            })
            .then( (res) => {
                if (this.log) {
                    console.log("Response for url:", options.url);
                    console.log("Response headers:\n", res.headers);
                }
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