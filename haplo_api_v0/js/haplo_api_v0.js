/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.provideFeature("haplo:api-v0:responder", function(plugin) {
    plugin.apiAllowedAction = apiAllowedAction;
    plugin.respondToAPI = respondToAPI;
});

// --------------------------------------------------------------------------

var apiAllowedAction = function(action) {
    this.$apiAllowedAction = action;
};

// --------------------------------------------------------------------------

var respondToAPI = function(methods, path, argDeclarations, handler) {
    this.respond(methods, path, argDeclarations, function(E) {
        let api = new API(E);

        let action = this.$apiAllowedAction;
        if(!action) { throw new Error("P.apiAllowedAction() must set allowed action."); }
        if(!O.currentUser.allowed(action)) {
            return api.error("haplo:api-v0:generic:not-permitted", "User is not permitted to use this API", HTTP.UNAUTHORIZED);
        }

        var handlerArgs = Array.prototype.slice.call(arguments);
        handlerArgs[0] = api;   // replace E with the API object
        try {
            handler.apply(this, handlerArgs);
        } catch(e) {
            api.error("haplo:api-v0:generic:exception", e.message);
        }
        if(!api.$haveResponded) {
            api.error("haplo:api-v0:generic:no-response", "API implementation did not respond", HTTP.NOT_FOUND);
        }
    });
};

// --------------------------------------------------------------------------

// In debugging mode, output pretty JSON
var toJSON = O.PLUGIN_DEBUGGING_ENABLED ?
    (o) => JSON.stringify(o,undefined,2) :
    (o) => JSON.stringify(o);

// --------------------------------------------------------------------------

var API = function(E) {
    this.E = E;
    this.$response = {};
};

API.prototype.respondWith = function(name, details) {
    this.$response[name] = details;
};

API.prototype._respond = function(response, statusCode) {
    if(this.$haveResponded) { throw new Error("Double response"); }
    this.E.response.statusCode = statusCode || HTTP.OK;
    this.E.response.kind = 'json';
    this.E.response.body = toJSON(response);
    this.$haveResponded = true;
};

API.prototype.success = function(kind) {
    let response = this.$response;
    response.success = true;
    response.kind = kind;
    this._respond(response);
};

API.prototype.error = function(kind, message, statusCode) {
    this._respond({
        success: false,
        kind: kind,
        error: {
            message: message
        }
    }, statusCode || HTTP.BAD_REQUEST);
};
