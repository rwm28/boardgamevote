//var _ = require('underscore'); //look at this again, this is probably not how this works

exports.maximizeAffirmedMajorities = function (votes) {
//sauce: http://alumnus.caltech.edu/~seppley/MAM%20procedure%20definition.htm

	var Vyx = {}, majorities = [], candidates = [], pairs = [], finishOver = {},
	i, x, y, xj, xk, yj, yk,
	vote, tiebreak maj={};

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
	} //when this loop is done, V is the vote table. V[vote[xj][xk]].yx[vote[yj][yk]] is the number of pairwise defeats for candidate vote[yj][yk] over candidate vote[xj][xk].
	
	//construct and sort a list of majorities. I think you have to do the above quad-loop completely before starting this one, because you need the final pairwise vote tallies.
	candidates = _.keys(Vyx); //candidates is an array of all the keys from Vxy, which means it's an array of all candidate IDs with at least one pairwise vote against. This is probably not elegant but I'm going with it.
	
	//populate majorities[] as a 1D array because I'm not smart enough to manipulate JS objects directly
	for(x = 0; x < candidates.length; x++) {
		pairs = _.keys(Vyx[candidates[x]].yx) //pairs is an array of all the candidate IDs with at least one pairwise vote over candidates[x]. Also probably not elegant.
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
	tiebreak = randomVoterHierarchy(Vyx); //RVH is not implemented yet so the placeholder function just returns the candidates in whatever order they happen to appear using _.keys(Vyx)
	
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
	})
	
	//initialize finishOver array to x by y, all false
	for(y = 0; y < candidates.length; y++) {
		finishOver[candidates[y] = {YoverX: {}}; //Y over X based on how Vyx was originally constructed. I should probably change this.
		pairs = _.keys(Vyx[candidates[y]].yx);
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
	
	
}

function affirm(candidates, finishOver, yid, xid) { //affirm majority Y over X in affirmation table finishOver[yid].YoverX[xid]
    
    finishOver[yid].YoverX[xid] = true;
    var aid = candidates[i];
    
    for(i = 0; i < candidates.length; i++) {
        if(finishOver[aid].YoverX[yid] && !finishOver[aid].YoverX[xid]) {
            affirm(candidates, finishOver, aid, xid);
        }
       
        if(finishOver[xid]YoverX[aid] && !finishOver[yid].YoverX[aid]) {
            affirm(candidates, finishOver, yid, aid);
        }
    }
    
}


//implement Random Voter Hierarchy algorithm from MAM definition (see sauce above). Return a strictly ordered list of candidates for tiebreaking purposes.
function randomVoterHierarchy(Vyx) { //expects Vyx ballot table generated in exports.maximizeAffirmedMajorities
	
	//var rvh = [], i;
	//I will do this section soon!
	
	return _.keys(Vyx);
}
