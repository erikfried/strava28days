
var strava = require('./lib/strava');
var oauth = require('./lib/oauth');
var _ = require('lodash');
var moment = require('moment');

function getLastStravaDays(token, startMoment) {
    return strava.listActivities({
        after: startMoment.unix(),
        access_token: token
    }).then(function groupByActivity (activities) {
        return _.groupBy(activities, 'type')
    });
}

function metersToKms (number) {
    return (Math.round(number /100)) /10
}

function fillDates(days, startMoment, endMoment) {
    var dates = [];
    var interval = endMoment ? endMoment.diff(startMoment, 'days') : 28;
    var current = startMoment, i, value;
    for (i = 0; i < interval; i++) {
        value = days[current.format('YYYY-MM-DD')] || 0;
        dates.push(metersToKms(value));
        current = current.add(1, 'days');
    }
    return dates;
}

function calcStats (startMoment) {
    return function (activitiesByType) {
        return _.transform(activitiesByType, function (result, activities, type) {
            var _days =  _.chain(activities)
                .groupBy(function getActivityStartDate (activity) {
                    return activity.start_date.substring(0,10);
                })
                .mapValues(function sumAllDistancesForDay(dayActivities) {
                    return _.reduce(dayActivities, function addDistance(sum, act){
                        return sum + act.distance
                    }, 0);
                });

            result[type] = {
                longest: metersToKms(_days
                    .values()
                    .max()
                    .value()),
                total: metersToKms(_days
                    .reduce(function (sum, activity) { return sum + activity;})
                    .value()),
                climb: Math.round(_.reduce(activities, function (sum, activity) { return sum + activity.total_elevation_gain }, 0)),
                days: fillDates(_days.value(), startMoment)
            }
        });
    };
};

function getToken(req) {
    return req.cookies[COOKIE_NAME] || req.query.token;
}

var express = require('express');
var app = express();
app.set('view engine', 'jade');

app.use(require('cookie-parser')());
app.use(require('express-session')({
    resave: false,
    saveUninitialized: false,
    secret: process.env.SESSION_SECRET || 'asdf'
}));
app.use(require('connect-flash')());
app.use(require('helmet')());
app.use(express.static('public', {}));

var COOKIE_NAME = 'strvtkn';
var OAUTH_INIT_PATH = '/oauth/init';
var PORT = process.env.PORT || 3000;
var APP_HOST = process.env.APP_HOST || 'http://localhost:' + PORT;

// MIDDLEWARE
//Check user status
app.use(function checkKnownUser(req, res, next) {
    console.log('req', req.cookies);
    if (getToken(req)) {
        //ok
        next();
    } else if (!req.query.code) {
        var authUrl = 'https://www.strava.com/oauth/authorize?client_id=' + process.env.STRAVA_CLIENT_ID +
            '&response_type=code' +
            '&redirect_uri=' + APP_HOST + OAUTH_INIT_PATH;
        console.log(authUrl);
        res.render('index', {
            authUrl: authUrl
        });
    } else if (req.query.code) {
        console.log('New session!');
        next();
    } else {
        console.warn('Unexpected', req.url);
    }
});
app.use(function(err, req, res, next){
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

//ROUTES
app.get(OAUTH_INIT_PATH, function initUser(req, res) {
    console.log('Init oauth', req.query.code);
    oauth.getToken(req.query.code)
        .then(function (tokenResponse) {
            var body = JSON.parse(tokenResponse.body);
            if (tokenResponse.statusCode === 200) {
                res.cookie(COOKIE_NAME, body.access_token, { maxAge: 60 * 60 * 24 * 365 * 1000 }); //Express uses millis for maxAge.
                req.flash('token', body.access_token);
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
    var twentyEightDaysAgo = moment()
        .startOf('day')
        .subtract(27, 'days');
    getLastStravaDays(getToken(req), twentyEightDaysAgo)
        .then(calcStats(twentyEightDaysAgo))
        .then(function (data) {
            var token = req.flash('token');
            console.log('Got data', data, token);
            res.render('stats', {data: data, token: token});
        })
        .catch(function (e) {
            console.error('ERROR', e);
            res.status(500).send('Error rendering stats');
        });
});

//STARTUP
var server = app.listen(PORT, function () {
    var host = server.address().address
    var port = server.address().port
    console.log('Example app listening at http://%s:%s', host, port)
});
