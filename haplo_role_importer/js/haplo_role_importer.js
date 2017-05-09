/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Role importer
//
// A quicker way of exporting/importing research institute and committee roles
//
// To use: 'Role importer' in admin menu, 'Export' on system with the data,
// paste data into text box on the new system. It does a dry run before
// being applied.
//
// It matches based on title's for Research Institute, and on email's first for
// people (but falls back to title if an email match cannot be found)
//
// Current Limits: doesn't support multiple research institutes on committee's
//
// TODO: genericism (supporting arbitrary types?)
//       shouldn't specify hres schema
//       export/import from file
//       exporting of individual objects?

P.hook('hGetReportsList', function(response) {
    if(O.currentUser.isMemberOf(Group.Administrators)) { 
        response.reports.push(["/do/haplo-role-importer/admin", "Role importer"]);
    }
});

P.respond("GET", "/do/haplo-role-importer/admin", [
], function(E) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    E.render({
    });
});

