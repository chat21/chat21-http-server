#!/usr/bin/env node

/**
 * Module dependencies.
 */

var chat21HttpServer = require('../index');
// var app = httpServer.app;
var port = process.env.PORT || 8004;
console.log("Starting server on port", port)

async function start() {
      chat21HttpServer.app.listen(port, () => {
            console.log('HTTP server started.')
            console.log('Starting AMQP publisher...');
            //chat21HttpServer.startAMQP();
            chat21HttpServer.startAMQP({rabbitmq_uri: process.env.RABBITMQ_URI});
      });
}
start();