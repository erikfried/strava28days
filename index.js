var strava = require('./lib/strava');
var oauth = require('./lib/oauth');

console.log('ENV', process.env);

function getRunMeters(payload) {
    if (!typeof payload === 'array') {
        console.error('Not an array', payload);
        process.exit(1);
    }
    var runs = payload.filter(function (activity) {
        return activity.type === 'Run';
    });
    return runs.reduce(function (ack, run) {
        return ack += run.distance;
    }, 0);

}

function getLast28StravaDays(token) {
    var twentyEightDaysAgo = Math.round((new Date().getTime() - 1000 * 3600 * 24 * 28) / 1000);
    return strava.listActivities({
        after: twentyEightDaysAgo,
        access_token: token
    });
}

var express = require('express');
var app = express();

app.use(require('cookie-parser')());
app.use(require('helmet')());

var COOKIE_NAME = 'strvtkn';
var OAUTH_INIT_PATH = '/oauth/init';
var PORT = process.env.PORT || 3000;
var APP_HOST = process.env.APP_HOST || 'http://localhost:' + PORT;

app.use(function checkKnownUser(req, res, next) {
    console.log('req', req.cookies);
    if (req.cookies[COOKIE_NAME]) {
        //ok
        next();
    } else if (!req.query.code) {
        res.redirect('https://www.strava.com/oauth/authorize?client_id=' + process.env.STRAVA_CLIENT_ID +
        '&response_type=code' +
        '&redirect_uri=' + APP_HOST + OAUTH_INIT_PATH)
    } else if (req.query.code) {
        console.log('New session!');
        next();
    } else {
        console.warn('Unexpected', req.url);
    }
});
app.get(OAUTH_INIT_PATH, function initUser(req, res) {
    console.log('Init oauth', req.query.code);
    oauth.getToken(req.query.code)
        .then(function (tokenResponse) {
            var body = JSON.parse(tokenResponse.body);
            if (tokenResponse.statusCode === 200) {
                res.cookie(COOKIE_NAME, body.access_token, { maxAge: 60 * 60 * 24 * 365 });
                res.redirect('/');
            } else {
                throw {
                    code: tokenResponse.statusCode, response: tokenResponse.body
                };
            }
        })
        .catch(function (e) {
            console.error('Error exchanging code for token', e);
            res.status(500).send('Error exchanging code for token');
        })
});

app.get('/', function displayData(req, res) {
    getLast28StravaDays(req.cookies[COOKIE_NAME]).then(function (data) {
        console.log('Got data', data);
        res.send(200, Math.round(getRunMeters(data) / 1000));
    }).catch(function(e) {
        console.error('ERROR', e);
        system.exit(1);
    })
});

var server = app.listen(PORT, function () {

    var host = server.address().address
    var port = server.address().port
    console.log('Example app listening at http://%s:%s', host, port)
});
