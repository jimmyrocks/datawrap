var datawrap = require('../'),
  tape = require('tape');

var config = require('../config').postgres;

console.log('a', !!tape, !!datawrap);

var dw = datawrap(config);

dw.runQuery(['file:///test1.sql']);
