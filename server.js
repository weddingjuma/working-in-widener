var app = require('express')()
, http = require('http')
, server = http.createServer(app)
, io = require('socket.io').listen(server)
, fs = require('fs');

// Load our config
var data = fs.readFileSync('config.json'),
config;

try {
    config = JSON.parse(data);
}
catch (err) {
    console.log('There has been an error parsing the JSON config.')
    console.log(err);
}

// Start node
server.listen(config.node_port);

// Set our express options
app.set("jsonp callback", true);

// Routing handled by express
// Commented out because we're serving this from Apache. Uncomment to serve
// everything from node

app.get('/leader-board.json', function (req, res) {
     res.jsonp(leader_board);
});
/*app.get('/', function (req, res) {
res.sendfile(__dirname + '/static/index.html');
});
app.get('/shelve-game.js', function (req, res) {
res.sendfile(__dirname + '/static/shelve-game.js');
});
app.get('/config.json', function (req, res) {
res.sendfile(__dirname + '/static/config.json');
});

app.get('/widener-8-bit.png', function (req, res) {
res.sendfile(__dirname + '/static/images/widener-8-bit.png');
});*/

// Call numbers used when assigning players their to_shelve list
var wid = ["DP612", "DP614", "DP615", "DP618", "DP621", "Q209", "Q223", "Q224", "Q295", "Q300", "DP622", "DP624", "DP625", "DP627", "DP628","Q305", "Q310", "Q315", "Q310", "Q320", "DP632", "DP635", "DP636", "DP638", "DP639", "Q325", "Q335", "Q336", "Q342", "Q350", "DP640", "DP641", "DP642", "DP646", "DP650", "Q360", "Q365", "Q370", "Q387", "Q390", "PG13", "PG135", "PG510", "M2", "M32", "M1503", "PG14", "PG303", "PG3223", "M21", "M1490", "M1507", "PG127", "PG305", "PG3225", "M24", "M1495", "M1509", "PG129", "PG406", "PG3235", "M25", "M1497", "M1513", "PG133", "PG507", "PG3435", "M30", "M1500", "M1518", "PH101", "PH107", "PH123", "PH124", "PH125", "BR450", "BR470", "BR479", "BR481", "BR500", "PH131", "PH135", "PH139", "PH159", "PH161","BR510", "BR515", "BR516", "BR516.5", "BR517", "PH225", "PH235", "PH241", "PH275", "PH279", "BR520", "BR525", "BR526", "BR530", "BR535", "PH285", "PH300", "PH301", "PH302", "PH303", "BR555", "BR560", "BR563", "BR570", "BR620", "DK403", "DK430", "DK439", "PB2369", "PB2813", "PB2856", "DK404", "DK432", "DK440", "PB2591", "PB2815", "PB2887", "DK411", "DK434", "DK441", "PB2808", "PB2831", "PB2891", "DK418", "DK435.5", "DK443", "PB2809", "PB2837", "PB2905", "DK420", "DK436", "DK448", "PB2811", "PB2839", "PB2931", "PN441", "PN451", "PN452", "PN453", "PN457", "DA3", "DA10", "DA11", "DA13", "DA16", "PN462", "PN466", "PN471", "PN472", "PN479","DA17", "DA18", "DA25", "DA26", "DA27", "PN481", "PN495", "PN500", "PN501", "PN503", "DA27.5", "DA28", "DA28.1", "DA28.2", "DA28.3", "PN504", "PN505", "PN507", "PN508", "PN509", "DA28.4", "DA28.7", "DA30", "DA32", "DA34", "F200", "F273", "F311", "E621", "E647", "E661", "F225", "F285", "F314", "E628", "E649", "E664", "F226", "F286", "F345", "E631", "E655", "E667", "F227", "F289", "F351", "E635", "E656", "E668", "F272", "F310", "F370", "E641", "E660", "E672", "PM731", "PM782", "PM921", "PM987", "PM988", "PS146", "PS147", "PS151", "PS152", "PS157", "PM989", "PM1021", "PM1022", "PM1023", "PM1024","PS163", "PS185", "PS201", "PS208", "PS211", "PM1272", "PM1855", "PM1883", "PM2073", "PM2076", "PS214", "PS221", "PS223", "PS225", "PS229", "PM2135", "PM2342", "PM2501", "PM2591", "PM3007", "PS243", "PS261", "PS271", "PS273", "PS277", "P361", "P375", "P501", "PS301", "PS323.5", "PS350", "P365", "P380", "P505", "PS303", "PS324", "PS351", "P367", "P381", "P511", "PS305", "PS325", "PS352", "P368", "P408", "P512", "PS316", "PS326", "PS369", "P371", "P409", "P525", "PS319", "PS332", "PS371"];

// One or two players to each room. This helps us manage the socket.io messages
var rooms = {};

// Our rooms get filled with objects. Something like:
//{
//  start_time: num seconds since epoch,
//  players: {
//    p1: { position: {b: 2, i: 0, j: 0}, name: "", to_shelve: []},
//    p2: { position: {b: 2, i: 0, j: 1}, name: "", to_shelve: []},
//  }
//}
//
// For efficiency, we package things a bit when we send to client. They
// look for something like this:
// {player_postions: {p1: {b: 2, i: 0, j: 0}, p2: {}}, to_shelve: {p1: [], p2: []}, player_info:{p1: {name: ""}, p2: {name: ""}}};

// We check this to see if there is an open room for a new user
var open_room_id = false;

var num_items_to_shelve = 5;

// Keep our leaderboard in memory. We'll populate it at startup and update after each game.
var leader_board = [];

// If we have a leaderboard on disk, populate our leader_board var;
fs.readFile('leader-board', 'utf8', function (err,data) {
  if (err) {
    return console.log('Unable to load leader-board from disk. I\'ll try to create a new one.');
  }
  
  leader_board = JSON.parse(data);
});

// Socket.io business
//io.set('loglevel',10) // set log level to get all debug messages

/////////// Helpers ///////////

// Shuffle our lists
// Thanks to Jonas Raoni Soares Silva, http://jsfromhell.com/array/shuffle [v1.0]
shuffle = function(o){ //v1.0
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

// Get a pretty time
// Thanks to http://stackoverflow.com/a/8212878
function get_pretty_time(milliseconds){
    var return_string = '';

    var seconds = milliseconds / 1000;

    var numminutes = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    if(numminutes){
        return_string += numminutes + ' min' + ((numminutes > 1) ? 's' : '') + ', ';
    }
    var numseconds = (((seconds % 31536000) % 86400) % 3600) % 60;
    if(numseconds){
        return_string += numseconds.toFixed(3) + ' sec' + ((numseconds > 1) ? 's' : '');
    }
    return return_string;
}
/////////// Helpers ///////////

var add_user = function(socket, solo) {
    // A new user wants to play. If they want to play a solo game,
    // create a room, add it to the global rooms, and send them on their way.
    //
    // If a user wants to play with another person, find an open room (a room
    // with one player wiating for them.) if no open room, create one and they'll
    // wait for a partner
    //
    // return the user's room_id 

    // If user wants to play a solo game
    if (solo === true) {
        var solo_room_id = Math.floor(Math.random()*89999+10000);
        var now = new Date().getTime();
        rooms[solo_room_id] = {start_time: now, players: {}};
        rooms[solo_room_id].players.p1 = { position: {b: 2, i: 0, j: 0}, name: '', to_shelve: []};

        socket.join(solo_room_id);

        room_and_player_details = {room_id: solo_room_id, player_id: 'p1'};

        return room_and_player_details;
    }

    // If a user wants to play with another person, deal with a two player room
    var users_room_id;
    var player_id;

    // Add a second player to a room
    if (open_room_id !== false) {
        users_room_id = open_room_id;
        rooms[users_room_id].players.p2 = { position: {b: 2, i: 0, j: 1}, name: '', to_shelve: []};

        socket.join(users_room_id);
        //socket.emit('player_assignment', 'p2');

        player_id = 'p2';
        open_room_id = false;
    } else { // create a new room id and set it up. Add the user. They'll wait for an opponent.
        open_room_id = Math.floor(Math.random()*89999+10000);
        var now = new Date().getTime();
        rooms[open_room_id] = {start_time: now, players: {}};
        rooms[open_room_id].players.p1 = { position: {b: 2, i: 0, j: 0}, name: '', to_shelve: []};

        users_room_id = open_room_id;
        player_id = 'p1';
        
        socket.join(users_room_id);
        //socket.emit('player_assignment', 'p1');
    }

    room_and_player_details = {room_id: users_room_id, player_id: player_id};

    return room_and_player_details;
};

var build_LibraryCloud_requests = function(finalize_room) {
    // Select a call number from our list of call numbers and fetch one
    // result from LibraryCloud based on that call number

    room_id = arguments[1];

    for (var i = 0; i < num_items_to_shelve; i ++) {

        var rand_index = Math.floor(Math.random() * (279 - 0 + 1)) + 0;

        var call_num = wid[rand_index];

        var options = {
            host: config.lc_host,
            port: 80,
            path: '/v1/api/item/?filter=holding_libs:WID&filter=090a:' + call_num + '&limit=1',
            method: 'GET'
        };

        //console.log('Getting: ' + '/v1/api/item/?filter=holding_libs:WID&filter=090a:' + call_num + '&limit=1');

        // make the request, and then end it, to close the connection
        var req = http.request(options, function(res) {
            // Receive a response from LibraryCloud, pull out the title and call number
            // and add it to our list. Do this num_items_to_shelve times.

            var to_shelve_raw = "";

            // Keep tacking chunks on as we receive them.
            res.on('data', function(chunk) {
                to_shelve_raw += chunk;
            });

            // Finished receiving chunks? If so, package and pass off to our callback, finalize_room
            res.on('end', function() {
                var to_shelve_formatted = JSON.parse(to_shelve_raw);

                var creator = '(No Creator)';

                if (to_shelve_formatted.docs[0].creator[0]) {
                    creator = to_shelve_formatted.docs[0].creator[0];
                }

                // This thing is ugly. We're looping through the players in the room and adding the LibraryCloud doc to heir to_shelve list
                Object.keys(rooms[room_id].players).forEach(function(key) {
                    rooms[room_id].players[key].to_shelve.push({title: to_shelve_formatted.docs[0].title, creator: creator, call_num: to_shelve_formatted.docs[0].source_record['090a']});
                });

                finalize_room(room_id);		
            });


        });

        req.end();
    }
};

var finalize_room = function(room_id) {
    //  If the room has the right number of players and the docs loaded from LibraryCloud, 
    // send a notice to the room occupant(s) so that they can begin playing

    if (num_items_to_shelve === rooms[room_id].players.p1.to_shelve.length) {

        // If we have all of our items to shelve, loop through each player in the room and shuffle them
        Object.keys(rooms[room_id].players).forEach(function(key) {
            var shuffled_items = shuffle(rooms[room_id].players[key].to_shelve);
            rooms[room_id].players[key].to_shelve = shuffled_items;
        });

        var player_positions = {};

        Object.keys(rooms[room_id].players).forEach(function(key) {
            player_positions[key] = rooms[room_id].players[key].position;
        });
        io.sockets.in(room_id).emit('board_update', player_positions);

        // player_info:{p1: {name: ""}, p2: {name: ""}
        var player_info = {};
        var to_shelve = {}

        Object.keys(rooms[room_id].players).forEach(function(key) {
            player_info[key] = {name: rooms[room_id].players[key].name};
            to_shelve[key] = rooms[room_id].players[key].to_shelve;
        });

        // Wave the checkered flag to the occupants of the room. They're ready to play.
        io.sockets.in(room_id).emit('shelve_list', to_shelve);
        io.sockets.in(room_id).emit('ready', player_info);
    }
}

var clean_rooms = function() {
    // If we have any old rooms sitting around, let's kick the folks out and delete the room
    
        Object.keys(rooms).forEach(function(key) {
            var now = new Date().getTime();
            var age = now - rooms[key].start_time;
            
            // If the room is older than 20 minutes, kick everyone out and delete it
            if (age > 1200000) {
                io.sockets.in(key).emit('booted', true);
                var clients = io.sockets.clients(key);                
                for (var i = 0; i < clients.length; i ++) {
                    clients[i].disconnect();
                }

                delete rooms[key];

                if (open_room_id === key) {
                    open_room_id = false;
                }
            }
        });
}

// Set log level to 1. 1 = warn and error
io.set('log level', 1);

io.on('connection', function(socket){

    // Take care of some maintenance whenever we get a new player
    clean_rooms();

    socket.on('move', function (data) {
        // Anytime a client moves on the board, we update the client(s) in the room. (if playing solo
        // the user just broadcasts back to herself)
        if (rooms[data.r]) {
            rooms[data.r].players[data.p].position = {b: data.b, i: data.i, j: data.j, c: data.c};

            // We do some repackaing here to support old code in the client:
            var player_positions = {};

            Object.keys(rooms[data.r].players).forEach(function(key) {
                player_positions[key] = rooms[data.r].players[key].position;
            });

            io.sockets.in(data.r).emit('board_update', player_positions);
        }
    });

    socket.on('start-game-request', function (data) {
        // User has submitted the number of players/username form. They're ready to play
        
        // Add a user to a room
        var room_and_player_details = add_user(socket, data.solo);
        
        //io.sockets.in(room_and_player_details.room_id).emit('assignments', room_and_player_details);
        socket.emit('assignments', room_and_player_details);

        rooms[room_and_player_details.room_id].players[room_and_player_details.player_id].name = data.name;

        // if solo room or if room has two people:
        if (data.solo === true || Object.keys(rooms[room_and_player_details.room_id].players).length === 2 && rooms[room_and_player_details.room_id].players.p1.name !== '' && rooms[room_and_player_details.room_id].players.p2.name !== '') {
            build_LibraryCloud_requests(finalize_room, room_and_player_details.room_id);            
        }
    });

    socket.on('shelved', function (data) {
        // Client has shelved a book. update the client(s) in the room
        
        io.sockets.in(data.r).emit('progress_update', data);
    });

    socket.on('completed', function (data) {
        // If someone in the room has finished shelving all books, record the time in the log and
        // possibly the top scores, send a message out to the client(s) in the room and disconnect them

        // Thanks to http://stackoverflow.com/a/13219636
        var ds = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
        var pretty_time = get_pretty_time(data.elapsed_time);
        var log_message = ds + ' ' + rooms[data.r].players[data.p].name;
        var was_solo_game = true;
        
        var opponent_id = 'p1';
        
        if (Object.keys(rooms[data.r].players).length == 2) {
            was_solo_game = false;
        }
        
        if (!was_solo_game) {

            if (data.p === 'p1') {
                opponent_id = 'p2';
            }
            
            log_message = log_message + ' bested ' + rooms[data.r].players[opponent_id].name;
        } else {
            log_message = log_message + ' won solo';
        }
    
         log_message = log_message + ' in ' + pretty_time + '\n';

        fs.open("matches.log", 'a', 0666, function(err, fd){
            fs.write(fd, log_message, null, undefined, function (err, written) {
            });
        });
        
        // leader board object looks like this:
        //  [
        //      {num_ms: num_ms, play_type: solo, winner: username, date: time_stamp}},
        //      {num_ms: num_ms, play_type: two_player, winner: username, loser: username, date: time_stamp}}
        //  ]

        var now = new Date().getTime();
        var new_record = {num_ms: data.elapsed_time, play_type: 'solo', winner: rooms[data.r].players[data.p].name, date_played: now}
        
        if (!was_solo_game) {
            new_record.play_type = 'two_player'
             new_record.loser = rooms[data.r].players[opponent_id].name
        }
        
        // If we have less 24 or less, just add our score to the list, else, see if it's better
        // than the last score on the list, then sort
        if (leader_board.length <= 24) {
            leader_board.push(new_record);
            // We've added our new record, now sort
            leader_board.sort(function(a,b) { return parseFloat(a.num_ms) - parseFloat(b.num_ms) } );
        } else if (data.elapsed_time < leader_board[leader_board.length - 1].num_ms) {
            leader_board[leader_board.length - 1] = new_record;
            // We've added our new record, now sort
            leader_board.sort(function(a,b) { return parseFloat(a.num_ms) - parseFloat(b.num_ms) } );
        }

        // Write our updated leaderboard to disk for safe keeping
        fs.open("leader-board", 'w', 0666, function(err, fd) {
            var serialized_leader_board = JSON.stringify(leader_board);
            fs.write(fd, serialized_leader_board, null, undefined, function (err, written) {
            });
        });

        io.sockets.in(data.r).emit('winner', {name: rooms[data.r].players[data.p].name, elapsed_time: pretty_time});
        socket.leave(data.r);
        socket.disconnect();
            
        delete rooms[data.r];
    });
})
