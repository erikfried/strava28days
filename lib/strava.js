var strava = require('strava-v3');
var RSVP = require('rsvp');

module.exports = {
    listActivities: RSVP.denodeify(strava.athlete.listActivities.bind(strava.athlete))
};