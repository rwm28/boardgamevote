//
// Ballots database interactions
//
var ObjectID = require('mongodb').ObjectID,
    xml2js = require('xml2js'),
    request = require('request'),
    config = require('../../config.js');

exports.post = {
    index: function(req, res){
        var body = req.body, i, id = new ObjectID();
        req.db.collection('ballot', function(er, collection) {
            collection.insert({_id: id, games: body.ballot, name: body.name}, {w: 1}, function(er,rs) {
                res.json({redirect:'/ballot/' + id.toHexString() + '/vote'});
            });
        });
    }
};

//
// GET ballot main index.
//
exports.index = function(req, res){
    req.db.collection('ballot', function(er, collection) {
        collection.find().sort({$natural:-1}).limit(40).toArray(function(err, ballots) {
            ballots.forEach(function(ballot, j){
                ballots[j].created = ballot.created || ballot._id.getTimestamp().toLocaleString();
                ballots[j].name = ballot.name || ballot._id.toHexString();
            });
            res.render('ballots', {staticUrl: config.staticUrl, ballots: ballots});
        });
    });
};

//
// Create a new ballot
//
exports.create = function(req, res){
    var parser = new xml2js.Parser();
    request.get('http://www.boardgamegeek.com/xmlapi2/collection?username=dagreenmachine&own=1', function (error, response, body) {
        if (!error && response.statusCode == 200) {
            parser.parseString(body, function (err, result) {
                res.render('ballot', {staticUrl: config.staticUrl, action: '/api/ballot', games: result.items.item});
            });
        }
    });
};