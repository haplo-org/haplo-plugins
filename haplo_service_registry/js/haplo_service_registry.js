/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var registry;

// --------------------------------------------------------------------------

P.implementService("haplo:service-registry:query", function(statements) {
    ensureRegistry();
    if(!statements || statements.length === 0) {
        return new ServiceList([]);
    }
    return new ServiceList(registry.filter((s) => s._matchesStatements(statements)));
});

// --------------------------------------------------------------------------
/*HaploDoc
node: /haplo-plugins/haplo_service_registry/service_metadata
title: ServiceMetadata
sort: 1
--

An object representing a service listed in the service regitry.

h3(key). name

The name of the service. Use this to call the service function wity @O.service(serviceMetadata.name, ... args ... )@.

h3(key). metadata

An object of the metadata for this service, as listed in this plugin's @__service-metadata__.json@ file.
*/
var ServiceMetadata = function(name) {
    this.name = name;
    this.metadata = {};
    this.$statements = {};
};

ServiceMetadata.prototype._add = function(info) {
    _.each(info.statements || [], (statement) => {
        this.$statements[statement] = true;
    });
    _.extend(this.metadata, info.metadata || {});
};

ServiceMetadata.prototype._matchesStatements = function(statements) {
    let s = this.$statements;
    for(let i = 0; i < statements.length; ++i) {
        if(!s[statements[i]]) { return false; }
    }
    return true;
};

// --------------------------------------------------------------------------

/*HaploDoc
node: /haplo-plugins/haplo_service_registry/service_list
title: ServiceList
sort: 1
--

The @ServiceList@ interface represents a list of [node:haplo-plugins/haplo_service_registry/service_metadata] \
objects. This is the object returned when querying the service registry.

h3(key). services

An array of [node:haplo-plugins/haplo_service_registry/service_metadata] objects.
*/
var ServiceList = function(services) {
    this.services = services;
};

/*HaploDoc
node: /haplo-plugins/haplo_service_registry/service_list
sort: 4
--

h3(key). isEmpty

Returns true if this @ServiceList@ contains no [node:haplo-plugins/haplo_service_registry/service_metadata] objects.
*/
ServiceList.prototype.__defineGetter__("isEmpty", function() {
    return this.services.length === 0;
});

/*HaploDoc
node: /haplo-plugins/haplo_service_registry/service_list
sort: 7
--

h3(function). eachService(iterator)

Calls the @iterator@ function for each object in the @services@ list.
*/
ServiceList.prototype.eachService = function(iterator) {
    this.services.forEach(iterator);
};

// --------------------------------------------------------------------------

// Find the root of the JS runtime scope, which allows lookup of plugins by name.
var root = (function() { return this; })();

var ensureRegistry = function() {
    if(registry) { return; }

    let r = {};
    _.each(O.application.plugins, function(pluginName) {
        let plugin = root[pluginName];
        if(plugin) {
            if(plugin.hasFile("__service-metadata__.json")) {
                let json = JSON.parse(plugin.loadFile("__service-metadata__.json").readAsString());
                _.each(json, (info, name) => {
                    if(O.serviceImplemented(name)) {
                        let metadata = r[name];
                        if(!metadata) { r[name] = metadata = new ServiceMetadata(name); }
                        metadata._add(info);
                    }
                });
            }
        }
    });

    registry = _.values(r);
};
