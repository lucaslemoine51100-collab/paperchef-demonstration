const reference = require('./service');
const couscous = require('./couscous');
const lasagnes = require('./lasagnes');
const quiches = require('./quiches');
module.exports = { [reference.id]: reference, [couscous.id]: couscous, [lasagnes.id]: lasagnes, [quiches.id]: quiches };
