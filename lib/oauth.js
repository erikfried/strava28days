var RSVP = require('rsvp');
var request = require('request');
var POST = RSVP.denodeify(request.post);

var CLIENT_ID = process.env.STRAVA_CLIENT_ID;
var CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
module.exports = {
    getToken: function (code) {
        console.log('Getting token for code', code);

        return POST('https://www.strava.com/oauth/token', {
            form: {
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code
            }
        }).then(function (res) {
            console.log('GOT token', res.statusCode);
            return res
        }).catch(function (e) {
            console.error(e);
        });
    }
};
