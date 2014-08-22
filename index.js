'use strict';

var restify = require('restify')
  , scraper = require('./scraper')
  , fs = require('fs');

var env = process.env.NODE_ENV || 'development'
  , server = restify.createServer()
  , port = env === 'production' ? 80 : 8080;

//
// Run scraper every 2 minutes.
//
var job = setInterval(scraper.run, 120000);

//
// Start server to respond with JSON.
//
server.name = 'Scraper';
server.get('/', function respond(req, res, next) {
  try {
    res.json(scraper.projects);
  } catch(e) {
    res.send('Error parsing results!');
  }

  next();
});

server.listen(port, function() {
  console.log('%s listening at %s', server.name, server.url);
});