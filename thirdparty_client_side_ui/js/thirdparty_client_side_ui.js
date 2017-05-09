/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var INCLUDES = {
    "tablesort": {
        "0": "include_tablesort_0"
    }
};

P.globalTemplateFunction("thirdparty:client_side_ui:resources", function(name, version) {
    var versions = INCLUDES[name];
    if(!versions) { throw "Unknown resource: "+name; }
    var templateName = versions[version];
    if(!templateName) { throw "Unknown resource version: "+name+" version "+version; }
    P.template(templateName).render();
});
