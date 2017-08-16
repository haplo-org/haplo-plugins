/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */
 

/*

    Define request handlers like normal, but instead of a function, pass in a steps object.

    This has functions which perform the various steps of the process. All functions get the
    values from argument declaractions appended.

    setup() returns an HTTP client (without calling request()) if it actually wants to
    do the request. data is used for the callback data. setup() may add to it, but shouldn't
    touch or use any existing properties.

    setup: function(data, E, ...) {
        var http = O.httpClient();
        // ...
        return http;
    },

    process() processes the response from the http request, and returns a data structure
    that is JSON stringified and made available to the next handle().

    process: function(data, client, result) {
        return {some:"value"};
    },

    handle() goes the final request handling, combining request parameters, and the data
    generated from processing the HTTP response.

    handle: function(data, result, E, ...) {
        // ...
        E.render({
            // ...
        });
    }

*/

P.provideFeature("haplo:respond-after-http-request", function(plugin) {

    plugin.respondAfterHTTPRequest = function(methods, path, argDeclarations, steps) {

        this.respond(methods, path, argDeclarations, function(E) {
            var handlerArgs = Array.prototype.slice.call(arguments);
            var callWithArgs = function(name, args) {
                return steps[name].apply(steps, args.concat(handlerArgs));
            };

            // Is a request required?
            var continuation = E.continuation;
            if(continuation.isInitial) {
                var data = {"$continuationIdentifier":continuation.identifier};
                var http = callWithArgs('setup', [data]);
                if(http) {
                    // Make sure the calling plugin also has the right privilege
                    O.enforcePluginPrivilege(plugin, "pHTTPClient", "make HTTP request via respondAfterHTTPRequest()");
                    http.request(Callback, data);
                    continuation.setTimeout(59000);
                    continuation.suspend();
                    return;
                }
            }

            // No HTTP request, or this request has been resumed after success
            var rdata, result;
            if(!continuation.isInitial) {
                // HTTP request happened, get data from continuation
                var json = continuation.getAttribute("$respAfterHttp:data");
                rdata = json ? JSON.parse(json) : {};
                result = continuation.getAttribute("$respAfterHttp:result");
            }

            // Do rest of handling
            callWithArgs('handle', [rdata, result]);
        });

        // Callback to process HTTP response
        var Callback = this.callback("$respAfterHttp:"+methods+':'+path, function(data, client, result) {
            var rdata = steps.process(data, client, result) || {};
            O.resumeRequestWithContinuationIdentifier(
                data.$continuationIdentifier,
                {
                    "$respAfterHttp:data": JSON.stringify(rdata),
                    "$respAfterHttp:result": result || ''
                }
            );
        });
    };

});
