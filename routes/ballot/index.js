//
// Ballot database interactions
//
var ObjectID = require('mongodb').ObjectID,
    indiff = require('../../lib/indiff');

exports.before = function(req, res, next, id){
    req.db.collection('ballot', function(er, collection) {
        collection.findOne({_id: new ObjectID.createFromHexString(id)}, function(err, ballot) {
            if (!ballot) return next(new Error('Ballot not found'));
            req.ballot = ballot;
            next();
        });
    });
};

function cleanBallot(ballotBody) {
    var i = 0, games = [];
    while(ballotBody['game_' + i + '_name'] && ballotBody['game_' + i + '_name'] !== '') {
        games.push({
            name: ballotBody['game_' + i + '_name'],
            id: ballotBody['game_' + i + '_id']
        });
        i++;
    }
    return games;
}

exports.create = function(req, res){
    var body = req.body, i, id = new ObjectID();

    req.db.collection('ballot', function(er, collection) {
        collection.insert({_id: id,'games': cleanBallot(body)}, {w: 1}, function(er,rs) {
            res.redirect('/');
        });
    });
};

/*
 * GET ballot main index.
 */
exports.index = function(req, res){
    res.render('ballot', {action: 'ballot'});
};

/*
 * GET ballot page.
 */
exports.show = function(req, res){
    console.log(req.ballot);
    req.db.collection('vote', function(er, collection) {
        collection.find({ballot: req.ballot._id}).toArray(function(er,votes) {
            var results, games = [], winner = '';
            results = indiff.instantRunoff(votes);

            req.ballot.games.forEach(function(game){
                var i, gameResults = {name: game.name, votes:[]};
                for(i = 0; i < results.previousResults.length; i++) {
                    if(results.previousResults[i].tally[game.id]) {
                        gameResults.votes.push(results.previousResults[i].tally[game.id]);
                    } else {
                        gameResults.votes.push('Eliminated');
                        break;
                    }
                }
                if(results.tally[game.id]) {
                    gameResults.votes.push(results.tally[game.id]);
                } else if (gameResults.votes[gameResults.votes.length-1] !== 'Eliminated') {
                    gameResults.votes.push('Eliminated');
                }
                if(game.id === results.winner) {
                    winner = game.name;
                }
                games.push(gameResults);
            });
            res.render('tally', {games: games, winner: winner});
        });
    });
};