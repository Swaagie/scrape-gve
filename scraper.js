#!/usr/bin/env node

'use strict';

var exec = require('child_process').exec
  , cheerio = require('cheerio')
  , xoauth2 = require('xoauth2')
  , nodemailer = require('nodemailer')
  , fs = require('fs');

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
  exec('curl -L https://geldvoorelkaar.nl/geldvoorelkaar/startpagina.aspx', function done(error, body) {
    if (error) return console.log(
      'Request failed due to %s', error.message
    );

    // if (res.statusCode >= 400) return console.log(
    //   'Received error status code %d', res.statusCode
    // );

    console.log('Finished request');

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
        , credit = element.find('[id*="CreditSafeLabel"]').text().trim()
        , adjusted, latest;

      console.log('Iterating over project %s', title);

      //
      // Already found project do not process.
      //
      if (id in projects) return console.log('Already found %s', title);

      //
      // Project Graydon rating below threshold.
      //
      if (+(rating.replace(',', '.')) > 2 || +credit < 50) return console.log('High default probability %s', title);

      //
      // Highly speculative or not really profitable project.
      //
      adjusted = interest - 0.9 - 2.0;
      if (adjusted < 2.5) return console.log('Low interest for %s', title);

      console.log('Adding %s to projects with %s', title, id);

      projects[id] = latest = {
        id: id,
        title: title,
        classification: classification,
        rating: rating,
        interest: interest,
        credit: credit,
        adjusted: Math.round(adjusted * 100) / 100,
        months: element.find('[id*="LooptijdLabel"]').text().trim().match(/\d+/)[0]
      };

      console.log('Setting up e-mail for %s', title);

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
          'Creditsafe:' + latest.credit,
          'Graydon PD: '+ latest.rating + '%',
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

      console.log('Sending mail for project %s', latest.title);
      transporter.sendMail(mail, function send(error, response) {
        if (error) return console.log(error);
        console.log('Mail send with new project:', title);
      });
    });
  });
};