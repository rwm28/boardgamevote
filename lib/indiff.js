// Indifference engine library

var seed = require('seed-random');

// Gets results from a clean list of votes
// Results return in format {tally:{'a':1,'b':3}, majority:['b']}
function currentResults(votes) {
    var i, j, tallyKeys,results = {
        tally: {},
        majority: []
    };
    for(i = 0; i < votes.length; i++) {
        vote = votes[i].vote[0];
        for(j = 0; j < vote.length; j++) {
            if(typeof results.tally[vote[j]] === 'number') {
                results.tally[vote[j]]++;
            } else {
                results.tally[vote[j]] = 1;
            }
        }
    }
    Object.keys(results.tally).forEach(function(key) {
        if(results.tally[key] > votes.length / 2) {
            results.majority.push(key);
        }
    });
    return results;
}

// Requires clean votes
function noVotes(vote, results) {
    var i, j, elim = {};
    // Go through all the games in the first vote to find all games with no votes
    for(i = 1; i < vote.length; i++) {
        for(j = 0; j < vote[i].length; j++) {
            if(!results.tally[vote[i][j]]) {
                elim[vote[i][j]] = true;
            }
        }
    }
    return elim;
}

// Takes total items, number of items higher ranked,
// and number of items tied to find the borda value of all those tied items
function bordaValue(total, higher, numTied) {
    return total - higher - (1 + numTied)/2;
}

// Requires clean votes with votes cleaned of all items with no votes
function fewestVotes(votes, results) {
    var i, j, k, vote, elim = {}, higher, minVotes = Number.MAX_VALUE, numItems, bordaElim;
    results = results || currentResults(votes);
    
    // Go through tallies to find everything with the fewest votes
    Object.keys(results.tally).forEach(function(key) {
        if(results.tally[key] < minVotes) {
            minVotes = results.tally[key];
            elim = {};
            elim[key] = true;
        } else if(results.tally[key] === minVotes) {
            elim[key] = true;
        }
    });

    // if there is a tie for fewest votes, modified borda count to choose which ones to eliminate
    if(Object.keys(elim).length > 1) {
        numItems = Object.keys(results.tally).length;
        for(i = 0; i < votes.length; i++) {
            vote = votes[i].vote;
            higher = 0;
            for(j = 0; j < vote.length; j++) {
                for(k = 0; k < vote[j].length; k++) {
                    if(elim[vote[j][k]] === true) {
                        elim[vote[j][k]] = bordaValue(numItems, higher, vote[j].length);
                    } else if(typeof elim[vote[j][k]] === 'number') {
                        elim[vote[j][k]] = elim[vote[j][k]] + bordaValue(numItems, higher, vote[j].length);
                    }
                }
                higher = higher + vote[j].length;
            }
        }
        bordaElim = {};
        minVotes = Number.MAX_VALUE;
        Object.keys(elim).forEach(function(key) {
            if(elim[key] < minVotes) {
                minVotes = elim[key];
                bordaElim = {};
                bordaElim[key] = true;
            } else if(elim[key] === minVotes) {
                bordaElim[key] = true;
            }
        });
        elim = bordaElim;
    }
    return elim;
}

function eliminate(votes, elim, keepInstead) {
    var i, j, k, vote;
    keepInstead = keepInstead || false;
    for(i = 0; i < votes.length; i++) {
        vote = votes[i].vote;
        for(j = 0; j < vote.length; j++) {
            for(k = 0; k < vote[j].length; k++) {
                // Use !== which is equivalent to XOR,
                // ! converts both to booleans and does not affect result
                if(!elim[vote[j][k]] !== !keepInstead) {
                    vote[j].splice(k,1);
                    k--;
                }
            }
            if(vote[j].length === 0) {
                vote.splice(j,1);
                j--;
            }
        }
        votes[i].vote = vote;
    }
    return votes;
}

function irvTieBreaker(votes, results) {
    var i, n, k, tmp, keepers, vote, newResults = results,
        rand = seed(votes[0]._id);
    // Shuffle votes using Fisher–Yates shuffle because they will now have a priority order
    for(n = votes.length - 1; n > 0; n--) {
        k = Math.floor(rand() * (n + 1));
        tmp = votes[k];
        votes[k] = votes[n];
        votes[n] = tmp;
    }
    
    // In order, use each vote as a tiebreaker
    for(i = 0; i < votes.length; i++) {
        vote = votes[i].vote;
        var keepers = {};
        
        vote[0].forEach(function(game){
            keepers[game] = true;
        })
        // Only eliminate if you are eliminating something but not everything
        if(Object.keys(keepers).length > 0 && Object.keys(keepers).length < Object.keys(newResults.tally).length) {
            votes = eliminate(votes, keepers, true);
            newResults = currentResults(votes);
        }
        if(newResults.majority.length === 1) {
            results.winner = newResults.majority[0];
            return results;
        }
    }

    if(newResults.majority.length > 1) {
        results.winner = newResults.majority[Math.floor(rand() * newResults.majority.length)];
    } else {
        results.winner = Object.keys(newResults.tally)[Math.floor(rand() * Object.keys(newResults.tally).length)];
    }

    return results;
}

// Assumes data will be a list of vote objects from the database each with an _id and a vote array containing the actual vote
exports.instantRunoff = function (votes) {
    var elim, results = currentResults(votes), previousResults = [];
    elim = noVotes(votes[0].vote, results);
    votes = eliminate(votes, elim);
    while(results.majority.length !== 1) {
        elim = fewestVotes(votes, results);
        if(Object.keys(elim).length > 0 && Object.keys(elim).length < Object.keys(results.tally).length) {
            votes = eliminate(votes, elim);
        } else {
            results.previousResults = previousResults;
            return irvTieBreaker(votes, results);
        }
        previousResults.push(results);
        results = currentResults(votes);
    }
    results.previousResults = previousResults;
    results.winner = results.majority[0];
    return results;
}

function tieBreaker(votes, tied) {
    var i, n, k, tmp, keepers, vote, tmpName,
        rand = seed(votes[0]._id), result = {tieBreakers: []};
    // Shuffle votes using Fisher–Yates shuffle because they will now have a priority order
    for(n = votes.length - 1; n > 0; n--) {
        k = Math.floor(rand() * (n + 1));
        tmp = votes[k];
        votes[k] = votes[n];
        votes[n] = tmp;
    }
    
    // In order, use each vote as a tiebreaker
    for(i = 0; i < votes.length; i++) {
        tmpName = votes[i].nickname || "Anonymous";
        result.tieBreakers.push(tmpName);
        vote = votes[i].vote;
        var keepers = vote[0].filter(function(n) {
            return tied.indexOf(n) != -1;
        });

        if(keepers.length === 1) {
            result.winner = keepers[0];
            return result;
        } else if(keepers.length === tied.length) {
            continue;
        } else if(keepers.length > 0) {
            tied = keepers;
        }
    }
    result.tieBreakers.push('Random');
    result.winner = tied[Math.floor(rand() * tied.length)];
    return result;
}

// Assumes data will be a list of vote objects from the database each with an _id and a vote array containing the actual vote
exports.minimaxPairwiseOpposition = function (votes) {
    // Current minimax x object is {X_ID:{max: NUMBER, nextMax: NUMBER, y:{Y_ID: NUMBER}}
    var x = {},
        min = Number.MAX_VALUE,
        result = {}, current, i, xj, xk, yj, yk, vote, tieBreakResults;

    for(i = 0; i < votes.length; i++) {
        vote = votes[i].vote;
        for(xj = vote.length-1; xj >= 0; xj--) {
            for(xk = 0; xk < vote[xj].length; xk++) {
                if(!x[vote[xj][xk]]) {
                    x[vote[xj][xk]] = {max: 0, nextMax: 0, y:{}};
                }
                for(yj = 0; yj < xj; yj++) {
                    for(yk = 0; yk < vote[yj].length; yk++) {
                        if(!x[vote[xj][xk]].y[vote[yj][yk]]) {
                            x[vote[xj][xk]].y[vote[yj][yk]] = 1;
                        } else {
                            x[vote[xj][xk]].y[vote[yj][yk]]++;
                        }
                        // Currently next max is not used until I further investigate
                        if(x[vote[xj][xk]].y[vote[yj][yk]] <= x[vote[xj][xk]].max && x[vote[xj][xk]].y[vote[yj][yk]] > x[vote[xj][xk]].nextMax) {
                            x[vote[xj][xk]].nextMax = Math.max(x[vote[xj][xk]].nextMax, x[vote[xj][xk]].y[vote[yj][yk]]);
                        }
                        x[vote[xj][xk]].max = Math.max(x[vote[xj][xk]].max, x[vote[xj][xk]].y[vote[yj][yk]]);
                    }
                }
            }
        }
    }
    Object.keys(x).forEach(function(candididateId) {
        if(x[candididateId].max < min) {
            min = x[candididateId].max;
            current = [candididateId];
        } else if(x[candididateId].max == min) {
            current.push(candididateId);
        }
    });
    if(current.length === 1) {
        result.winner = current[0];
        return result;
    }
    result.tied = current.slice(0);
    tieBreakResults = tieBreaker(votes, current);
    result.winner = tieBreakResults.winner;
    result.tieBreakers = tieBreakResults.tieBreakers;
    return result;
}

exports.maximizeAffirmedMajorities = function (votes) {
//sauce: http://alumnus.caltech.edu/~seppley/MAM%20procedure%20definition.htm

	var Vyx = {}, majorities = [], candidates = [], pairs = [], finishOver = {}, maj={}, topAlternatives = [],
	i, j, x, y, xj, xk, yj, yk,
	vote, tiebreak;

	/*'votes' is an array of ballot objects, with fields '_id', 'vote', 'nickname', and 'ballot'. votes[0].vote is the vote object for the first ballot. A vote object is an array
	of arrays of arbitrary length, containing all candidates voted on that ballot in ranked order, with ties allowed. votes[0].vote[0] is an array of all candidates ranked first
	on the first ballot. votes[2].vote[1] is an array of all candidates ranked second on the third ballot, and so on. votes[2].vote[1][0] is the first candidate value from that
	array.
	Candidates are string values. In our initial case, candidate strings refer to boardgamegeek.com game ID numbers.*/
	
	//Construct the vote count table Vyx by counting the votes
	for(i = 0; i < votes.length; i++) { //iterate through all ballots
		vote = votes[i].vote;
		for(xj = vote.length-1; xj >=0; xj--) { //start at the bottom of the ballot and work up
			for(xk = 0; xk < vote[xj].length; xk++) { //step through each candidate of rank xj
				if(!Vyx[vote[xj][xk]]) { // call vote[xj][xk] 'candidate X'. Hash candidate X to vote count table V; if candidate X hasn't been counted yet, create in vote count table
					Vyx[vote[xj][xk]] = {yx: {}}; //initialize a 'Vyx' object for counting pairwise defeats of candidate Y over candidate X
				}
				for(yj = 0; yj < xj; yj++) { //step through all candidates on this ballot ranked higher than candidate X
					for(yk = 0; yk < vote[yj].length; yk++) {
						if(!Vyx[vote[xj][xk]].yx[vote[yj][yk]]) { //Call vote[yk][yj] 'candidate Y'. Hash this y-candidate to Vyx, to count the number of pairwise defeats of candidate Y over candidate X
							Vyx[vote[xj][xk]].yx[vote[yj][yk]] = 1; //initialize Vyx to 1 if it didn't already exist;
						}
						else {
							Vyx[vote[xj][xk]].yx[vote[yj][yk]]++; //otherwise increment Vyx.yx
						}
					}
				} 
			}
		}
	} //when this loop is done, Vyx is the vote table. Vyx[vote[xj][xk]].yx[vote[yj][yk]] is the number of pairwise defeats for candidate vote[yj][yk] over candidate vote[xj][xk].
	
	//construct and sort a list of majorities. I think you have to do the above quad-loop completely before starting this one, because you need the final pairwise vote tallies.
	candidates = Object.keys(Vyx); //candidates is an array of all the keys from Vxy, which means it's an array of all candidate IDs with at least one pairwise vote against. This is probably not elegant but I'm going with it.
	
	//populate majorities[] as a 1D array because I'm not smart enough to manipulate JS objects directly
	for(x = 0; x < candidates.length; x++) {
		pairs = Object.keys(Vyx[candidates[x]].yx) //pairs is an array of all the candidate IDs with at least one pairwise vote over candidates[x]. Also probably not elegant.
		for(y = 0; y < pairs.length; y++) {
			if(Vyx[candidates[x]].yx[pairs[y]] > Vyx[pairs[y]].yx[candidates[x]]) {
				majorities.push({xid: candidates[x], yid: pairs[y], count: Vyx[candidates[x]].yx[pairs[y]]}) //majorities[i].count is the number of pairwise votes for majorities[i].yid over majorities[i].xid
			}
			else if(Vyx[candidates[x]].yx[pairs[y]] < Vyx[pairs[y]].yx[candidates[x]]) {
				majorities.push({xid: pairs[y], yid: candidates[x], count: Vyx[pairs[y]].yx[candidates[x]]}) //majorities[i].count is the number of pairwise votes for majorities[i].yid over majorities[i].xid
			} //this if/else if set is done according to Seppley's definition of populating the majorities list for MAM. Note that if Vxy === Vyx then there is no majority for that pair and nothing is appended to the list.
		}
	}
	
	//populate tiebreak array with a strictly ordered list of candidates based on Random Voter Hierarchy (RVH). Needed for sorting the list of majorities.
	tiebreak = randomVoterHierarchy(Vyx); //RVH is not implemented yet so the placeholder function just returns the candidates in whatever order they happen to appear using Object.keys(Vyx)
	
	//sort majority pairs; define sort function inline because I need to reference Vyx and tiebreak and I don't know how to pass them if I define a separate sort function.
	//sort function sauce: http://stackoverflow.com/questions/1129216/sorting-objects-in-an-array-by-a-field-value-in-javascript
	majorities.sort(function (a,b) { //a and b are y-over-x pairwise vote objects of the form {xid: [downvoted candidate id], yid: [upvoted candidate id], count: [votes for y over x]}
		/* Sorting sauce, from Seppley (with my notes):
		 * Sort the list of Majorities, primarily from largest majority to smallest majority:
		 * To be more specific, a majority for x over y precedes a majority for z over w
		 * if and only if at least one of the following conditions holds:
		 * 1.  Vxy > Vzw.
		 * 2.  Vxy = Vzw and Vwz > Vyx.
		 * 3.  Vxy = Vzw and Vwz = Vyx and Tiebreak ranks w over y.
		 * 4.  Vxy = Vzw and Vwz = Vyx and w = y and Tiebreak ranks x over z.
		 *
		 *
		 * Seppley's notation and mine use 'x' and 'y' slightly differently.
		 * Therefore, to map above notes to below functions, use the following definitions:
		 * x = a.yid; y = a.xid; z = b.yid; w = b.xid;
		 * and:
		 * 'Vxy' = Vyx[y].yx[x] = Vyx[a.xid].yx[a.yid]
		 * 'Vzw' = Vyx[w].yx[z] = Vyx[b.xid].yx[a.yid]
		 * 'Vyx' = Vyx[x].yx[y] = Vyx[a.yid].yx[a.xid]
		 * 'Vwz' = Vyx[z].yx[w] = Vyx[b.yid].yx[b.xid]
		 * This also leads to Vxy = a.count and Vzw = b.count. Vwz and Vyx have to be looked up from my original Vyx object.
		 * 
		 * This is super confusing. sorry.
		 */
		
		if(a.count > b.count) {return -1;}
		if(a.count < b.count) {return 1;}
		if(a.count === b.count && Vyx[b.yid].yx[b.xid] > Vyx[a.yid].yx[a.xid]) {return -1;}
		if(a.count === b.count && Vyx[b.yid].yx[b.xid] < Vyx[a.yid].yx[a.xid]) {return 1;}
		
		var ix, iy, iz, iw;
		
		for(i=0; i<tiebreak.length; i++) {
			switch(tiebreak[i]) {
				case a.yid:
					ix = i;
					break;
				case a.xid:
					iy = i;
					break;
				case b.yid:
					iz = i;
					break;
				case b.xid:
					iw = i;
					break;
			}
		}
		
		if(a.count === b.count && Vyx[b.yid].yx[b.xid] === Vyx[a.yid].yx[a.xid] && iw < iy) {return -1;}
		if(a.count === b.count && Vyx[b.yid].yx[b.xid] === Vyx[a.yid].yx[a.xid] && iw > iy) {return 1;}
		if(a.count === b.count && Vyx[b.yid].yx[b.xid] === Vyx[a.yid].yx[a.xid] && iw === iy && ix < iz) {return -1;}
		if(a.count === b.count && Vyx[b.yid].yx[b.xid] === Vyx[a.yid].yx[a.xid] && iw === iy && ix > iz) {return 1;}
		
		return 0;
	});
	
	//initialize finishOver array to x by y, all false
	for(y = 0; y < candidates.length; y++) {
		finishOver[candidates[y]] = {YoverX: {}}; //Y over X based on how Vyx was originally constructed. I should probably change this.
		pairs = Object.keys(Vyx[candidates[y]].yx);
		for(x = 0; x < pairs.length; x++) {
			finishOver[candidates[y]].YoverX[pairs[x]] = false;
		}
	}  
	
	//conditionally affirm majorities in majorities[] according to Seppley
	for(i = 0; i < majorities.length; i++) {
		maj = majorities[i];
		//conditionally affirm the majority represented by majority[i], which remember is Y OVER X. This is confusing, sorry. I should probably change it.
		if(!finishOver[maj.xid].YoverX[maj.yid] && !finishOver[maj.yid].YoverX[maj.xid]) {
           finishOver = affirm(candidates, finishOver, maj.yid, maj.xid); //if finishOver is passed by reference, then the assignment is unnecessary, but hey, why not
        }
	}
    
    //construct list of top alternatives: list of all alternatives y such that finishOver[x].YoverX[y] is not true for any alternative x.
    for(y = 0; y < candidates.length; y++) {
        var promote = true;
        for(x = 0; x < candidates.length; x++) {
            if(promote && y != x && finishOver[candidates[x]].YoverX[candidates[y]]) {
                promote = false;
            }
        }
        
        if(promote) { topAlternatives.push(candidates[y]); }
    }
    
    //return the winner! if topAlternatives.length === 1, that's the winner; otherwise choose the top-ranking alternative from tiebreak.
    if(topAlternatives.length === 1) { return topAlternatives[0]; }
    
    var min = Number.MAX_VALUE;
    for(i = 0; i < topAlternatives.length; i++) {
        for(j = 0; j < tiebreak.length; j++) {
            if(tiebreak[j] === topAlternatives[i] && j < min) {
                min = j;
            }
        }
    }
    
    return topAlternatives[min];
}

//affirm majority Y over X in affirmation table finishOver[yid].YoverX[xid]
function affirm(candidates, finishOver, yid, xid) {
    
    finishOver[yid].YoverX[xid] = true;
    var a;
    
    for(i = 0; i < candidates.length; i++) {
       a = candidates[i];
        if(finishOver[a].YoverX[yid] && !finishOver[a].YoverX[xid]) {
            return affirm(candidates, finishOver, a, xid);
        }
       
        if(finishOver[xid].YoverX[a] && !finishOver[yid].YoverX[a]) {
           return affirm(candidates, finishOver, yid, a);
        }
    }
    
    return finishOver;
}


//implement Random Voter Hierarchy algorithm from MAM definition (see sauce above). Return a strictly ordered list of candidates for tiebreaking purposes.
function randomVoterHierarchy(Vyx) { //expects Vyx ballot table generated in exports.maximizeAffirmedMajorities
	
	var rvh = [], candidates = [], pickord = {},
        i, idx, done = false, ordCount, pickedCount;
    
	candidates = Object.keys(Vyx);
	
	//initialize pickord{} object; set .picked and .ordered to false for all candidate IDs. 
	for(i = 0; i < candidates.length; i++) {
		pickord[candidates[i]] = {picked: false, ordered: false};
	}
	
	while(!done) { //continue until rvh[] is a strictly ordered list of alternatives
		
		//if there are unpicked ballots...
		if(pickedCount < candidates.length) {
			//...then randomly pick an unpicked ballot, and mark it picked
			do {
			idx = Math.floor(candidates.length * Math.random());
			} while(!pickord[candidates[idx]].picked);
			
			pickord[candidates[idx]].picked = true;
			pickedCount++;
			
			//i think i need to tag PAIRS as ordered, not candidates...might need to pull majorities[]
			
		}
		//if there are no unpicked ballots, randomly order any unordered candidates.
		else {
			
		}
		
		ordCount = 0;
		candidates.forEach(function(candididateId) {
			if(pickord[candidateID].ordered) {ordCount++;}
			if(ordCount === candidates.length) {done = true;}
        });
	}
	
    
	
    
	//return rvh;
	return Object.keys(Vyx); //remember to remove this!
}