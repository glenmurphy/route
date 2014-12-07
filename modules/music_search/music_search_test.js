var musicSearch =  require('./musicsearch.js');
musicSearch = new musicSearch({
  services : ["spotify"],
  /*PRIVATE*/ echonest_api_key: 'EEAQAFPLA25XJ2F79'
  /*END_PRIVATE
  echonest_api_key: ''
  */
}); 


testQuery(process.argv[2]);
// testQuery("Violator");
// testQuery("call me maybe");
// testQuery("cher");

function testQuery(query) {
  console.log("searching for", query);
  musicSearch.tracksForFreeformQuery(query, logTracks.bind(null, query));
}

function logTracks(query, tracks) {
  console.log("\nQuery:", query);

  for (var i in tracks) {
    var track = tracks[i];
    // console.log(track.artist_name, track.title);
  }
}
