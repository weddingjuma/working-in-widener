var app = require('express')()
, http = require('http')
, server = http.createServer(app)
, io = require('socket.io').listen(server)

server.listen(3000)

// routing
app.get('/', function (req, res) {
    res.sendfile(__dirname + '/static/index.html');
});
app.get('/style.css', function (req, res) {
    res.sendfile(__dirname + '/static/style.css');
});
app.get('/shelve-game.js', function (req, res) {
    res.sendfile(__dirname + '/static/shelve-game.js');
});

var wid_b = ["DP612", "DP614", "DP615", "DP618", "DP621", "Q22", "Q224", "Q225", "Q226", "Q227", "DP618", "DP622", "DP624", "DP625", "DP627"];
var player_data = {};
var to_shelve_raw = "";
var to_shelve_formatted;

// Socket.io business
//io.set('loglevel',10) // set log level to get all debug messages

io.on('connection', function(socket){

    var len = Object.keys(player_data).length
    
    if (len === 0) {    
        player_data['p1'] = {b: '1', i: '0', j: '0'};
        socket.emit('player_assignment', 'p1');
    } else if (len === 1) {
        socket.emit('player_assignment', 'p2');
        player_data['p2'] = {b: '1', i: '0', j: '1'};
        // If we have two players, let's load our call number data
        
        var rand_index = Math.floor(Math.random() * (15 - 0 + 1)) + 0;
        var call_num = wid_b[rand_index];
        
        var options = {
          //host: 'librarycloud.harvard.edu',
          host: 'hlsl8.law.harvard.edu',
          port: 80,
          path: '/v1/api/item/?filter=holding_libs:WID&filter=090a:' + call_num + '*&limit=1',
          method: 'GET'
        };
        
        console.log('Getting: ' + '/v1/api/item/?filter=holding_libs:WID&filter=090a:' + call_num + '*&limit=1');

        var processPublicTimeline = function(response) {
          var lc_data = '';

          // keep track of the data you receive
          response.on('data', function(chunk) {
            to_shelve_raw += chunk;
          });

          // finished? ok, write the data to a file
          response.on('end', function() {
              to_shelve_formatted = JSON.parse(to_shelve_raw);
              
              var shelve_list = {p1: [{title: to_shelve_formatted.docs[0].title, call_num: to_shelve_formatted.docs[0].source_record['090a']}],
              p2: [{title: to_shelve_formatted.docs[0].title, call_num: to_shelve_formatted.docs[0].source_record['090a']}]}
              
              io.sockets.emit('shelve_list', shelve_list);
                      io.sockets.emit('board_update', player_data);
          });
        };

        // make the request, and then end it, to close the connection
        http.request(options, processPublicTimeline).end();

    }




    
    socket.on('move', function (data) {
        player_data[data.p] = {b: data.b, i: data.i, j: data.j};
        console.log(player_data);
        // Send to the sender and then to everyone else. You've got to serve the servants.
        //socket.emit('board_update', player_data);
        //socket.broadcast.emit('board_update', player_data);
        io.sockets.emit('board_update', player_data);
    });
})






