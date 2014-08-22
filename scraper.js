#!/usr/bin/env node

'use strict';

var request = require('request')
  , cheerio = require('cheerio')
  , fs = require('fs')
  , ratings = {
      BBB: 1.24,
      A: 0.62,
      AA: 0.3,
      AAA: 0.15
    };

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
    if (error || res.statusCode !== 200) return; // ignore errors

    var $ = cheerio.load(body)
      , data = $('.startpaginaprojects .projectInfo');

    if (!data) return;
    data.each(function each(i, project) {
      var element = $(this)
        , id = element.find('.button').attr('href').match(/\d+/)[0]
        , classification = element.find('[id*="ClassificatieLabel"]').text().trim()
        , rating = element.find('[id*="GraydonRatingLabel"]').text().trim()
        , interest = parseFloat(element.find('[id*="RenteLabel"]').text().trim().slice(0, -1).replace(',', '.'))
        , adjusted;

      //
      // Already found project do not process.
      //
      if (id in projects) return;

      //
      // Project Graydon rating below threshold.
      //
      if (!~Object.keys(ratings).indexOf(rating)) return;

      //
      // Highly speculative or not really profitable project.
      //
      adjusted = interest - 0.9 - 2.0 - ratings[rating];
      if (classification === '5s' || adjusted < 4) return;

      projects[id] = {
        id: id,
        title: element.find('[id*="ProjectNaamLabel"]').text().trim(),
        classification: classification,
        rating: rating,
        interest: interest,
        adjusted: Math.round(adjusted),
        months: element.find('[id*="LooptijdLabel"]').text().trim().match(/\d+/)[0]
      };
    });

    try {
      fs.writeFile(__dirname + '/results.json', JSON.stringify(projects), function saved() {
        console.log('Results written to results.json');
      });
    } catch(e) {
      // ignore error
    }
  });
};