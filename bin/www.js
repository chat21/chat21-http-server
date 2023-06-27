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
            console.log('Server certificate and key found. Starting HTTPS server.');
            var privateKey  = fs.readFileSync(process.env.KEY_PEM, 'utf8');
            var certificate = fs.readFileSync(process.env.CERT_PEM, 'utf8');
            var credentials = {key: privateKey, cert: certificate};
            var httpsServer = https.createServer(credentials, chat21HttpServer.app);
            httpsServer.listen(port, () => {
                  console.log('HTTPS server started.')
                  console.log('Starting AMQP publisher...');
                  //chat21HttpServer.startAMQP();
                  chat21HttpServer.startAMQP(
                        {
                              rabbitmq_uri: process.env.RABBITMQ_URI,
                              REDIS_HOST: process.env.CHAT21HTTP_REDIS_HOST,
                              REDIS_PORT: process.env.CHAT21HTTP_REDIS_PORT,
                              REDIS_PASSWORD: process.env.CHAT21HTTP_REDIS_PASSWORD,
                              CACHE_ENABLED: process.env.CHAT21HTTP_CACHE_ENABLED
                        }
                  );
            });
      }
      else {
            var httpServer = http.createServer(chat21HttpServer.app);
            httpServer.listen(port, () => {
                  console.log('HTTP server started.')
                  console.log('Starting AMQP publisher...');
                  //chat21HttpServer.startAMQP();
                  chat21HttpServer.startAMQP(
                        {
                              rabbitmq_uri: process.env.RABBITMQ_URI,
                              REDIS_HOST: process.env.CHAT21HTTP_REDIS_HOST,
                              REDIS_PORT: process.env.CHAT21HTTP_REDIS_PORT,
                              REDIS_PASSWORD: process.env.CHAT21HTTP_REDIS_PASSWORD,
                              CACHE_ENABLED: process.env.CHAT21HTTP_CACHE_ENABLED
                        }
                  );
            });
      }
      
}
start();