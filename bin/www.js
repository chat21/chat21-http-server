#!/usr/bin/env node

/**
 * Module dependencies.
 */
var http = require('http');
var https = require('https');
var fs = require('fs');

var chat21HttpServer = require('../index');
// var app = httpServer.app;
var port = process.env.PORT || 8004;
console.log("Starting server on port", port)

async function start() {
      if (process.env.KEY_PEM && process.env.CERT_PEM) {
            var privateKey  = fs.readFileSync('sslcert/server.key', 'utf8');
            var certificate = fs.readFileSync('sslcert/server.crt', 'utf8');
            var credentials = {key: privateKey, cert: certificate};
            var httpsServer = https.createServer(credentials, chat21HttpServer.app);
            httpsServer.listen(port, () => {
                  console.log('HTTP server started.')
                  console.log('Starting AMQP publisher...');
                  //chat21HttpServer.startAMQP();
                  chat21HttpServer.startAMQP({rabbitmq_uri: process.env.RABBITMQ_URI});
            });
      }
      else {
            var httpServer = http.createServer(chat21HttpServer.app);
            httpServer.listen(port, () => {
                  console.log('HTTP server started.')
                  console.log('Starting AMQP publisher...');
                  //chat21HttpServer.startAMQP();
                  chat21HttpServer.startAMQP({rabbitmq_uri: process.env.RABBITMQ_URI});
            });
      }
      
}
start();