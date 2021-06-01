/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Filters are used to filter input values from the Records.
// The implementing service returns a function which takes a value, and returns a filtered value.

// --------------------------------------------------------------------------

var _filters;

P.getAvailableFilters = function() {
    if(!_filters) {
        _filters = {};
        O.service("haplo:service-registry:query", ["conforms-to haplo:data-import-framework:filter"]).services.forEach((m) => {
            _filters[m.metadata.name] = {
                service: m.name,
                description: m.metadata.description,
                documentationURL: m.metadata.documentationURL
            };
        });
    }
    return _filters;
};


// --------------------------------------------------------------------------

// Change a string representation to a Ref
P.implementService("haplo:data-import-framework:filter:haplo:string-to-ref", function() {
    return function(value) {
        if(typeof(value) === "string") {
            var r = O.ref(value);
            return r || undefined;
        } else if(O.isRef(value)) {
            return value;   // pass refs unmodified
        }
    };
});


// --------------------------------------------------------------------------

// Change a behaviour code to a Ref
P.implementService("haplo:data-import-framework:filter:haplo:code-to-ref", function() {
    return function(value) {
        if(typeof(value) === "string") {
            var r = O.behaviourRefMaybe(value);
            return r || undefined;
        } else if(O.isRef(value)) {
            return value;   // pass refs unmodified
        }
    };
});


// --------------------------------------------------------------------------

// Username (as tag on User) to ref
P.implementService("haplo:data-import-framework:filter:haplo:username-to-ref", function() {
    return function(value) {
        var q = O.usersByTags({"username": value.toLowerCase()});
        var user = q.length ? q[0] : undefined;
        return user ? (user.ref||undefined) : undefined;
    };
});


// --------------------------------------------------------------------------

const URL_COULD_BE_FIXED = /^[a-zA-Z][a-zA-Z\+\.\-\/]+$/;

// Fix up URLs missing scheme
P.implementService("haplo:data-import-framework:filter:haplo:fix-up-url", function() {
    return function(value) {
        if(typeof(value) === "string") {
            if((-1 === value.indexOf(':')) && URL_COULD_BE_FIXED.test(value)) {
                return "https://"+value;
            }
            return value;
        }
    };
});

// --------------------------------------------------------------------------

// String to lower case
P.implementService("haplo:data-import-framework:filter:haplo:to-lower-case", function() {
    return function(value) {
        if(typeof(value) === "string") {
            return value.toLowerCase();
        }
        return value;
    };
});

// --------------------------------------------------------------------------

// String to lower case
P.implementService("haplo:data-import-framework:filter:haplo:to-upper-case", function() {
    return function(value) {
        if(typeof(value) === "string") {
            return value.toUpperCase();
        }
        return value;
    };
});

// --------------------------------------------------------------------------

// Value to string
P.implementService("haplo:data-import-framework:filter:haplo:to-string", function() {
    return function(value) {
        return value.toString();
    };
});

