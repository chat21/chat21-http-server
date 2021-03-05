#!/usr/bin/env node

/**
 * Module dependencies.
 */
 
 
var index = require('../index');
var app = index.app;

var port = process.env.PORT || 8004;
console.log("Starting server on port", port)

async function start() {
      await index.startServer();
      
      app.listen(port, () => {
            console.log('Server started.')
            console.log('Starting AMQP publisher...')
      });
}
start();


