#!/usr/bin/env node

'use strict';

var request = require('request')
  , cheerio = require('cheerio')
  , xoauth2 = require('xoauth2')
  , nodemailer = require('nodemailer')
  , fs = require('fs')
  , ratings = {
      BBB: 1.24,
      A: 0.62,
      AA: 0.3,
      AAA: 0.15
    };

//
// Setup mail transporter with oauth2.
//
var transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    xoauth2: xoauth2.createXOAuth2Generator({
      user: process.env.EMAIL,
      clientId: process.env.CLIENT,
      clientSecret: process.env.SECRET,
      refreshToken: process.env.REFRESH
    })
  }
});

//
// Load already found projects or initialize empty hash.
//
var projects = exports.projects = fs.existsSync(__dirname + '/results.json')
  ? require('./results')
  : {};

//
// Scrape geldvoorelkaar.nl
//
exports.run = function run() {
  console.log('Starting scraper run:', (new Date).toString());
  request.get('http://www.geldvoorelkaar.nl/', function done(error, res, body) {
    if (error || res.statusCode !== 200) return console.log(
      'Request failed due to %s', error || 'status code ' + res.statusCode
    );

    var $ = cheerio.load(body)
      , data = $('.startpaginaprojects .projectInfo');

    if (!data) return console.log('Could not get data from body');
    data.each(function each(i, project) {
      var element = $(this)
        , link = element.find('.button').attr('href')
        , id = link.match(/\d+/)[0]
        , classification = element.find('[id*="ClassificatieLabel"]').text().trim()
        , rating = element.find('[id*="GraydonRatingLabel"]').text().trim()
        , interest = parseFloat(element.find('[id*="RenteLabel"]').text().trim().slice(0, -1).replace(',', '.'))
        , title = element.find('[id*="ProjectNaamLabel"]').text().trim()
        , adjusted, latest;

      //
      // Already found project do not process.
      //
      if (id in projects) return console.log('Already found %s', title);

      //
      // Project Graydon rating below threshold.
      //
      if (!~Object.keys(ratings).indexOf(rating)) return console.log('Low rating for %s', title);

      //
      // Highly speculative or not really profitable project.
      //
      adjusted = interest - 0.9 - 2.0 - ratings[rating];
      if (adjusted < 2.5) return console.log('Low interest for %s', title);

      projects[id] = latest = {
        id: id,
        title: title,
        classification: classification,
        rating: rating,
        interest: interest,
        adjusted: Math.round(adjusted * 100) / 100,
        months: element.find('[id*="LooptijdLabel"]').text().trim().match(/\d+/)[0]
      };

      //
      // Mail newly found project.
      //
      var mail = {
        from: process.env.EMAIL,
        to: process.env.TO,
        subject: 'Geldvoorelkaar.nl project: ' + title,
        generateTextFromHTML: true,
        html: [
          '<a href="http://www.geldvoorelkaar.nl/'+ link +'">Naar het project '+ title +'</a><br>',
          'Project: '+ latest.title,
          'Classificatie: '+ latest.classification,
          'Graydon Rating: '+ latest.rating,
          'Rente: '+ latest.interest +'%',
          'Rendement: '+ latest.adjusted +'%',
          'Looptijd: '+ latest.months
        ].join('<br>')
      };

      try {
        fs.writeFileSync(__dirname + '/results.json', JSON.stringify(projects));
        console.log('Results written to file');
      } catch (error) {
        console.log('Error writing file %', error.message);
      }

      transporter.sendMail(mail, function send(error, response) {
        if (error) return console.log(error);
        console.log('Mail send with new project:', title);
      });
    });
  });
};