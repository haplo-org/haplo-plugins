/* Haplo Plugins                                      http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var VALID_USERNAME_REGEXP = /^[a-zA-Z0-9_]{1,15}$/;

// --------------------------------------------------------------------------

var createTwitterUsernameValue = P.implementTextType("haplo:twitter", "Twitter username", {
    string: function(value) {
        return value[0];
    },
    indexable: function(value) {
        return value[0];
    },
    identifier: function(value) {
        return value[0];
    },
    render: function(value) {
        return P.template("twitter-username").render({
            username: value[0]
        });
    },
    $setupEditorPlugin: function(value) {
        P.template("include-editor-plugin").render();   // hack to include client side support
    }
});

// --------------------------------------------------------------------------

var Twitter = {
    createTwitterUsernameValue: function(username) {
        if((typeof(username) === 'string') && VALID_USERNAME_REGEXP.test(username)) {
            return createTwitterUsernameValue([username]);
        } else {
            throw new Error("Bad Twitter username");
        }
    }
};

// --------------------------------------------------------------------------

P.provideFeature("haplo:twitter", function(plugin) {
    plugin.Twitter = Twitter;
});

