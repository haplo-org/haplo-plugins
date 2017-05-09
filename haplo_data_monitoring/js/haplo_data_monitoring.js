/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var normalise = function(name) {
    if(!name) { return ""; }
    return name.replace(/[^a-zA-Z]/, " ");
};

// DUPLICATE profiles dashboard
P.respond("GET", "/do/haplo-data-monitoring/duplicate-profiles", [
    {parameter:"action", as:"string", optional:true},
    {parameter:"ref", as:"ref", optional:true}
], function(E, action, ref) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    var notDuplicates = P.data.notDuplicates || [];
    if(action === "unignoreAll") {
        P.data.notDuplicates = [];
        return E.response.redirect("/do/haplo-data-monitoring/duplicate-profiles");
    }
    if(action === "remove") {
        if(notDuplicates.indexOf(ref.toString()) === -1) {
            notDuplicates.push(ref.toString());
            P.data.notDuplicates = notDuplicates;
        }
    }
    if(action === "unignore") {
        notDuplicates = _.without(notDuplicates, ref.toString());
        P.data.notDuplicates = notDuplicates;
        return E.response.redirect("/do/haplo-data-monitoring/duplicate-profiles");
    }
    var start = new Date();
    var allProfiles = O.query().link(T.Person, A.Type).sortByTitle().execute();
    var duplicates = [];
    var seen = [];
    for(var i=1; i<allProfiles.length; i++) {
        if(notDuplicates.indexOf(allProfiles[i-1].ref.toString()) !== -1) { continue; }
        var a = allProfiles[i-1],
            b = allProfiles[i];
        if(O.serviceMaybe("haplo_data_monitoring:remove_from_duplicates_list", a, b)) {
            b = allProfiles[i+1];
        }
        var aTitle = a.firstTitle().toFields(),
            bTitle = b.firstTitle().toFields();
        var aFirst = normalise(aTitle.first),
            bFirst = normalise(bTitle.first),
            aLast = normalise(aTitle.last),
            bLast = normalise(bTitle.last);
        if(aLast && bLast && aLast === bLast) {
            // check that first names exist for both names we're comparing else skip over
            if(!aFirst || !bFirst) { continue; }
            if((aFirst === bFirst) ||
               (aFirst.split(" ")[0] === bFirst) ||
               (!aFirst.charAt(1) && aFirst.charAt(0) === bFirst.charAt(0))
               ) {
                // don't include in duplicates if both users have active IT accounts
                if(O.user(a.ref) && O.user(b.ref)) { continue; }
                duplicates.push({
                    researcher:a,
                    researcherType:a.first(A.Type).load().title,
                    potential:b,
                    potentialType:b.first(A.Type).load().title,
                    identicalEmail:a.has(b.first(A.EmailAddress), A.EmailAddress),
                    merge:true
                });
            }
        }
    }
    var ignoring = _.map(notDuplicates, function(refStr) { 
        return {researcher: O.ref(refStr).load()};
    });
    var count = duplicates.length;
    var end = new Date();
    var generated = (end.getTime() - start.getTime())/1000;
    E.render({
        duplicates: duplicates,
        count: count,
        generated: generated,
        ignoring: ignoring
    });
});