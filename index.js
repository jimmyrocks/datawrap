var returnValue = require('./src/datawrap');
returnValue.Bluebird = require('Bluebird');
returnValue.fandlebars = require('fandlebars');
returnValue.mockingbird= require('./src/mockingbird');
returnValue.runList = require('./src/runList');
module.exports = returnValue;
